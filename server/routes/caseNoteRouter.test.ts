import type { Express } from 'express'
import request from 'supertest'
import {
  CaseNotesPermission,
  PrisonerBasePermission,
  XRayBodyScansPermission,
} from '@ministryofjustice/hmpps-prison-permissions-lib'
import { appWithAllRoutes } from './testutils/appSetup'
import { mockAuditService } from '../testutils/mocks/auditService'
import {
  mockGrantNoPrisonerPermissions,
  mockGrantPrisonerPermissions,
} from '../testutils/mocks/prisonPermissionsService'
import { mockPrisoner } from '../testutils/mocks/prisonerSearchApi'
import { mockServices } from '../testutils/mocks/services'
import { mockScanResponse, mockScanCaseNoteResponse } from '../testutils/mocks/xrayBodyScansApi'
import { canAddCaseNotToScan } from '../utils/scanPermissions'

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
jest.mock('../utils/scanPermissions')

const { auditService, prisonerSearchApiClient, xrayBodyScansApiClient } = mockServices
const mockedCanAddCaseNotToScan = jest.mocked(canAddCaseNotToScan)

const prisonerNumber = 'A1234BC'

let app: Express

beforeEach(() => {
  mockAuditService(auditService)
  prisonerSearchApiClient.getPrisoner.mockResolvedValueOnce(mockPrisoner(prisonerNumber))
  mockedCanAddCaseNotToScan.mockImplementation(() => {
    throw Error('should not be called')
  })
})

afterEach(() => {
  jest.resetAllMocks()
})

describe('case note router', () => {
  describe('view case note', () => {
    const scan = mockScanResponse(prisonerNumber, new Date())
    const caseNote = mockScanCaseNoteResponse(scan)
    scan.caseNoteId = caseNote.id
    const url = `/prisoner/${prisonerNumber}/scan/${scan.id}/case-note`

    beforeEach(() => {
      mockGrantPrisonerPermissions(PrisonerBasePermission.read, XRayBodyScansPermission.read_scans)
      xrayBodyScansApiClient.getScan.mockResolvedValueOnce(scan)
      xrayBodyScansApiClient.getScanCaseNote.mockResolvedValueOnce(caseNote)
    })

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
          expect(xrayBodyScansApiClient.getScan).not.toHaveBeenCalled()
          expect(xrayBodyScansApiClient.getScanCaseNote).not.toHaveBeenCalled()
        })
    })

    it('should allow access when permission is granted', () => {
      app = appWithAllRoutes({ services: mockServices })

      return request(app)
        .get(url)
        .expect(200)
        .expect(res => {
          expect(res.text).toContain('X-ray body scan')
          expect(prisonerSearchApiClient.getPrisoner).toHaveBeenCalledWith(prisonerNumber, 'user1')
          expect(xrayBodyScansApiClient.getScan).toHaveBeenCalledWith(scan.id, 'user1')
          expect(xrayBodyScansApiClient.getScanCaseNote).toHaveBeenCalledWith(scan.id, 'user1')
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
          expect(xrayBodyScansApiClient.getScan).not.toHaveBeenCalled()
          expect(xrayBodyScansApiClient.getScanCaseNote).not.toHaveBeenCalled()
        })
    })

    it('should show 404 page when scan is not found', () => {
      app = appWithAllRoutes({ services: mockServices })
      xrayBodyScansApiClient.getScan.mockReset()
      xrayBodyScansApiClient.getScan.mockResolvedValueOnce(null)

      return request(app)
        .get(url)
        .expect(404)
        .expect(() => {
          expect(prisonerSearchApiClient.getPrisoner).toHaveBeenCalledWith(prisonerNumber, 'user1')
          expect(xrayBodyScansApiClient.getScan).toHaveBeenCalledWith(scan.id, 'user1')
          expect(xrayBodyScansApiClient.getScanCaseNote).not.toHaveBeenCalled()
        })
    })
  })

  describe('add case note', () => {
    const scan = mockScanResponse(prisonerNumber, new Date())
    const url = `/prisoner/${prisonerNumber}/scan/${scan.id}/add-a-scan-case-note`

    beforeEach(() => {
      mockGrantPrisonerPermissions(
        PrisonerBasePermission.read,
        XRayBodyScansPermission.read_scans,
        CaseNotesPermission.read,
      )
      mockedCanAddCaseNotToScan.mockReturnValue(true)
      xrayBodyScansApiClient.getScan.mockResolvedValueOnce(scan)
    })

    it.each([
      { scenario: 'fails base check', grantPermissions: mockGrantNoPrisonerPermissions, checkedAfterScanLoaded: false },
      {
        scenario: 'fails x-ray body scans default check',
        grantPermissions: () => mockGrantPrisonerPermissions(PrisonerBasePermission.read),
        checkedAfterScanLoaded: false,
      },
      {
        scenario: 'fails case note check',
        grantPermissions: () =>
          mockGrantPrisonerPermissions(PrisonerBasePermission.read, XRayBodyScansPermission.read_scans),
        checkedAfterScanLoaded: true,
      },
    ])(
      'should redirect to auth error page when unauthorised: $scenario',
      ({ grantPermissions, checkedAfterScanLoaded }) => {
        grantPermissions()
        app = appWithAllRoutes({ services: mockServices })

        return request(app)
          .get(url)
          .expect(302)
          .expect('Location', '/authError')
          .expect(() => {
            expect(prisonerSearchApiClient.getPrisoner).toHaveBeenCalledWith(prisonerNumber, 'user1')
            if (checkedAfterScanLoaded) {
              expect(xrayBodyScansApiClient.getScan).toHaveBeenCalledWith(scan.id, 'user1')
            } else {
              expect(xrayBodyScansApiClient.getScan).not.toHaveBeenCalled()
            }
          })
      },
    )

    it('should redirect to auth error page when it is unauthorised to add a case note to this scan', () => {
      app = appWithAllRoutes({ services: mockServices })
      mockedCanAddCaseNotToScan.mockReturnValue(false)

      return request(app)
        .get(url)
        .expect(302)
        .expect('Location', '/authError')
        .expect(() => {
          expect(prisonerSearchApiClient.getPrisoner).toHaveBeenCalledWith(prisonerNumber, 'user1')
          expect(xrayBodyScansApiClient.getScan).toHaveBeenCalledWith(scan.id, 'user1')
        })
    })

    it('should allow access when permission is granted', () => {
      app = appWithAllRoutes({ services: mockServices })

      return request(app)
        .get(url)
        .expect(200)
        .expect(res => {
          expect(res.text).toContain('Add an X-ray body scan case note')
          expect(prisonerSearchApiClient.getPrisoner).toHaveBeenCalledWith(prisonerNumber, 'user1')
          expect(xrayBodyScansApiClient.getScan).toHaveBeenCalledWith(scan.id, 'user1')
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
          expect(xrayBodyScansApiClient.getScan).not.toHaveBeenCalled()
        })
    })

    it('should show 404 page when scan is not found', () => {
      app = appWithAllRoutes({ services: mockServices })
      xrayBodyScansApiClient.getScan.mockReset()
      xrayBodyScansApiClient.getScan.mockResolvedValueOnce(null)

      return request(app)
        .get(url)
        .expect(404)
        .expect(() => {
          expect(prisonerSearchApiClient.getPrisoner).toHaveBeenCalledWith(prisonerNumber, 'user1')
          expect(xrayBodyScansApiClient.getScan).toHaveBeenCalledWith(scan.id, 'user1')
        })
    })
  })
})
