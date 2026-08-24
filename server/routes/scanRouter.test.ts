import type { Express } from 'express'
import request from 'supertest'
import { appWithAllRoutes, user } from './testutils/appSetup'
import createUserToken from '../testutils/createUserToken'
import { emptyPageResponse } from '../testutils/pagination'
import type { Services } from '../services'
import AuditService from '../services/auditService'
import { PrisonerSearchApiClient } from '../data/prisonerSearchApiClient'
import { XrayBodyScansApiClient } from '../data/xrayBodyScansApiClient'
import { mockPrisoner } from '../testutils/mocks/prisonerSearchApi'
import { mockScanSummaryResponse } from '../testutils/mocks/xrayBodyScansApi'

jest.mock('../data/prisonerSearchApiClient')
jest.mock('../data/xrayBodyScansApiClient')
jest.mock('../services/auditService')

const auditService = jest.mocked(new AuditService({} as never))
const prisonerSearchApiClient = jest.mocked(new PrisonerSearchApiClient({} as never))
const xrayBodyScansApiClient = jest.mocked(new XrayBodyScansApiClient({} as never))
const services: Services = {
  applicationInfo: {} as never,
  auditService,
  prisonerSearchApiClient,
  xrayBodyScansApiClient,
}

const prisonerNumber = 'A1234BC'

let app: Express

const unauthorisedUser = { ...user, token: createUserToken([]) }

beforeEach(() => {
  auditService.logPageView.mockResolvedValue(undefined)
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
      .get(`/prisoner/${prisonerNumber}/scans`)
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
      mockScanSummaryResponse({ prisonerNumber, now: new Date() }),
    )
    xrayBodyScansApiClient.listScans.mockResolvedValueOnce(emptyPageResponse())

    return request(app).get(`/prisoner/${prisonerNumber}/scans`).expect(200)
  })

  it('should show 404 page when prisoner is not found', () => {
    app = appWithAllRoutes({ services })
    prisonerSearchApiClient.getPrisoner.mockReset()
    prisonerSearchApiClient.getPrisoner.mockResolvedValueOnce(null)

    return request(app)
      .get(`/prisoner/${prisonerNumber}/scans`)
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
      .get(`/prisoner/${prisonerNumber}/scans`)
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
      .expect('Location', `/prisoner/${prisonerNumber}/scans`)
      .expect(() => {
        expect(prisonerSearchApiClient.getPrisoner).toHaveBeenCalledWith(prisonerNumber, 'user1')
        expect(xrayBodyScansApiClient.getScanSummary).not.toHaveBeenCalled()
        expect(xrayBodyScansApiClient.listScans).not.toHaveBeenCalled()
      })
  })
})
