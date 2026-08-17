import type { Prisoner } from '../../data/interfaces/prisonerSearchApiClient'

// eslint-disable-next-line import/prefer-default-export
export function mockPrisoner(prisonerNumber: string, overrides?: Partial<Prisoner>): Prisoner {
  return {
    firstName: 'JOHN',
    lastName: 'SMITH',

    inOutStatus: 'IN',
    status: 'ACTIVE IN',

    prisonId: 'MDI',
    prisonName: 'Moorland (HMP & YOI)',
    previousPrisonId: 'LEI',
    previousPrisonLeavingDate: '2026-08-10T10:50',

    ...overrides,
    prisonerNumber,
  }
}
