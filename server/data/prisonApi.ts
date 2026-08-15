import { asUser, RestClient } from '@ministryofjustice/hmpps-rest-client'
import type { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import config from '../config'
import logger from '../../logger'
import type { CaseLoad } from './interfaces/prisonApi'

// eslint-disable-next-line import/prefer-default-export
export class PrisonApiClient extends RestClient {
  constructor(authenticationClient: AuthenticationClient) {
    super('Prison API', config.apis.prisonApi, logger, authenticationClient)
  }

  getMyCaseloads(userToken: string): Promise<CaseLoad[]> {
    return this.get(
      {
        path: '/api/users/me/caseLoads',
        query: { allCaseloads: 'true' },
      },
      asUser(userToken),
    )
  }
}
