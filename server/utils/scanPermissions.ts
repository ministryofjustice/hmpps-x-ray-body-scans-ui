import type { PrisonUser } from '../interfaces/hmppsUser'
import type { ScanResponse } from '../data/interfaces/xrayBodyScansApi'
import { withinLast31Days } from './dates'

/**
 * Can the user add a case note to this scan?
 * This is applied *on top of* persioner permission checks, such as can the user read case notes.
 */
// eslint-disable-next-line import/prefer-default-export
export function canAddCaseNotToScan(user: PrisonUser, scan: ScanResponse): boolean {
  return (
    // scan must have been recorded in active case load
    scan.prisonId === user.activeCaseLoadId &&
    // and within last 31 days
    withinLast31Days(scan.scanDate)
  )
}
