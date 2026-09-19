import { PermissionsService } from '@ministryofjustice/hmpps-prison-permissions-lib'
import type { Services } from '../../services'
import { PrisonApiClient } from '../../data/prisonApi'
import { PrisonerSearchApiClient } from '../../data/prisonerSearchApiClient'
import { XrayBodyScansApiClient } from '../../data/xrayBodyScansApiClient'
import AuditService from '../../services/auditService'
import { PrisonService } from '../../services/prisonService'

// NB: requires test module to mock each service

const auditService = jest.mocked(new AuditService({} as never))
const prisonApiClient = jest.mocked(new PrisonApiClient({} as never))
const prisonPermissionsService = jest.mocked(PermissionsService.create({} as never))
const prisonService = jest.mocked(new PrisonService({} as never, {} as never))
const prisonerSearchApiClient = jest.mocked(new PrisonerSearchApiClient({} as never))
const xrayBodyScansApiClient = jest.mocked(new XrayBodyScansApiClient({} as never))

// eslint-disable-next-line import/prefer-default-export
export const mockServices: jest.MockedObjectDeep<Services> = {
  applicationInfo: {} as never,
  auditService,
  prisonApiClient,
  prisonPermissionsService,
  prisonService,
  prisonerSearchApiClient,
  xrayBodyScansApiClient,
}
