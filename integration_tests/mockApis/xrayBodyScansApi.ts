import type { SuperAgentRequest } from 'superagent'
import { stubFor, stubPing } from './wiremock'
import { formatIsoDate } from '../../server/utils/dates'
import type { ErrorResponse } from '../../server/data/interfaces/errorResponse'
import type { PageResponse } from '../../server/data/interfaces/pagination'
import { emptyPageResponse } from '../../server/testutils/pagination'
import { mockScanSummaryResponse } from '../../server/testutils/mocks/xrayBodyScansApi'
import type {
  CreateScanCaseNoteRequest,
  CreateScanRequest,
  LegacyScanResponse,
  ListScansRequest,
  ScanResponse,
  ScanSummaryResponse,
} from '../../server/data/interfaces/xrayBodyScansApi'

export default {
  stubPing: (httpStatus = 200): SuperAgentRequest => stubPing('/xray-body-scans-api', httpStatus),

  stubGetScanSummary(prisonerNumber: string, response?: ScanSummaryResponse | ErrorResponse): SuperAgentRequest {
    const jsonBody = response ?? mockScanSummaryResponse({ prisonerNumber, now: new Date() })
    return stubFor({
      request: {
        method: 'GET',
        urlPath: `/xray-body-scans-api/prisoner/${prisonerNumber}/scan/summary`,
      },
      response: {
        status: response && 'userMessage' in response ? response.status : 200,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        jsonBody:
          'fromScanDate' in jsonBody
            ? {
                ...jsonBody,
                fromScanDate: formatIsoDate(jsonBody.fromScanDate),
                toScanDate: formatIsoDate(jsonBody.toScanDate),
              }
            : jsonBody,
      },
    })
  },

  stubGetScan(id: string, response: ScanResponse | ErrorResponse) {
    const jsonBody = 'userMessage' in response ? response : scanToRawScan(response)
    return stubFor({
      request: {
        method: 'GET',
        urlPath: `/xray-body-scans-api/scans/${id}`,
      },
      response: {
        status: 'userMessage' in response ? response.status : 200,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        jsonBody,
      },
    })
  },

  stubListScans(
    prisonerNumber: string,
    response: PageResponse<ScanResponse | LegacyScanResponse> | ErrorResponse = emptyPageResponse(),
    request?: ListScansRequest,
  ): SuperAgentRequest {
    const queryParameters: Record<string, { equalTo: string }> = {}
    if (request?.fromScanDate) {
      queryParameters.fromScanDate = { equalTo: formatIsoDate(request.fromScanDate) }
    }
    if (request?.toScanDate) {
      queryParameters.toScanDate = { equalTo: formatIsoDate(request.toScanDate) }
    }
    const jsonBody =
      'content' in response
        ? {
            ...response,
            content: response.content.map(scanToRawScan),
          }
        : response
    return stubFor({
      request: {
        method: 'GET',
        urlPath: `/xray-body-scans-api/prisoner/${prisonerNumber}/scan`,
        queryParameters,
      },
      response: {
        status: response && 'userMessage' in response ? response.status : 200,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        jsonBody,
      },
    })
  },

  stubCreateScanCaseNote(scanId: string, request?: CreateScanCaseNoteRequest): SuperAgentRequest {
    return stubFor({
      request: {
        method: 'POST',
        urlPath: `/xray-body-scans-api/scan/${scanId}/case-note`,
        ...(request ? { bodyPatterns: [{ equalToJson: request }] } : {}),
      },
      response: {
        status: 201,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
      },
    })
  },

  stubCreateScan(
    prisonerNumber: string,
    request: CreateScanRequest,
    response: ScanResponse | ErrorResponse,
  ): SuperAgentRequest {
    const jsonBody = 'userMessage' in response ? response : scanToRawScan(response)
    return stubFor({
      request: {
        method: 'POST',
        urlPath: `/xray-body-scans-api/prisoner/${prisonerNumber}/scan`,
        bodyPatterns: [{ equalToJson: request }],
      },
      response: {
        status: 'userMessage' in response ? response.status : 201,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        jsonBody,
      },
    })
  },
}

function scanToRawScan(scan: ScanResponse | LegacyScanResponse) {
  return scan.source === 'NOMIS'
    ? {
        ...scan,
        scanDate: scan.scanDate ? formatIsoDate(scan.scanDate) : null,
      }
    : {
        ...scan,
        scanDate: formatIsoDate(scan.scanDate),
        mergedAt: scan.mergedAt ? scan.mergedAt.toISOString() : null,
        createdAt: scan.createdAt.toISOString(),
        lastModifiedAt: scan.lastModifiedAt.toISOString(),
      }
}
