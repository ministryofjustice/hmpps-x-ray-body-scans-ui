import type { SuperAgentRequest } from 'superagent'
import { stubFor, stubPing } from './wiremock'
import type { CaseLoad } from '../../server/data/interfaces/prisonApi'
import { caseloadMDI } from '../../server/testutils/mocks/prisonApi'

export default {
  stubPing: (httpStatus = 200): SuperAgentRequest => stubPing('/prison-api', httpStatus),

  stubMyCaseloads: (caseloads: CaseLoad[] = [caseloadMDI]): SuperAgentRequest =>
    stubFor({
      request: {
        method: 'GET',
        urlPath: '/prison-api/api/users/me/caseLoads',
        queryParameters: { allCaseloads: { equalTo: 'true' } },
      },
      response: {
        status: 200,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        jsonBody: caseloads,
      },
    }),
}
