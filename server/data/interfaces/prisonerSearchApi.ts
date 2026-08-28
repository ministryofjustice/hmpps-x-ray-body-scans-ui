export interface Prisoner {
  prisonerNumber: string
  firstName: string
  middleNames?: string
  lastName: string
  status: string
  inOutStatus?: 'IN' | 'OUT' | 'TRN'
  prisonId?: string
  prisonName?: string
  previousPrisonId?: string
  previousPrisonLeavingDate?: string
}
