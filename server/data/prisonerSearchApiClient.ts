import { asSystem, RestClient } from '@ministryofjustice/hmpps-rest-client'
import type { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import config from '../config'
import logger from '../../logger'
import type { Prisoner } from './interfaces/prisonerSearchApi'

// eslint-disable-next-line import/prefer-default-export
export class PrisonerSearchApiClient extends RestClient {
  constructor(authenticationClient: AuthenticationClient) {
    super('Prisoner Search API', config.apis.prisonerSearchApi, logger, authenticationClient)
  }

  /** Returns prisoner details or null if not found */
  getPrisoner(prisonerNumber: string, username: string): Promise<Prisoner | null> {
    return this.get(
      {
        path: `/prisoner/${encodeURIComponent(prisonerNumber)}`,
        errorHandler: (path, method, error) => {
          if (error?.responseStatus === 404) {
            return null
          }
          return this.handleError(path, method, error)
        },
      },
      asSystem(username),
    )
  }
}
