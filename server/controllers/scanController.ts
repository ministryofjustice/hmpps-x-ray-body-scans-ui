import type { Request, Response } from 'express'

import logger from '../../logger'
import { formatDisplayDate } from '../utils/dates'
import type { ZodErrorTree } from '../forms/formErrors'
import { createScanForm, treeifyCreateScanFormErrors } from '../forms/createScanForm'
import type { PrisonUser } from '../interfaces/hmppsUser'
import { internalSecretorCode } from '../data/interfaces/alertsApi'
import type { XrayBodyScansApiClient } from '../data/xrayBodyScansApiClient'
import type { CreateScanRequest, ScanResponse } from '../data/interfaces/xrayBodyScansApi'
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
            action: 'TODO: link based on scan.caseNoteId',
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

  private renderCreateScanForm<T>(req: Request, res: Response, errors?: ZodErrorTree<T>): void {
    const { prisoner } = res.locals

    const today = new Date()
    const yesterday = new Date(today.getTime() - dayMillis)

    res.render('pages/createScan', {
      prisoner,
      today: formatDisplayDate(today),
      yesterday: formatDisplayDate(yesterday),
      errors,
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
      this.renderCreateScanForm(req, res, { errors: ['The details could not be recorded. Try again later'] })
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
