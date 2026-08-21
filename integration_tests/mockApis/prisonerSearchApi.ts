import type { SuperAgentRequest } from 'superagent'
import { stubFor, stubPing } from './wiremock'
import type { ErrorResponse } from '../../server/data/interfaces/errorResponse'
import type { Prisoner } from '../../server/data/interfaces/prisonerSearchApi'
import { mockPrisoner } from '../../server/testutils/mocks/prisonerSearchApi'

export default {
  stubPing: (httpStatus = 200): SuperAgentRequest => stubPing('/prisoner-search', httpStatus),

  stubGetPrisoner(prisonerNumber: string, response?: Prisoner | ErrorResponse): SuperAgentRequest {
    const jsonBody = response ?? mockPrisoner(prisonerNumber)
    return stubFor({
      request: {
        method: 'GET',
        urlPath: `/prisoner-search/prisoner/${prisonerNumber}`,
      },
      response: {
        status: response && 'userMessage' in response ? response.status : 200,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        jsonBody,
      },
    })
  },
}
