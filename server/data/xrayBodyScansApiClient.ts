import { asSystem, RestClient } from '@ministryofjustice/hmpps-rest-client'
import type { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import config from '../config'
import logger from '../../logger'
import { isoDate } from '../utils/dates'
import type {
  CreateScanRequest,
  ListScansRequest,
  ScanResponse,
  ScanSummaryRequest,
  ScanSummaryResponse,
} from './interfaces/xrayBodyScansApiClient'

interface RawScanResponse extends Omit<ScanResponse, 'scanDate' | 'mergedAt' | 'createdAt' | 'lastModifiedAt'> {
  scanDate: string
  mergedAt: string | null
  createdAt: string
  lastModifiedAt: string
}

export function convertRawScanResponse(scan: RawScanResponse): ScanResponse {
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

  getScanSummary(prisonerNumber: string, request: ScanSummaryRequest, username: string): Promise<ScanSummaryResponse> {
    const query: Record<string, string | undefined> = {
      fromScanDate: isoDate(request.fromScanDate),
      toScanDate: isoDate(request.toScanDate),
    }
    return this.get<RawScanSummaryResponse>(
      {
        path: `/prisoner/${encodeURIComponent(prisonerNumber)}/scan/summary`,
        query,
      },
      asSystem(username),
    ).then(convertRawScanSummaryResponse)
  }

  listScans(prisonerNumber: string, request: ListScansRequest, username: string): Promise<ScanResponse[]> {
    const query: object = {
      ...(request ?? {}),
      fromScanDate: isoDate(request?.fromScanDate),
      toScanDate: isoDate(request?.toScanDate),
    }
    return this.get<RawScanResponse[]>(
      {
        path: `/prisoner/${encodeURIComponent(prisonerNumber)}/scan`,
        query,
      },
      asSystem(username),
    ).then(response => response.map(convertRawScanResponse))
  }

  createScan(prisonerNumber: string, scanData: CreateScanRequest, username: string): Promise<ScanResponse> {
    return this.post<RawScanResponse>(
      {
        path: `/prisoner/${encodeURIComponent(prisonerNumber)}/scan`,
        data: scanData,
      },
      asSystem(username),
    ).then(convertRawScanResponse)
  }
}
