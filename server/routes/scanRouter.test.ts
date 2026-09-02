import type { Express } from 'express'
import request from 'supertest'
import { PermissionsService } from '@ministryofjustice/hmpps-prison-permissions-lib'
import { appWithAllRoutes, user } from './testutils/appSetup'
import createUserToken from '../testutils/createUserToken'
import { emptyPageResponse } from '../testutils/pagination'
import type { Services } from '../services'
import AuditService from '../services/auditService'
import { PrisonService } from '../services/prisonService'
import { PrisonerSearchApiClient } from '../data/prisonerSearchApiClient'
import { XrayBodyScansApiClient } from '../data/xrayBodyScansApiClient'
import { mockPrisonNamesImpl } from '../testutils/mocks/prisonService'
import { mockPrisoner } from '../testutils/mocks/prisonerSearchApi'
import { mockScanSummaryResponse } from '../testutils/mocks/xrayBodyScansApi'

jest.mock('@ministryofjustice/hmpps-prison-permissions-lib')
jest.mock('../data/prisonerSearchApiClient')
jest.mock('../data/xrayBodyScansApiClient')
jest.mock('../services/auditService')
jest.mock('../services/prisonService')

const auditService = jest.mocked(new AuditService({} as never))
const prisonPermissionsService = jest.mocked(PermissionsService.create({} as never))
const prisonService = jest.mocked(new PrisonService({} as never, {} as never))
const prisonerSearchApiClient = jest.mocked(new PrisonerSearchApiClient({} as never))
const xrayBodyScansApiClient = jest.mocked(new XrayBodyScansApiClient({} as never))
const services: Services = {
  applicationInfo: {} as never,
  auditService,
  prisonPermissionsService,
  prisonService,
  prisonerSearchApiClient,
  xrayBodyScansApiClient,
}

const prisonerNumber = 'A1234BC'

let app: Express

const unauthorisedUser = { ...user, token: createUserToken([]) }

beforeEach(() => {
  auditService.logPageView.mockResolvedValue(undefined)
  prisonService.getPrisonNames.mockImplementation(mockPrisonNamesImpl)
  prisonerSearchApiClient.getPrisoner.mockResolvedValueOnce(mockPrisoner(prisonerNumber))
})

afterEach(() => {
  jest.resetAllMocks()
})

describe('scan router', () => {
  it('should redirect to authError when the user does not have the DPS_APPLICATION_DEVELOPER role', () => {
    app = appWithAllRoutes({
      services,
      userSupplier: () => unauthorisedUser,
    })

    return request(app)
      .get(`/prisoner/${prisonerNumber}/scan-overview`)
      .expect(302)
      .expect('Location', '/authError')
      .expect(() => {
        expect(prisonerSearchApiClient.getPrisoner).not.toHaveBeenCalled()
        expect(xrayBodyScansApiClient.getScanSummary).not.toHaveBeenCalled()
        expect(xrayBodyScansApiClient.listScans).not.toHaveBeenCalled()
      })
  })

  it('should allow access when the user has the DPS_APPLICATION_DEVELOPER role', () => {
    app = appWithAllRoutes({ services })
    xrayBodyScansApiClient.getScanSummary.mockResolvedValueOnce(
      mockScanSummaryResponse({ prisonerNumber, now: new Date(), relevantAlerts: [] }),
    )
    xrayBodyScansApiClient.listScans.mockResolvedValueOnce(emptyPageResponse())

    return request(app).get(`/prisoner/${prisonerNumber}/scan-overview`).expect(200)
  })

  it('should show 404 page when prisoner is not found', () => {
    app = appWithAllRoutes({ services })
    prisonerSearchApiClient.getPrisoner.mockReset()
    prisonerSearchApiClient.getPrisoner.mockResolvedValueOnce(null)

    return request(app)
      .get(`/prisoner/${prisonerNumber}/scan-overview`)
      .expect(404)
      .expect(() => {
        expect(prisonerSearchApiClient.getPrisoner).toHaveBeenCalledWith(prisonerNumber, 'user1')
        expect(xrayBodyScansApiClient.getScanSummary).not.toHaveBeenCalled()
        expect(xrayBodyScansApiClient.listScans).not.toHaveBeenCalled()
      })
  })

  it('should redirect to DPS home page when user has no active caseload', () => {
    app = appWithAllRoutes({
      services,
      userSupplier: () => ({ ...user, activeCaseLoadId: undefined }),
    })

    return request(app)
      .get(`/prisoner/${prisonerNumber}/scan-overview`)
      .expect(302)
      .expect('Location', 'http://localhost:3001/dps-home')
      .expect(() => {
        expect(prisonerSearchApiClient.getPrisoner).not.toHaveBeenCalled()
        expect(xrayBodyScansApiClient.getScanSummary).not.toHaveBeenCalled()
        expect(xrayBodyScansApiClient.listScans).not.toHaveBeenCalled()
      })
  })

  it('should redirect to scans list when trying to go to person’s link', () => {
    app = appWithAllRoutes({ services })

    return request(app)
      .get(`/prisoner/${prisonerNumber}`)
      .expect(302)
      .expect('Location', `/prisoner/${prisonerNumber}/scan-overview`)
      .expect(() => {
        expect(prisonerSearchApiClient.getPrisoner).toHaveBeenCalledWith(prisonerNumber, 'user1')
        expect(xrayBodyScansApiClient.getScanSummary).not.toHaveBeenCalled()
        expect(xrayBodyScansApiClient.listScans).not.toHaveBeenCalled()
      })
  })
})
