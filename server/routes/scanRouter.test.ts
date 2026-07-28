import type { Express } from 'express'
import request from 'supertest'
import { appWithAllRoutes, user } from './testutils/appSetup'
import AuditService, { Page } from '../services/auditService'
import HmppsAuditClient from '../data/hmppsAuditClient'
import { XrayBodyScansApiClient } from '../data/xrayBodyScansApiClient'
import createUserToken from '../testutils/createUserToken'

jest.mock('../services/auditService')
jest.mock('../data/xrayBodyScansApiClient')

const auditService = new AuditService({} as HmppsAuditClient) as jest.Mocked<AuditService>
const xrayBodyScansApiClient = new XrayBodyScansApiClient(
  undefined as unknown as ConstructorParameters<typeof XrayBodyScansApiClient>[0],
) as jest.Mocked<XrayBodyScansApiClient>

const prisonerNumber = 'A1234BC'

let app: Express

const authorisedUser = { ...user, token: createUserToken(['ROLE_DPS_APPLICATION_DEVELOPER']) }
const unauthorisedUser = { ...user, token: createUserToken([]) }

beforeEach(() => {
  auditService.logPageView.mockResolvedValue(undefined)
})

afterEach(() => {
  jest.resetAllMocks()
})

describe('scan router authorisation', () => {
  it('should redirect to authError when the user does not have the DPS_APPLICATION_DEVELOPER role', () => {
    app = appWithAllRoutes({
      services: { auditService, xrayBodyScansApiClient },
      userSupplier: () => unauthorisedUser,
    })

    return request(app).get(`/prisoner/${prisonerNumber}/scans`).expect(302).expect('Location', '/authError')
  })
})

describe('GET /prisoner/:prisonerNumber/scans', () => {
  beforeEach(() => {
    app = appWithAllRoutes({
      services: { auditService, xrayBodyScansApiClient },
      userSupplier: () => authorisedUser,
    })
  })

  it('should render the scan list page and log a page view audit event', () => {
    xrayBodyScansApiClient.getScanSummary.mockResolvedValue({
      prisonerNumber,
      nomisCount: 0,
      dpsCount: 6,
      totalCount: 6,
      positiveCount: 1,
      negativeCount: 2,
      inconclusiveCount: 3,
      annualLimit: 12,
      remainingScans: 6,
      fromScanDate: new Date('2025-07-27T12:00:00'),
      toScanDate: new Date('2026-07-27T12:00:00'),
    })
    xrayBodyScansApiClient.listScans.mockResolvedValue([
      {
        id: '1',
        prisonerNumber,
        prisonId: 'TODO',
        scanDate: new Date('2026-07-27T12:00:00'),
        justification: 'REASONABLE_SUSPICION',
        justificationDescription: 'Reasonable suspicion',
        outcome: 'POSITIVE',
        outcomeDescription: 'Item detected',
        typeOfFind: 'ORGANIC',
        typeOfFindDescription: 'Organic',
        caseNoteId: null,
        mergedFromPrisonerNumber: null,
        mergedAt: null,
        createdAt: new Date('2026-07-27T12:00:00'),
        createdBy: authorisedUser.username,
        lastModifiedAt: new Date('2026-07-27T12:00:00'),
        lastModifiedBy: authorisedUser.username,
      },
    ])

    return request(app)
      .get(`/prisoner/${prisonerNumber}/scans`)
      .expect('Content-Type', /html/)
      .expect(200)
      .expect(res => {
        expect(res.text).toContain('X-ray body scans')
        expect(auditService.logPageView).toHaveBeenCalledWith(Page.SCAN_LIST, {
          who: authorisedUser.username,
          subjectId: prisonerNumber,
          subjectType: 'PRISONER_ID',
          correlationId: expect.any(String),
        })
      })
  })
})

describe('GET /prisoner/:prisonerNumber/create-scan', () => {
  it('should render the create scan page and log a page view audit event', () => {
    app = appWithAllRoutes({
      services: { auditService, xrayBodyScansApiClient },
      userSupplier: () => authorisedUser,
    })

    return request(app)
      .get(`/prisoner/${prisonerNumber}/create-scan`)
      .expect('Content-Type', /html/)
      .expect(200)
      .expect(res => {
        expect(res.text).toContain('Record an x-ray body scan for')
        expect(auditService.logPageView).toHaveBeenCalledWith(Page.CREATE_SCAN, {
          who: authorisedUser.username,
          subjectId: prisonerNumber,
          subjectType: 'PRISONER_ID',
          correlationId: expect.any(String),
        })
      })
  })
})

describe('POST /prisoner/:prisonerNumber/create-scan', () => {
  it('should create the scan and redirect to the success page', () => {
    app = appWithAllRoutes({
      services: { auditService, xrayBodyScansApiClient },
      userSupplier: () => authorisedUser,
    })
    xrayBodyScansApiClient.createScan.mockResolvedValue({
      id: '42',
      prisonerNumber,
      prisonId: 'TODO',
      scanDate: new Date('2026-07-27T12:00:00'),
      justification: 'REASONABLE_SUSPICION',
      justificationDescription: 'Reasonable suspicion',
      outcome: 'NEGATIVE',
      outcomeDescription: 'No item detected',
      typeOfFind: null,
      typeOfFindDescription: null,
      caseNoteId: null,
      mergedFromPrisonerNumber: null,
      mergedAt: null,
      createdAt: new Date('2026-07-27T12:00:00'),
      createdBy: authorisedUser.username,
      lastModifiedAt: new Date('2026-07-27T12:00:00'),
      lastModifiedBy: authorisedUser.username,
    })

    return request(app)
      .post(`/prisoner/${prisonerNumber}/create-scan`)
      .send({ scanDateOption: 'other', 'scanDate-day': '27', 'scanDate-month': '7', 'scanDate-year': '2026' })
      .expect(302)
      .expect('Location', `/prisoner/${prisonerNumber}/create-scan/success?scanId=42&scanDate=2026-07-27`)
  })
})

describe('GET /prisoner/:prisonerNumber/create-scan/success', () => {
  it('should render the success page and log a page view audit event', () => {
    app = appWithAllRoutes({
      services: { auditService, xrayBodyScansApiClient },
      userSupplier: () => authorisedUser,
    })

    return request(app)
      .get(`/prisoner/${prisonerNumber}/create-scan/success`)
      .expect('Content-Type', /html/)
      .expect(200)
      .expect(res => {
        expect(res.text).toContain('Scan details')
        expect(auditService.logPageView).toHaveBeenCalledWith(Page.CREATE_SCAN_SUCCESS, {
          who: authorisedUser.username,
          subjectId: prisonerNumber,
          subjectType: 'PRISONER_ID',
          correlationId: expect.any(String),
        })
      })
  })
})
