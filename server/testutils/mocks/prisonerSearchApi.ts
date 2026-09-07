import type { Prisoner } from '../../data/interfaces/prisonerSearchApi'

// eslint-disable-next-line import/prefer-default-export
export function mockPrisoner(prisonerNumber: string, overrides?: Partial<Prisoner>): Prisoner {
  return {
    firstName: 'JOHN',
    lastName: 'SMITH',

    inOutStatus: 'IN',
    status: 'ACTIVE IN',
    cellLocation: 'A-1-205',

    prisonId: 'MDI',
    prisonName: 'Moorland (HMP & YOI)',
    previousPrisonId: 'LEI',
    previousPrisonLeavingDate: '2026-08-10T10:50',

    category: 'C',

    ...overrides,
    prisonerNumber,
  }
}
