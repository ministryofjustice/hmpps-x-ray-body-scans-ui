import { asUser, RestClient } from '@ministryofjustice/hmpps-rest-client'
import type { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import config from '../config'
import logger from '../../logger'
import type { Prison } from './interfaces/prisonRegisterApi'

// eslint-disable-next-line import/prefer-default-export
export class PrisonRegisterApiClient extends RestClient {
  constructor(authenticationClient: AuthenticationClient) {
    super('Prison Register API', config.apis.prisonerSearchApi, logger, authenticationClient)
  }

  getAllPrisons(token: string): Promise<readonly Prison[]> {
    return this.get({ path: '/prisons' }, asUser(token))
  }
}
