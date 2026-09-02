import type { Request, Response } from 'express'

import logger from '../../logger'
import { formatDisplayDate } from '../utils/dates'
import type { XrayBodyScansApiClient } from '../data/xrayBodyScansApiClient'
import type { ScanResponse } from '../data/interfaces/xrayBodyScansApi'
import type AuditService from '../services/auditService'
import { Page } from '../services/auditService'

export default class CaseNoteController {
  constructor(
    private readonly auditService: AuditService,
    private readonly xrayBodyScansApiClient: XrayBodyScansApiClient,
  ) {}

  async getAddScanCaseNote(req: Request, res: Response): Promise<void> {
    const { prisoner, scan } = res.locals
    const { username } = res.locals.user

    if (!this.checkScan(scan)) {
      res.sendStatus(404)
      return
    }

    await this.auditService.logPageView(Page.ADD_SCAN_CASE_NOTE, {
      who: username,
      subjectId: prisoner.prisonerNumber,
      subjectType: 'PRISONER_ID',
      correlationId: req.id,
    })

    this.renderAddScanCaseNoteForm(req, res, scan)
  }

  async postAddScanCaseNote(req: Request, res: Response): Promise<void> {
    const { prisoner, scan } = res.locals
    const { username } = res.locals.user

    if (!this.checkScan(scan)) {
      res.sendStatus(404)
      return
    }

    const additionalDetails = ((req.body.additionalDetails as string | undefined) ?? '').trim()
    if (additionalDetails.length > 3500) {
      this.renderAddScanCaseNoteForm(req, res, scan, false, {
        properties: {
          additionalDetails: { errors: ['The additional details must be 3,500 characters or less'] },
        },
      })
      return
    }
    const text = this.buildCaseNoteText(scan, additionalDetails)

    try {
      const caseNote = await this.xrayBodyScansApiClient.createScanCaseNote(scan.id, { text }, username)
      logger.info(`Created case note ${caseNote.id} for scan ${scan.id}`)

      // TODO: confirm required audit event info
      await this.auditService.logAuditEvent({
        what: 'CREATE_XRAY_BODY_SCAN_CASE_NOTE',
        who: username,
        subjectId: prisoner.prisonerNumber,
        subjectType: 'PRISONER_ID',
        correlationId: req.id,
        details: { scanId: scan.id },
      })

      res.redirect(`/prisoner/${prisoner.prisonerNumber}/scan-overview`)
    } catch (error) {
      logger.error(error)
      this.renderAddScanCaseNoteForm(req, res, scan, true)
    }
  }

  private checkScan(scan: ScanResponse | undefined): scan is ScanResponse {
    return Boolean(scan && scan.source === 'DPS' && !scan.caseNoteId)
  }

  private renderAddScanCaseNoteForm(
    req: Request,
    res: Response,
    scan: ScanResponse,
    createCallFailed = false,
    errors?: { properties?: { additionalDetails?: { errors: string[] } } },
  ): void {
    const autoText = this.buildCaseNoteText(scan)
    const occurredAt = `${formatDisplayDate(scan.scanDate)} at 00:00`

    res.render('pages/addScanCaseNote', {
      autoText,
      occurredAt,
      caseNoteTitle: `Result of X-ray body scan: ${scan.outcomeDescription}`,
      createCallFailed,
      errors,
      formValues: req.body,
    })
  }

  private buildCaseNoteText(scan: ScanResponse, additionalDetails?: string): string {
    const lines = [`Reason: ${scan.justificationDescription}`, `Result: ${scan.outcomeDescription}`]
    if (scan.typeOfFindDescription) {
      lines.push(`Items found: ${scan.typeOfFindDescription}`)
    }
    if (additionalDetails) {
      lines.push('--', additionalDetails)
    }
    return lines.join('\n')
  }
}
