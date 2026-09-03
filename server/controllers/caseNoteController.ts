import type { Request, Response } from 'express'
import { NotFound } from 'http-errors'
import logger from '../../logger'
import type { XrayBodyScansApiClient } from '../data/xrayBodyScansApiClient'
import type { ScanResponse } from '../data/interfaces/xrayBodyScansApi'
import type AuditService from '../services/auditService'
import { Page } from '../services/auditService'

export default class CaseNoteController {
  constructor(
    private readonly auditService: AuditService,
    private readonly xrayBodyScansApiClient: XrayBodyScansApiClient,
  ) {}

  async getScanCaseNote(req: Request, res: Response): Promise<void> {
    const { prisoner, scan } = res.locals
    const { username } = res.locals.user

    if (!this.scanHasCaseNote(scan)) {
      throw new NotFound()
    }
    const caseNote = await this.xrayBodyScansApiClient.getScanCaseNote(scan.id, username)
    if (!scan || !caseNote || scan.caseNoteId !== caseNote.id) {
      throw new NotFound()
    }

    // TODO: determine if user can view case note

    await this.auditService.logPageView(Page.VIEW_SCAN_CASE_NOTE, {
      who: username,
      subjectId: prisoner.prisonerNumber,
      subjectType: 'PRISONER_ID',
      correlationId: req.id,
    })

    res.render('pages/scanCaseNote', { caseNote })
  }

  async getAddScanCaseNote(req: Request, res: Response): Promise<void> {
    const { prisoner, scan } = res.locals
    const { username } = res.locals.user

    if (!this.scanHasNoCaseNote(scan)) {
      throw new NotFound()
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

    if (!this.scanHasNoCaseNote(scan)) {
      throw new NotFound()
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

  private scanHasCaseNote(scan: ScanResponse | undefined): scan is ScanResponse {
    return Boolean(scan && scan.source === 'DPS' && scan.caseNoteId)
  }

  private scanHasNoCaseNote(scan: ScanResponse | undefined): scan is ScanResponse {
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

    res.render('pages/addScanCaseNote', {
      scan,
      autoText,
      createCallFailed,
      errors,
      formValues: req.body,
    })
  }

  private buildCaseNoteText(scan: ScanResponse, additionalDetails?: string): string {
    const lines = [
      `Reason: ${scan.justificationDescription}`,
      `Result: ${scan.outcomeDescription}`,
      `Items found: ${scan.typeOfFindDescription ? scan.typeOfFindDescription : 'None'}`,
    ]
    if (additionalDetails) {
      lines.push('--', additionalDetails)
    }
    return lines.join('\n')
  }
}
