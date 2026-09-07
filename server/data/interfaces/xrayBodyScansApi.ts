import type { PageRequest } from './pagination'

export const justifications = ['INTELLIGENCE', 'REASONABLE_SUSPICION'] as const
export type Justification = (typeof justifications)[number]

export const outcomes = ['NEGATIVE', 'INCONCLUSIVE', 'POSITIVE'] as const
export type Outcome = (typeof outcomes)[number]

export const typesOfFind = ['ORGANIC', 'INORGANIC', 'ORGANIC_AND_INORGANIC', 'NOT_KNOWN'] as const
export type TypeOfFind = (typeof typesOfFind)[number]

export interface ListScansRequest extends PageRequest<'scanDate'> {
  fromScanDate?: Date | undefined
  toScanDate?: Date | undefined
}

export interface CreateScanRequest extends Record<string, unknown> {
  scanDate: string
  prisonId: string
  justification: Justification
  outcome: Outcome
  typeOfFind?: TypeOfFind | null
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
  justification: Justification
  justificationDescription: string
  outcome: Outcome
  outcomeDescription: string
  typeOfFind: TypeOfFind | null
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

export interface CreateScanCaseNoteRequest extends Record<string, unknown> {
  text: string
}

export interface ScanCaseNoteResponse {
  id: string
  typeDescription: string
  subTypeDescription: string
  createdBy: string
  createdAt: Date
  occurredAt: Date
  text: string
}
