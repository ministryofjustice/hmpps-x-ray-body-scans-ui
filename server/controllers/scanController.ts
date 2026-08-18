import type { Request, Response } from 'express'

import type { PrisonUser } from '../interfaces/hmppsUser'
import type { XrayBodyScansApiClient } from '../data/xrayBodyScansApiClient'
import type { CreateScanRequest, Justification, Outcome, TypeOfFind } from '../data/interfaces/xrayBodyScansApiClient'
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
    const { prisonerNumber } = res.locals.prisoner
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

    const rawScanRows = scans.content.map(scan =>
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
    const { prisoner, user } = res.locals

    await this.auditService.logPageView(Page.CREATE_SCAN, {
      who: user.username,
      subjectId: prisoner.prisonerNumber,
      subjectType: 'PRISONER_ID',
      correlationId: req.id,
    })

    const today = new Date()
    const yesterday = new Date(today.getTime() - dayMillis)

    res.render('pages/createScan', {
      prisoner,
      today: formatDisplayDate(today),
      yesterday: formatDisplayDate(yesterday),
    })
  }

  async postCreateScan(req: Request, res: Response): Promise<void> {
    const { prisonerNumber } = res.locals.prisoner
    const {
      scanDateOption,
      'scanDate-day': day,
      'scanDate-month': month,
      'scanDate-year': year,
      justification,
      outcome,
      typeOfFind,
    } = req.body as {
      scanDateOption: 'today' | 'yesterday' | 'other'
      'scanDate-day': string
      'scanDate-month': string
      'scanDate-year': string
      justification: Justification
      outcome: Outcome
      typeOfFind?: TypeOfFind
    }

    let scanDateValue: string
    if (scanDateOption === 'today') {
      scanDateValue = formatIsoDate(new Date())
    } else if (scanDateOption === 'yesterday') {
      scanDateValue = formatIsoDate(new Date(Date.now() - dayMillis))
    } else {
      scanDateValue = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    }

    const { username, activeCaseLoadId } = res.locals.user as PrisonUser
    const createScanRequest: CreateScanRequest = {
      scanDate: scanDateValue,
      prisonId: activeCaseLoadId!,
      justification,
      outcome,
      typeOfFind: typeOfFind ?? null,
      createdBy: username,
    }
    const createScanResponse = await this.xrayBodyScansApiClient.createScan(prisonerNumber, createScanRequest, username)
    res.redirect(
      `/prisoner/${prisonerNumber}/record-scan/success?scanId=${createScanResponse.id}&scanDate=${formatIsoDate(createScanResponse.scanDate)}`,
    )
  }

  async getCreateScanSuccess(req: Request, res: Response): Promise<void> {
    const { prisoner } = res.locals
    const { username } = res.locals.user

    await this.auditService.logPageView(Page.CREATE_SCAN_SUCCESS, {
      who: username,
      subjectId: prisoner.prisonerNumber,
      subjectType: 'PRISONER_ID',
      correlationId: req.id,
    })

    res.render('pages/createScanSuccess', { prisoner })
  }
}
