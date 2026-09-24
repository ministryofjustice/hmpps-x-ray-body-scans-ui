import { user } from '../routes/testutils/appSetup'
import { fixedClock, yesterday } from '../testutils/fixedClock'
import { mockScanResponse } from '../testutils/mocks/xrayBodyScansApi'
import { canAddCaseNotToScan } from './scanPermissions'

const prisonerNumber = 'A1234BC'

beforeAll(() => {
  fixedClock()
})

describe('scan-specific permissions', () => {
  it('should allow adding a case note to a recent scan in user’s active case load', () => {
    expect(canAddCaseNotToScan(user, mockScanResponse(prisonerNumber, yesterday, 'MDI'))).toBe(true)
  })

  it('should forbid adding a case note to an old scan in user’s active case load', () => {
    expect(canAddCaseNotToScan(user, mockScanResponse(prisonerNumber, new Date(2026, 5, 2, 12), 'MDI'))).toBe(false)
  })

  it('should allow adding a case note to a recent scan in user’s active case load', () => {
    expect(canAddCaseNotToScan(user, mockScanResponse(prisonerNumber, yesterday, 'LEI'))).toBe(false)
  })
})
