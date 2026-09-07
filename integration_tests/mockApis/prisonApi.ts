import fs from 'fs/promises'
import type { Response, SuperAgentRequest } from 'superagent'
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

  async stubPrisonerPhoto(imageId: string, getFullSizedImage = false): Promise<Response> {
    const photo = await fs.readFile('assets/images/photo-unavailable.jpeg', { encoding: 'base64' })
    return stubFor({
      request: {
        method: 'GET',
        urlPath: `/prison-api/api/images/${imageId}/data`,
        queryParameters: { fullSizeImage: { equalTo: getFullSizedImage ? 'true' : 'false' } },
      },
      response: {
        status: 200,
        headers: { 'Content-Type': 'application/jpeg' },
        base64Body: photo,
      },
    })
  },
}
