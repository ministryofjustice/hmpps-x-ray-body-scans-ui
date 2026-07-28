import { PageRequest } from '../PageRequest'

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

export interface ScanResponse {
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
  fromScanDate: Date
  toScanDate: Date
}
