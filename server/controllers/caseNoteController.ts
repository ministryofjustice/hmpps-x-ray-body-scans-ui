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

      // TODO: confirm required audit event info
      await this.auditService.logAuditEvent({
        what: 'CREATE_XRAY_BODY_SCAN_CASE_NOTE',
        who: username,
        subjectId: prisoner.prisonerNumber,
        subjectType: 'PRISONER_ID',
        correlationId: req.id,
        details: { scanId },
      })

      res.redirect(`/prisoner/${prisoner.prisonerNumber}/scan-overview`)
    } catch (error) {
      logger.error(error)
      this.renderAddScanCaseNoteForm(req, res, scan, true)
    }
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
    const occurredAt = `${formatDisplayDate(scan.scanDate)} at 00:00`

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
}
