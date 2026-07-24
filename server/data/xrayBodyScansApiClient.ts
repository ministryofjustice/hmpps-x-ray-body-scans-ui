import { RestClient, asSystem } from '@ministryofjustice/hmpps-rest-client'
import type { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import config from '../config'
import logger from '../../logger'

export interface CreateScanRequest extends Record<string, unknown> {
  scanDate: string
  prisonId: string
  justification: string
  outcome: string
  typeOfFind?: string | null
  createdBy: string
}

export interface ScanResponse {
  id: string
  prisonerNumber: string
  prisonId: string
  scanDate: string
  justification: string
  justificationDescription: string
  outcome: string
  outcomeDescription: string
  typeOfFind: string | null
  typeOfFindDescription: string | null
  caseNoteId: string | null
  mergedFromPrisonerNumber: string | null
  mergedAt: string | null
  createdAt: string
  createdBy: string
  lastModifiedAt: string
  lastModifiedBy: string
}

export default class XrayBodyScansApiClient extends RestClient {
  constructor(authenticationClient: AuthenticationClient) {
    super('X-Ray Body Scans API', config.apis.xrayBodyScansApi, logger, authenticationClient)
  }

  createScan(prisonerNumber: string, scanData: CreateScanRequest, username: string): Promise<ScanResponse> {
    return this.post(
      {
        path: `/prisoner/${prisonerNumber}/scan`,
        data: scanData,
      },
      asSystem(username),
    )
  }
}
