import type { SuperAgentRequest } from 'superagent'
import { stubFor, stubPing } from './wiremock'

export default {
  stubPing: (httpStatus = 200): SuperAgentRequest => stubPing('/xray-body-scans-api', httpStatus),

  stubGetScanSummary: (prisonerNumber: string): SuperAgentRequest =>
    stubFor({
      request: {
        method: 'GET',
        urlPathPattern: `/xray-body-scans-api/prisoner/${prisonerNumber}/scan/summary`,
      },
      response: {
        status: 200,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        jsonBody: {
          prisonerNumber,
          nomisCount: 0,
          dpsCount: 0,
          totalCount: 0,
          positiveCount: 0,
          negativeCount: 0,
          inconclusiveCount: 0,
          annualLimit: 116,
          remainingScans: 116,
          nearingScanLimit: false,
          atScanLimit: false,
          relevantAlerts: null,
          fromScanDate: '2026-01-01',
          toScanDate: '2026-07-27',
        },
      },
    }),

  stubListScans: (prisonerNumber: string): SuperAgentRequest =>
    stubFor({
      request: {
        method: 'GET',
        urlPathPattern: `/xray-body-scans-api/prisoner/${prisonerNumber}/scan`,
      },
      response: {
        status: 200,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        jsonBody: {
          content: [],
          totalElements: 0,
          totalPages: 0,
          number: 0,
          size: 20,
        },
      },
    }),
}
