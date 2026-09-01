import type { Request, Response } from 'express'

import config from '../config'
import logger from '../../logger'
import { formatDisplayDate } from '../utils/dates'
import { type CreateScanFormErrors, createScanForm, treeifyCreateScanFormErrors } from '../forms/createScanForm'
import type { PrisonUser } from '../interfaces/hmppsUser'
import { internalSecretorCode } from '../data/interfaces/alertsApi'
import type { XrayBodyScansApiClient } from '../data/xrayBodyScansApiClient'
import type { CreateScanRequest, ScanResponse } from '../data/interfaces/xrayBodyScansApiClient'

const longDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/London',
})
import type AuditService from '../services/auditService'
import { Page } from '../services/auditService'

const dayMillis = 24 * 60 * 60 * 1000

export default class ScanController {
  constructor(
    private readonly xrayBodyScansApiClient: XrayBodyScansApiClient,
    private readonly auditService: AuditService,
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

    const scanSummary = await this.xrayBodyScansApiClient.getScanSummary(
      prisonerNumber,
      { includeAlerts: true },
      username,
    )
    const scans = await this.xrayBodyScansApiClient.listScans(prisonerNumber, {}, username)

    const rawScanRows = scans.content.map(scan =>
      scan.source === 'NOMIS'
        ? {
            ...scan,
            scanDateDescription: scan.scanDate ? formatDisplayDate(scan.scanDate) : 'Not recorded',
            action: null,
          }
        : {
            ...scan,
            scanDateDescription: formatDisplayDate(scan.scanDate),
            prisonDescription: scan.prisonId, // TODO: lookup in prison-register or prison-api
            action: scan.caseNoteId
              ? {
                  text: 'View case note',
                  href: `${config.serviceUrls.prisonerProfile}/prisoner/${prisonerNumber}/update-case-note/${scan.caseNoteId}`,
                }
              : {
                  text: 'Add a case note',
                  href: `/prisoner/${prisonerNumber}/scan/${scan.id}/add-a-scan-case-note`,
                },
          },
    )

    res.render('pages/scanList', {
      prisonerNumber,
      currentYear: new Date().getFullYear(),
      scansThisYearCount: scanSummary.totalCount,
      itemsDetectedCount: scanSummary.positiveCount,
      inconclusiveCount: scanSummary.inconclusiveCount,
      noItemsDetectedCount: scanSummary.negativeCount,
      // TODO: Get scanAlerts from soon-to-be xrbs endpoint
      scanAlerts: ['Some alert', 'Some other alert'],
      rawScanRows,
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
