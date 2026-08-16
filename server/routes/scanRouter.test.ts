import type { Express } from 'express'
import request from 'supertest'
import { appWithAllRoutes, user } from './testutils/appSetup'
import createUserToken from '../testutils/createUserToken'
import { emptyPageResponse } from '../testutils/pagination'
import AuditService from '../services/auditService'
import HmppsAuditClient from '../data/hmppsAuditClient'
import { PrisonerSearchApiClient } from '../data/prisonerSearchApiClient'
import { XrayBodyScansApiClient } from '../data/xrayBodyScansApiClient'
import { mockPrisoner } from '../testutils/mocks/prisonerSearchApiClient'
import { mockScanSummaryResponse } from '../testutils/mocks/xrayBodyScansApiClient'

jest.mock('../services/auditService')
jest.mock('../data/prisonerSearchApiClient')
jest.mock('../data/xrayBodyScansApiClient')

const auditService = new AuditService({} as HmppsAuditClient) as jest.Mocked<AuditService>
const prisonerSearchApiClient = new PrisonerSearchApiClient(undefined as never) as jest.Mocked<PrisonerSearchApiClient>
const xrayBodyScansApiClient = new XrayBodyScansApiClient(undefined as never) as jest.Mocked<XrayBodyScansApiClient>

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

describe('scan router authorisation', () => {
  it('should redirect to authError when the user does not have the DPS_APPLICATION_DEVELOPER role', () => {
    app = appWithAllRoutes({
      services: { auditService, prisonerSearchApiClient, xrayBodyScansApiClient },
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
    app = appWithAllRoutes({
      services: { auditService, prisonerSearchApiClient, xrayBodyScansApiClient },
    })
    xrayBodyScansApiClient.getScanSummary.mockResolvedValueOnce(
      mockScanSummaryResponse({ prisonerNumber, now: new Date() }),
    )
    xrayBodyScansApiClient.listScans.mockResolvedValueOnce(emptyPageResponse())

    return request(app).get(`/prisoner/${prisonerNumber}/scans`).expect(200)
  })

  it('should show 404 page when prisoner is not found', () => {
    app = appWithAllRoutes({
      services: { auditService, prisonerSearchApiClient, xrayBodyScansApiClient },
    })
    prisonerSearchApiClient.getPrisoner.mockReset()
    prisonerSearchApiClient.getPrisoner.mockResolvedValueOnce(null)

    return request(app)
      .get(`/prisoner/${prisonerNumber}/scans`)
      .expect(404)
      .expect(() => {
        expect(xrayBodyScansApiClient.getScanSummary).not.toHaveBeenCalled()
        expect(xrayBodyScansApiClient.listScans).not.toHaveBeenCalled()
      })
  })

  it('should redirect to DPS home page when user has no active caseload', () => {
    app = appWithAllRoutes({
      services: { auditService, prisonerSearchApiClient, xrayBodyScansApiClient },
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
})
