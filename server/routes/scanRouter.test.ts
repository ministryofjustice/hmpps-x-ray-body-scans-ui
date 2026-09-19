import type { Express } from 'express'
import request from 'supertest'
import { PrisonerBasePermission, XRayBodyScansPermission } from '@ministryofjustice/hmpps-prison-permissions-lib'
import { appWithAllRoutes, user } from './testutils/appSetup'
import { emptyPageResponse } from '../testutils/pagination'
import { mockAuditService } from '../testutils/mocks/auditService'
import {
  mockGrantNoPrisonerPermissions,
  mockGrantPrisonerPermissions,
} from '../testutils/mocks/prisonPermissionsService'
import { mockPrisonNamesImpl } from '../testutils/mocks/prisonService'
import { mockPrisoner } from '../testutils/mocks/prisonerSearchApi'
import { mockServices } from '../testutils/mocks/services'
import { mockScanSummaryResponse } from '../testutils/mocks/xrayBodyScansApi'

jest.mock('@ministryofjustice/hmpps-prison-permissions-lib', () => {
  // ensure permissions library is properly installed into nunjucks environment
  type Module = typeof import('@ministryofjustice/hmpps-prison-permissions-lib')
  const realModule = jest.requireActual<Module>('@ministryofjustice/hmpps-prison-permissions-lib')
  const mockedModule = jest.createMockFromModule<Module>('@ministryofjustice/hmpps-prison-permissions-lib')
  return { ...mockedModule, setupNunjucksPermissions: realModule.setupNunjucksPermissions }
})
jest.mock('../data/prisonApi')
jest.mock('../data/prisonerSearchApiClient')
jest.mock('../data/xrayBodyScansApiClient')
jest.mock('../services/auditService')
jest.mock('../services/prisonService')

const { auditService, prisonService, prisonerSearchApiClient, xrayBodyScansApiClient } = mockServices

const prisonerNumber = 'A1234BC'

let app: Express

beforeEach(() => {
  mockAuditService(auditService)
  mockGrantPrisonerPermissions(PrisonerBasePermission.read, XRayBodyScansPermission.read_scans)
  prisonService.getPrisonNames.mockImplementation(mockPrisonNamesImpl)
  prisonerSearchApiClient.getPrisoner.mockResolvedValueOnce(mockPrisoner(prisonerNumber))
})

afterEach(() => {
  jest.resetAllMocks()
})

describe('scan router', () => {
  describe('overview page', () => {
    const url = `/prisoner/${prisonerNumber}/scan-overview`

    it.each([
      { scenario: 'fails base check', grantPermissions: mockGrantNoPrisonerPermissions },
      {
        scenario: 'fails x-ray body scans default check',
        grantPermissions: () => mockGrantPrisonerPermissions(PrisonerBasePermission.read),
      },
    ])('should redirect to auth error page when unauthorised: $scenario', ({ grantPermissions }) => {
      grantPermissions()
      app = appWithAllRoutes({ services: mockServices })

      return request(app)
        .get(url)
        .expect(302)
        .expect('Location', '/authError')
        .expect(() => {
          expect(prisonerSearchApiClient.getPrisoner).toHaveBeenCalledWith(prisonerNumber, 'user1')
          expect(xrayBodyScansApiClient.getScanSummary).not.toHaveBeenCalled()
          expect(xrayBodyScansApiClient.listScans).not.toHaveBeenCalled()
        })
    })

    it('should allow access when permission is granted', () => {
      app = appWithAllRoutes({ services: mockServices })
      xrayBodyScansApiClient.getScanSummary.mockResolvedValueOnce(
        mockScanSummaryResponse({ prisonerNumber, now: new Date(), relevantAlerts: [] }),
      )
      xrayBodyScansApiClient.listScans.mockResolvedValueOnce(emptyPageResponse())

      return request(app)
        .get(url)
        .expect(200)
        .expect(res => {
          expect(res.text).toContain('X-ray body scans')
          expect(prisonerSearchApiClient.getPrisoner).toHaveBeenCalledWith(prisonerNumber, 'user1')
          expect(xrayBodyScansApiClient.getScanSummary).toHaveBeenCalled()
          expect(xrayBodyScansApiClient.listScans).toHaveBeenCalled()
        })
    })

    it('should show 404 page when prisoner is not found', () => {
      app = appWithAllRoutes({ services: mockServices })
      prisonerSearchApiClient.getPrisoner.mockReset()
      prisonerSearchApiClient.getPrisoner.mockResolvedValueOnce(null)

      return request(app)
        .get(url)
        .expect(404)
        .expect(() => {
          expect(prisonerSearchApiClient.getPrisoner).toHaveBeenCalledWith(prisonerNumber, 'user1')
          expect(xrayBodyScansApiClient.getScanSummary).not.toHaveBeenCalled()
          expect(xrayBodyScansApiClient.listScans).not.toHaveBeenCalled()
        })
    })

    it('should redirect to DPS home page when user has no active caseload', () => {
      app = appWithAllRoutes({
        services: mockServices,
        userSupplier: () => ({ ...user, activeCaseLoadId: undefined }),
      })

      return request(app)
        .get(url)
        .expect(302)
        .expect('Location', 'http://localhost:3001/dps-home')
        .expect(() => {
          expect(prisonerSearchApiClient.getPrisoner).not.toHaveBeenCalled()
          expect(xrayBodyScansApiClient.getScanSummary).not.toHaveBeenCalled()
          expect(xrayBodyScansApiClient.listScans).not.toHaveBeenCalled()
        })
    })
  })

  describe('recording page', () => {
    // TODO: record perms
  })

  it('should redirect to scans list when trying to go to person’s link', () => {
    app = appWithAllRoutes({ services: mockServices })

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
