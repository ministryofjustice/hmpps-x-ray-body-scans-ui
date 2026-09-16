import { telemetry } from '@ministryofjustice/hmpps-azure-telemetry'
import { mockScanCaseNoteResponse, mockScanResponse } from '../testutils/mocks/xrayBodyScansApi'
import { TelemetryService } from './telemetryService'

jest.mock('@ministryofjustice/hmpps-azure-telemetry')
const telemetryClient = jest.mocked(telemetry)

const scan = mockScanResponse('A1111AA', new Date())
const caseNote = mockScanCaseNoteResponse(scan)

describe('Telemetry service', () => {
  let telemetryService: TelemetryService
  beforeEach(() => {
    telemetryService = new TelemetryService()
  })

  it('should track scan created event', () => {
    telemetryService.scanCreated(scan)
    expect(telemetryClient.trackEvent).toHaveBeenCalledWith('SCAN_CREATED', { id: scan.id })
  })

  it('should track case note added event', () => {
    telemetryService.caseNoteAdded(caseNote)
    expect(telemetryClient.trackEvent).toHaveBeenCalledWith('CASE_NOTE_ADDED', { id: caseNote.id })
  })
})
