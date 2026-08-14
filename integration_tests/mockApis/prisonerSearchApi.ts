import type { SuperAgentRequest } from 'superagent'
import { stubFor, stubPing } from './wiremock'
import type { ErrorResponse } from '../../server/data/interfaces/errorResponse'
import type { Prisoner } from '../../server/data/interfaces/prisonerSearchApiClient'

export default {
  stubPing: (httpStatus = 200): SuperAgentRequest => stubPing('/prisoner-search', httpStatus),

  stubGetPrisoner: (options: { prisoner: Prisoner } | { prisonerNumber: string; error: ErrorResponse }) =>
    stubFor({
      request: {
        method: 'GET',
        urlPathPattern: `/prisoner-search/prisoner/${'prisonerNumber' in options ? options.prisonerNumber : options.prisoner.prisonerNumber}/scan/summary`,
      },
      response: {
        status: 'error' in options ? options.error.status : 200,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        jsonBody: 'error' in options ? options.error : options.prisoner,
      },
    }),
}
