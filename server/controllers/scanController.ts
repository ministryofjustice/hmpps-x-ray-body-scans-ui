import type { Request, Response } from 'express'

import type { XrayBodyScansApiClient } from '../data/xrayBodyScansApiClient'
import type { CreateScanRequest } from '../data/interfaces/xrayBodyScansApiClient'
import type AuditService from '../services/auditService'
import { Page } from '../services/auditService'
import { formatDisplayDate, formatIsoDate } from '../utils/dates'

const dayMillis = 24 * 60 * 60 * 1000

export default class ScanController {
  constructor(
    private readonly xrayBodyScansApiClient: XrayBodyScansApiClient,
    private readonly auditService: AuditService,
  ) {}

  async getScanList(req: Request, res: Response): Promise<void> {
    const { prisonerNumber } = req.params as { prisonerNumber: string }
    const { username } = res.locals.user

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

    const rawScanRows = scans.map(scan =>
      scan.source === 'NOMIS'
        ? {
            source: scan.source,
            date: scan.scanDate ? formatDisplayDate(scan.scanDate) : 'Not recorded',
            result: scan.scanDetails || 'Not recorded',
            action: null,
          }
        : {
            source: scan.source,
            date: formatDisplayDate(scan.scanDate),
            establishment: scan.prisonId,
            reason: scan.justificationDescription,
            result: scan.outcomeDescription,
            itemsFound: scan.typeOfFindDescription ?? 'None',
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
    const { prisonerNumber } = req.params as { prisonerNumber: string }
    const { username } = res.locals.user

    await this.auditService.logPageView(Page.CREATE_SCAN, {
      who: username,
      subjectId: prisonerNumber,
      subjectType: 'PRISONER_ID',
      correlationId: req.id,
    })

    const today = new Date()
    const yesterday = new Date(today.getTime() - dayMillis)

    res.render('pages/createScan', {
      prisonerNumber,
      today: formatDisplayDate(today),
      yesterday: formatDisplayDate(yesterday),
    })
  }

  async postCreateScan(req: Request, res: Response): Promise<void> {
    const { prisonerNumber } = req.params as { prisonerNumber: string }
    const {
      scanDateOption,
      'scanDate-day': day,
      'scanDate-month': month,
      'scanDate-year': year,
      scanResult,
      itemType,
    } = req.body as {
      scanDateOption: string
      'scanDate-day': string
      'scanDate-month': string
      'scanDate-year': string
      scanResult: string
      itemType?: string
    }

    let scanDateValue: string
    if (scanDateOption === 'today') {
      scanDateValue = formatIsoDate(new Date())
    } else if (scanDateOption === 'yesterday') {
      scanDateValue = formatIsoDate(new Date(Date.now() - dayMillis))
    } else {
      scanDateValue = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    }

    const { username } = res.locals.user
    const createScanRequest: CreateScanRequest = {
      scanDate: scanDateValue,
      // TODO: add prisoner search service to look this up
      prisonId: 'TODO',
      // TODO: the create-scan form does not currently collect a justification, but the API requires one
      justification: 'REASONABLE_SUSPICION',
      outcome: scanResult,
      typeOfFind: itemType ?? null,
      createdBy: username,
    }
    const createScanResponse = await this.xrayBodyScansApiClient.createScan(prisonerNumber, createScanRequest, username)
    res.redirect(
      `/prisoner/${prisonerNumber}/create-scan/success?scanId=${createScanResponse.id}&scanDate=${formatIsoDate(createScanResponse.scanDate)}`,
    )
  }

  async getCreateScanSuccess(req: Request, res: Response): Promise<void> {
    const { prisonerNumber } = req.params as { prisonerNumber: string }
    const { username } = res.locals.user

    await this.auditService.logPageView(Page.CREATE_SCAN_SUCCESS, {
      who: username,
      subjectId: prisonerNumber,
      subjectType: 'PRISONER_ID',
      correlationId: req.id,
    })

    res.render('pages/createScanSuccess', { prisonerNumber })
  }
}
