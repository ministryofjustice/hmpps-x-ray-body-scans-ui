import type { PageRequest } from './pagination'

export interface ListScansRequest extends PageRequest<'scanDate'> {
  fromScanDate?: Date | undefined
  toScanDate?: Date | undefined
}

export interface CreateScanRequest extends Record<string, unknown> {
  scanDate: string
  prisonId: string
  justification: string
  outcome: string
  typeOfFind?: string | null
  createdBy: string
}

export interface UnifiedScanResponse {
  source: 'DPS' | 'NOMIS'
  id: string
  prisonerNumber: string
  scanDate: Date | null
}

export interface ScanResponse extends UnifiedScanResponse {
  source: 'DPS'
  id: string
  prisonerNumber: string
  prisonId: string
  scanDate: Date
  justification: string
  justificationDescription: string
  outcome: string
  outcomeDescription: string
  typeOfFind: string | null
  typeOfFindDescription: string | null
  caseNoteId: string | null
  mergedFromPrisonerNumber: string | null
  mergedAt: Date | null
  createdAt: Date
  createdBy: string
  lastModifiedAt: Date
  lastModifiedBy: string
}

export interface LegacyScanResponse extends UnifiedScanResponse {
  source: 'NOMIS'
  id: string
  prisonerNumber: string
  scanDate: Date | null
  scanDetails: string | null
}

export interface ScanSummaryRequest {
  includeAlerts?: boolean
}

export interface ScanSummaryResponse {
  prisonerNumber: string
  nomisCount: number
  dpsCount: number
  totalCount: number
  positiveCount: number
  negativeCount: number
  inconclusiveCount: number
  annualLimit: number
  remainingScans: number
  nearingScanLimit: boolean
  atScanLimit: boolean
  relevantAlerts: AlertResponse[] | null
  fromScanDate: Date
  toScanDate: Date
}

export interface ScanSummaryResponseWithoutAlerts extends ScanSummaryResponse {
  relevantAlerts: null
}

export interface ScanSummaryResponseWithAlerts extends ScanSummaryResponse {
  relevantAlerts: AlertResponse[]
}

export interface AlertResponse {
  id: string
  type: string
  typeDescription: string
  code: string
  codeDescription: string
}
