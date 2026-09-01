import type {
  AlertResponse,
  LegacyScanResponse,
  ScanCaseNoteResponse,
  ScanResponse,
  ScanSummaryResponse,
  ScanSummaryResponseWithAlerts,
  ScanSummaryResponseWithoutAlerts,
} from '../../data/interfaces/xrayBodyScansApi'

const sampleId = '019f94a7-17cd-746f-b1df-5d4848da42e1'
export function mockScanResponse(
  prisonerNumber: string,
  scanDate: Date,
  prisonId = 'MDI',
  createdBy = 'abc12a',
): ScanResponse {
  return {
    source: 'DPS',
    id: sampleId,
    prisonerNumber,
    prisonId,
    scanDate,
    justification: 'REASONABLE_SUSPICION',
    justificationDescription: 'Reasonable suspicion',
    outcome: 'POSITIVE',
    outcomeDescription: 'Item detected',
    typeOfFind: 'INORGANIC',
    typeOfFindDescription: 'Inorganic',
    caseNoteId: null,
    mergedAt: null,
    mergedFromPrisonerNumber: null,
    createdAt: new Date(),
    createdBy,
    lastModifiedAt: new Date(),
    lastModifiedBy: createdBy,
  }
}

const sampleLegacyId = '715262'
export function mockLegacyScanResponse(
  prisonerNumber: string,
  scanDate: Date | null,
  scanDetails: string | null = null,
): LegacyScanResponse {
  return {
    source: 'NOMIS',
    id: sampleLegacyId,
    prisonerNumber,
    scanDate,
    scanDetails,
  }
}

export const annualLimit = 116
export const nearingLimitThreshold = 100

interface ScanSummaryMockOptions {
  prisonerNumber: string
  now: Date
  nomisCount?: number
  dpsCount?: number
  positiveCount?: number
  negativeCount?: number
  relevantAlerts?: AlertResponse[] | null
}

export function mockScanSummaryResponse(
  options: ScanSummaryMockOptions & { relevantAlerts: AlertResponse[] },
): ScanSummaryResponseWithAlerts
export function mockScanSummaryResponse(
  options: ScanSummaryMockOptions & { relevantAlerts?: null },
): ScanSummaryResponseWithoutAlerts
export function mockScanSummaryResponse(options: ScanSummaryMockOptions): ScanSummaryResponse
export function mockScanSummaryResponse({
  prisonerNumber,
  now,
  nomisCount = 0,
  dpsCount = 0,
  positiveCount = 0,
  negativeCount = 0,
  relevantAlerts = null,
}: ScanSummaryMockOptions): ScanSummaryResponse {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const startOfYear = new Date(now)
  startOfYear.setDate(1)
  startOfYear.setMonth(0)
  startOfYear.setHours(0, 0, 0, 0)
  const totalCount = nomisCount + dpsCount
  const inconclusiveCount = dpsCount - positiveCount - negativeCount
  const remainingScans = annualLimit - totalCount
  const nearingScanLimit = totalCount >= nearingLimitThreshold
  const atScanLimit = remainingScans <= 0
  return {
    prisonerNumber,
    nomisCount,
    dpsCount,
    totalCount,
    positiveCount,
    negativeCount,
    inconclusiveCount,
    annualLimit,
    remainingScans,
    nearingScanLimit,
    atScanLimit,
    relevantAlerts,
    fromScanDate: startOfYear,
    toScanDate: today,
  }
}

export const mockInternalSecretorAlert: AlertResponse = {
  id: '44ed8220-a899-4847-93de-95e1ffae2997',
  type: 'X',
  typeDescription: 'Security',
  code: 'XIS',
  codeDescription: 'Internal Secretor',
}

export const mockDoNotScanAlert: AlertResponse = {
  id: '5a2d75f1-25ff-43b6-96a2-cf8d82e2e14e',
  type: 'X',
  typeDescription: 'Security',
  code: 'XXRAY',
  codeDescription: 'Do Not X-Ray Body Scan',
}

const caseNoteId = '341c845e-fadc-4ec8-9330-81c83968c1a8'
export function mockScanCaseNoteResponse(
  scan: ScanResponse,
  additionalDetails: string = 'some notes',
): ScanCaseNoteResponse {
  const occurredAt = new Date(scan.scanDate)
  occurredAt.setHours(0, 0, 0, 0)
  return {
    id: caseNoteId,
    title: `Result of X-ray body scan: ${scan.outcomeDescription}`,
    text: `
X-ray body scan for ${scan.prisonerNumber}
--
Reason: ${scan.justificationDescription}
Result: ${scan.outcomeDescription}
Items found: ${scan.typeOfFindDescription || 'None'}
--
${additionalDetails}
    `.trim(),
    occurredAt,
    createdBy: scan.createdBy,
    createdAt: new Date(),
  }
}
