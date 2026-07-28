import type { Express } from 'express'
import request from 'supertest'
import { appWithAllRoutes, user } from './testutils/appSetup'
import AuditService from '../services/auditService'
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

  it('should allow access when the user has the DPS_APPLICATION_DEVELOPER role', () => {
    app = appWithAllRoutes({
      services: { auditService, xrayBodyScansApiClient },
      userSupplier: () => authorisedUser,
    })
    xrayBodyScansApiClient.getScanSummary.mockResolvedValue({
      prisonerNumber,
      nomisCount: 0,
      dpsCount: 0,
      totalCount: 0,
      positiveCount: 0,
      negativeCount: 0,
      inconclusiveCount: 0,
      annualLimit: 116,
      remainingScans: 116,
      fromScanDate: new Date('2025-07-27T12:00:00'),
      toScanDate: new Date('2026-07-27T12:00:00'),
    })
    xrayBodyScansApiClient.listScans.mockResolvedValue([])

    return request(app).get(`/prisoner/${prisonerNumber}/scans`).expect(200)
  })
})
