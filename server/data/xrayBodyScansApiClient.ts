import { asSystem, RestClient } from '@ministryofjustice/hmpps-rest-client'
import type { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import config from '../config'
import logger from '../../logger'
import { formatIsoDate } from '../utils/dates'
import type { PageResponse } from './interfaces/pagination'
import type {
  CreateScanRequest,
  LegacyScanResponse,
  ListScansRequest,
  ScanResponse,
  ScanSummaryRequest,
  ScanSummaryResponse,
  ScanSummaryResponseWithAlerts,
  ScanSummaryResponseWithoutAlerts,
} from './interfaces/xrayBodyScansApi'

interface RawScanResponse extends Omit<ScanResponse, 'scanDate' | 'mergedAt' | 'createdAt' | 'lastModifiedAt'> {
  scanDate: string
  mergedAt: string | null
  createdAt: string
  lastModifiedAt: string
}

interface RawLegacyScanResponse extends Omit<LegacyScanResponse, 'scanDate'> {
  scanDate: string | null
}

export function convertRawScanResponse(scan: RawScanResponse): ScanResponse
export function convertRawScanResponse(scan: RawLegacyScanResponse): LegacyScanResponse
export function convertRawScanResponse(scan: RawScanResponse | RawLegacyScanResponse): ScanResponse | LegacyScanResponse
export function convertRawScanResponse(
  scan: RawScanResponse | RawLegacyScanResponse,
): ScanResponse | LegacyScanResponse {
  if (scan.source === 'NOMIS') {
    return {
      ...scan,
      // using midday in order to avoid daylight saving switches
      scanDate: scan.scanDate ? new Date(`${scan.scanDate}T12:00:00`) : null,
    }
  }
  return {
    ...scan,
    // using midday in order to avoid daylight saving switches
    scanDate: new Date(`${scan.scanDate}T12:00:00`),
    mergedAt: scan.mergedAt ? new Date(scan.mergedAt) : null,
    createdAt: new Date(scan.createdAt),
    lastModifiedAt: new Date(scan.lastModifiedAt),
  }
}

interface RawScanSummaryResponse extends Omit<ScanSummaryResponse, 'fromScanDate' | 'toScanDate'> {
  fromScanDate: string
  toScanDate: string
}

export function convertRawScanSummaryResponse(summary: RawScanSummaryResponse): ScanSummaryResponse {
  return {
    ...summary,
    // using midday in order to avoid daylight saving switches
    fromScanDate: new Date(`${summary.fromScanDate}T12:00:00`),
    toScanDate: new Date(`${summary.toScanDate}T12:00:00`),
  }
}

export class XrayBodyScansApiClient extends RestClient {
  constructor(authenticationClient: AuthenticationClient) {
    super('X-ray Body Scans API', config.apis.xrayBodyScansApi, logger, authenticationClient)
  }

  getScanSummary(
    prisonerNumber: string,
    request: ScanSummaryRequest & { includeAlerts: true },
    username: string,
  ): Promise<ScanSummaryResponseWithAlerts>

  getScanSummary(
    prisonerNumber: string,
    request: ScanSummaryRequest & { includeAlerts?: false },
    username: string,
  ): Promise<ScanSummaryResponseWithoutAlerts>

  getScanSummary(prisonerNumber: string, request: ScanSummaryRequest, username: string): Promise<ScanSummaryResponse>

  getScanSummary(prisonerNumber: string, request: ScanSummaryRequest, username: string): Promise<ScanSummaryResponse> {
    return this.get<RawScanSummaryResponse>(
      {
        path: `/prisoner/${encodeURIComponent(prisonerNumber)}/scan/summary`,
        query: request,
      },
      asSystem(username),
    ).then(convertRawScanSummaryResponse)
  }

  async getScan(id: string, username: string): Promise<ScanResponse | null> {
    const scan = await this.get<RawScanResponse | null>(
      {
        path: `/scans/${id}`,
        errorHandler: (path, method, error) => {
          if (error?.responseStatus === 404) {
            return null
          }
          return this.handleError(path, method, error)
        },
      },
      asSystem(username),
    )
    return scan ? convertRawScanResponse(scan) : null
  }

  listScans(
    prisonerNumber: string,
    request: ListScansRequest,
    username: string,
  ): Promise<PageResponse<ScanResponse | LegacyScanResponse>> {
    const query: object = {
      ...request,
      fromScanDate: formatIsoDate(request?.fromScanDate),
      toScanDate: formatIsoDate(request?.toScanDate),
    }
    return this.get<PageResponse<RawScanResponse | RawLegacyScanResponse>>(
      {
        path: `/prisoner/${encodeURIComponent(prisonerNumber)}/scan`,
        query,
      },
      asSystem(username),
    ).then(rawResponses => ({
      ...rawResponses,
      content: rawResponses.content.map(convertRawScanResponse),
    }))
  }

  createScan(prisonerNumber: string, scanData: CreateScanRequest, username: string): Promise<ScanResponse> {
    return this.post<RawScanResponse>(
      {
        path: `/prisoner/${encodeURIComponent(prisonerNumber)}/scan`,
        data: scanData,
      },
      asSystem(username),
    ).then(response => convertRawScanResponse(response))
  }
}
