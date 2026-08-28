import type { SuperAgentRequest } from 'superagent'
import { stubFor, stubPing } from './wiremock'
import type { Prison } from '../../server/data/interfaces/prisonRegisterApi'
import { mockPrisons } from '../../server/testutils/mocks/prisonRegister'

export default {
  stubPing: (httpStatus = 200): SuperAgentRequest => stubPing('/prison-register', httpStatus),

  stubAllPrisons: (prisons: Prison[] = mockPrisons): SuperAgentRequest =>
    stubFor({
      request: {
        method: 'GET',
        urlPath: '/prisons',
      },
      response: {
        status: 200,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        jsonBody: prisons,
      },
    }),
}
