import { RestClient, asSystem } from '@ministryofjustice/hmpps-rest-client'
import type { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import config from '../config'
import logger from '../../logger'

export interface CreateScanRequest extends Record<string, unknown> {
  scanDate: string
}

export interface CreateScanResponse {
  id: number
  prisonerNumber: string
  scanDate: string
}

export default class XrayBodyScansApiClient extends RestClient {
  constructor(authenticationClient: AuthenticationClient) {
    super('X-Ray Body Scans API', config.apis.xrayBodyScansApi, logger, authenticationClient)
  }

  createScan(prisonerNumber: string, scanData: CreateScanRequest, username: string) {
    return this.post<CreateScanResponse, CreateScanRequest>(
      {
        path: `/prisoner/${prisonerNumber}/scan`,
        data: scanData,
      },
      asSystem(username),
    )
  }
}
