import type { Request, Response } from 'express'
import {
  type AlertFlagLabel,
  AlertType,
  getAlertFlagCssClasses,
  getAlertTypeForCode,
} from '@ministryofjustice/hmpps-connect-dps-shared-items'
import logger from '../../logger'
import { formatDisplayDate } from '../utils/dates'
import { paginate, sortable } from '../utils/paginate'
import { type CreateScanFormErrors, createScanForm, treeifyCreateScanFormErrors } from '../forms/createScanForm'
import { listScansForm } from '../forms/listScansForm'
import type { PrisonUser } from '../interfaces/hmppsUser'
import { internalSecretorCode } from '../data/interfaces/alertsApi'
import type { XrayBodyScansApiClient } from '../data/xrayBodyScansApiClient'
import type { CreateScanRequest, ListScansRequest, ScanResponse } from '../data/interfaces/xrayBodyScansApi'

const longDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/London',
})
import type AuditService from '../services/auditService'
import { Page } from '../services/auditService'
import { PrisonService } from '../services/prisonService'

const dayMillis = 24 * 60 * 60 * 1000

export default class ScanController {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisonService: PrisonService,
    private readonly xrayBodyScansApiClient: XrayBodyScansApiClient,
  ) {}

  async getScanList(req: Request, res: Response): Promise<void> {
    const { prisonerNumber } = res.locals.prisoner
    const { username } = res.locals.user

    // TODO: determine if user can see list

    await this.auditService.logPageView(Page.SCAN_LIST, {
      who: username,
      subjectId: prisonerNumber,
      subjectType: 'PRISONER_ID',
      correlationId: req.id,
    })

    const result = listScansForm.safeParse(req.query)
    const historicYears = result.data?.historicYears ?? []
    const yearFilter = result.data?.yearFilter
    const listScansRequest: ListScansRequest = result.data?.listScansRequest ?? {}

    const [scanSummary, scans] = await Promise.all([
      this.xrayBodyScansApiClient.getScanSummary(prisonerNumber, { includeAlerts: true }, username),
      this.xrayBodyScansApiClient.listScans(prisonerNumber, listScansRequest, username),
    ])

    const sorter = sortable(listScansRequest, req.originalUrl)
    const pagination = paginate(scans, req.originalUrl, yearFilter !== 'all')

    const prisonIds = Array.from(
      new Set(scans.content.map(scan => ('prisonId' in scan ? scan.prisonId : undefined)).filter(Boolean) as string[]),
    )
    const prisonNames =
      prisonIds.length > 0 ? await this.prisonService.getPrisonNames(prisonIds) : new Map<string, string>()

    const scanRows = scans.content.map(scan =>
      scan.source === 'NOMIS'
        ? {
            ...scan,
            scanDateDescription: scan.scanDate ? formatDisplayDate(scan.scanDate) : 'Not recorded',
          }
        : {
            ...scan,
            scanDateDescription: formatDisplayDate(scan.scanDate),
            prisonDescription: prisonNames.get(scan.prisonId),
          },
    )

    const alertFlags: AlertFlagLabel[] = scanSummary.relevantAlerts.map(alert => ({
      alertCodes: [alert.code],
      classes: getAlertFlagCssClasses(getAlertTypeForCode(alert.type) ?? AlertType.Security),
      label: alert.codeDescription,
    }))

    res.render('pages/scanList', {
      prisonerNumber,
      scanSummary,
      alertFlags,
      yearFilter,
      historicYears,
      sorter,
      pagination,
      scanRows,
    })
  }

  async getCreateScan(req: Request, res: Response): Promise<void> {
    const { prisoner, user } = res.locals

    // TODO: determine if user can create scan

    await this.auditService.logPageView(Page.CREATE_SCAN, {
      who: user.username,
      subjectId: prisoner.prisonerNumber,
      subjectType: 'PRISONER_ID',
      correlationId: req.id,
    })

    this.renderCreateScanForm(req, res)
  }

  private renderCreateScanForm(req: Request, res: Response, createScanFormErrors?: CreateScanFormErrors): void {
    const { prisoner } = res.locals
    const { errors, scanDateComponentsWithErrors, createCallFailed } = createScanFormErrors ?? {}

    const today = new Date()
    const yesterday = new Date(today.getTime() - dayMillis)

    res.render('pages/createScan', {
      prisoner,
      today: formatDisplayDate(today),
      yesterday: formatDisplayDate(yesterday),
      errors,
      scanDateComponentsWithErrors: scanDateComponentsWithErrors ?? new Set(),
      createCallFailed,
      formValues: errors ? req.body : undefined,
    })
  }

  async postCreateScan(req: Request, res: Response): Promise<void> {
    const { prisonerNumber } = res.locals.prisoner
    const { username, activeCaseLoadId } = res.locals.user as PrisonUser

    // TODO: determine if user can create scan

    const result = createScanForm.safeParse(req.body)
    if (!result.success) {
      const errors = treeifyCreateScanFormErrors(result.error)
      this.renderCreateScanForm(req, res, errors)
      return
    }

    const createScanRequest: CreateScanRequest = {
      ...result.data,
      prisonId: activeCaseLoadId!,
      createdBy: username,
    }

    try {
      const createScanResponse = await this.xrayBodyScansApiClient.createScan(
        prisonerNumber,
        createScanRequest,
        username,
      )
      logger.info(`Scan ${createScanResponse.id} recorded`)

      // TODO: confirm required audit event info
      await this.auditService.logAuditEvent({
        what: 'CREATE_XRAY_BODY_SCAN',
        who: username,
        subjectId: prisonerNumber,
        subjectType: 'PRISONER_ID',
        correlationId: req.id,
        details: { scanId: createScanResponse.id },
      })

      await this.renderCreateScanSuccess(req, res, createScanResponse)
    } catch (error) {
      logger.error(error)
      this.renderCreateScanForm(req, res, {
        errors: { errors: [] },
        scanDateComponentsWithErrors: new Set(),
        createCallFailed: true,
      })
    }
  }

  async getAddScanCaseNote(req: Request, res: Response): Promise<void> {
    const { prisoner } = res.locals
    const { username } = res.locals.user
    const scanId = req.params.scanId as string

    await this.auditService.logPageView(Page.ADD_SCAN_CASE_NOTE, {
      who: username,
      subjectId: prisoner.prisonerNumber,
      subjectType: 'PRISONER_ID',
      correlationId: req.id,
    })

    const scan = await this.xrayBodyScansApiClient.getScan(scanId, username)
    if (!scan || scan.source !== 'DPS') {
      res.sendStatus(404)
      return
    }

    this.renderAddScanCaseNoteForm(req, res, scan)
  }

  private renderAddScanCaseNoteForm(
    req: Request,
    res: Response,
    scan: ScanResponse,
    createCallFailed = false,
    errors?: { properties?: { additionalDetails?: { errors: string[] } } },
  ): void {
    const { prisoner } = res.locals
    const autoText = this.buildCaseNoteAutoText(prisoner.displayName, scan)
    const occurredAt = `${longDateFormatter.format(scan.scanDate)} at 00:00`

    res.render('pages/addScanCaseNote', {
      prisoner,
      scan,
      autoText,
      occurredAt,
      caseNoteTitle: `Result of X-ray body scan: ${scan.outcomeDescription}`,
      createCallFailed,
      errors,
      formValues: req.body,
    })
  }

  private buildCaseNoteAutoText(prisonerDisplayName: string, scan: ScanResponse): string {
    const lines = [
      `X-ray body scan for ${prisonerDisplayName}`,
      '--',
      `Reason: ${scan.justificationDescription}`,
      `Result: ${scan.outcomeDescription}`,
    ]
    if (scan.typeOfFindDescription) {
      lines.push(`Items found: ${scan.typeOfFindDescription}`)
    }
    lines.push('--')
    return lines.join('\n')
  }

  async postAddScanCaseNote(req: Request, res: Response): Promise<void> {
    const { prisoner } = res.locals
    const { username } = res.locals.user
    const scanId = req.params.scanId as string

    const scan = await this.xrayBodyScansApiClient.getScan(scanId, username)
    if (!scan || scan.source !== 'DPS') {
      res.sendStatus(404)
      return
    }

    const autoText = this.buildCaseNoteAutoText(prisoner.displayName, scan)
    const additionalDetails = (req.body.additionalDetails ?? '').trim()

    if (additionalDetails.length > 3500) {
      this.renderAddScanCaseNoteForm(req, res, scan, false, {
        properties: {
          additionalDetails: { errors: ['The additional details must be 3,500 characters or less'] },
        },
      })
      return
    }

    const text = additionalDetails ? `${autoText}\n${additionalDetails}` : autoText

    try {
      await this.xrayBodyScansApiClient.createScanCaseNote(scanId, { text }, username)

      await this.auditService.logAuditEvent({
        what: 'CREATE_XRAY_BODY_SCAN_CASE_NOTE',
        who: username,
        subjectId: prisoner.prisonerNumber,
        subjectType: 'PRISONER_ID',
        correlationId: req.id,
        details: { scanId },
      })

      res.redirect(`/prisoner/${prisoner.prisonerNumber}/scans`)
    } catch (error) {
      logger.error(error)
      this.renderAddScanCaseNoteForm(req, res, scan, true)
    }
  }

  private async renderCreateScanSuccess(req: Request, res: Response, scan: ScanResponse): Promise<void> {
    const { prisoner } = res.locals
    const { username } = res.locals.user

    const { relevantAlerts } = await this.xrayBodyScansApiClient.getScanSummary(
      prisoner.prisonerNumber,
      { includeAlerts: true },
      username,
    )
    const internalSecretorAlert = relevantAlerts.find(alert => alert.code === internalSecretorCode)

    await this.auditService.logPageView(Page.CREATE_SCAN_SUCCESS, {
      who: username,
      subjectId: prisoner.prisonerNumber,
      subjectType: 'PRISONER_ID',
      correlationId: req.id,
    })

    res.render('pages/createScanSuccess', {
      prisoner,
      scan,
      internalSecretorAlert,
      internalSecretorAlertCreated: false,
    })
  }
}
