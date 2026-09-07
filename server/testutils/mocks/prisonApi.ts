import fs from 'node:fs'
import type { Readable } from 'node:stream'
import type { CaseLoad } from '../../data/interfaces/prisonApi'

export const caseloadLEI: CaseLoad = {
  caseLoadId: 'LEI',
  description: 'Leeds (HMP)',
  type: 'INST',
  caseloadFunction: 'GENERAL',
  currentlyActive: true,
}

export const caseloadMDI: CaseLoad = {
  caseLoadId: 'MDI',
  description: 'Moorland (HMP & YOI)',
  type: 'INST',
  caseloadFunction: 'GENERAL',
  currentlyActive: true,
}

/** Returns the JPEG as returned by prison-api, not the usual placeholder PNG */
export function mockPhotoReadable(): Promise<Readable> {
  return Promise.resolve(fs.createReadStream('assets/images/photo-unavailable.jpeg'))
}
