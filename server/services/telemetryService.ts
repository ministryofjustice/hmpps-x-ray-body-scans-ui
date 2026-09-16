import { telemetry as telemetryClient } from '@ministryofjustice/hmpps-azure-telemetry'
import type { ScanResponse, ScanCaseNoteResponse } from '../data/interfaces/xrayBodyScansApi'

// eslint-disable-next-line import/prefer-default-export
export class TelemetryService {
  scanCreated(scanResponse: ScanResponse): void {
    telemetryClient.trackEvent('SCAN_CREATED', {
      id: scanResponse.id,
    })
  }

  caseNoteAdded(caseNoteResponse: ScanCaseNoteResponse): void {
    telemetryClient.trackEvent('CASE_NOTE_ADDED', {
      id: caseNoteResponse.id,
    })
  }
}
