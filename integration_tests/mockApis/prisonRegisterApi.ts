import type { SuperAgentRequest } from 'superagent'
import { stubFor, stubPing } from './wiremock'
import type { Prison } from '../../server/data/interfaces/prisonRegisterApi'
import { mockPrisonLEI, mockPrisonMDI } from '../../server/testutils/mocks/prisonRegister'

export default {
  stubPing: (httpStatus = 200): SuperAgentRequest => stubPing('/prison-register', httpStatus),

  stubAllPrisons: (prisons: Prison[] = [mockPrisonLEI, mockPrisonMDI]): SuperAgentRequest =>
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
