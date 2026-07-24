import type { Request, Response } from 'express'

import type XrayBodyScansApiClient from '../data/xrayBodyScansApiClient'
import type { CreateScanRequest } from '../data/xrayBodyScansApiClient'

export default class ScanController {
  constructor(private readonly xrayBodyScansApiClient: XrayBodyScansApiClient) {}

  async getCreateScan(req: Request, res: Response): Promise<void> {
    const { prisonerNumber } = req.params
    res.render('pages/createScan', { prisonerNumber })
  }

  async postCreateScan(req: Request, res: Response): Promise<void> {
    const { prisonerNumber } = req.params as { prisonerNumber: string }
    const { scanDate, justification, outcome, typeOfFind } = req.body
    const { username } = res.locals.user
    const createScanRequest: CreateScanRequest = {
      scanDate,
      prisonId: '', // TODO: add prisoner search service to look this up
      justification,
      outcome,
      typeOfFind,
      createdBy: username,
    }
    const createScanResponse = await this.xrayBodyScansApiClient.createScan(prisonerNumber, createScanRequest, username)
    res.status(201).send(`Scan created for prisoner ${prisonerNumber} with scan ID ${createScanResponse.id}`)
  }
}
