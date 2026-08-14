import type { SuperAgentRequest } from 'superagent'
import { stubFor, stubPing } from './wiremock'
import type { ErrorResponse } from '../../server/data/interfaces/errorResponse'
import type { PageResponse } from '../../server/data/interfaces/pagination'
import { emptyPageResponse } from '../../server/testutils/pagination'
import { mockScanSummaryResponse } from '../../server/testutils/mocks/xrayBodyScansApiClient'
import type {
  LegacyScanResponse,
  ScanResponse,
  ScanSummaryResponse,
} from '../../server/data/interfaces/xrayBodyScansApiClient'

export default {
  stubPing: (httpStatus = 200): SuperAgentRequest => stubPing('/xray-body-scans-api', httpStatus),

  stubGetScanSummary: (prisonerNumber: string, response?: ScanSummaryResponse | ErrorResponse): SuperAgentRequest =>
    stubFor({
      request: {
        method: 'GET',
        urlPathPattern: `/xray-body-scans-api/prisoner/${prisonerNumber}/scan/summary`,
      },
      response: {
        status: response && 'userMessage' in response ? response.status : 200,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        jsonBody: response ?? mockScanSummaryResponse({ prisonerNumber, now: new Date() }),
      },
    }),

  stubListScans: (
    prisonerNumber: string,
    response: PageResponse<ScanResponse | LegacyScanResponse> | ErrorResponse = emptyPageResponse(),
  ): SuperAgentRequest =>
    stubFor({
      request: {
        method: 'GET',
        urlPathPattern: `/xray-body-scans-api/prisoner/${prisonerNumber}/scan`,
      },
      response: {
        status: response && 'userMessage' in response ? response.status : 200,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        jsonBody: response,
      },
    }),
}
