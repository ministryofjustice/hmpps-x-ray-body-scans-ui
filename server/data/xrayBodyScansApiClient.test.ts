import nock from 'nock'
import type { Interceptor } from 'nock'
import type { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import config from '../config'
import { internalServerErrorResponse, notFoundErrorResponse } from '../testutils/mocks/errorResponse'
import { fixedClock, now, yesterday } from '../testutils/fixedClock'
import { mockScanResponse, mockLegacyScanResponse, mockScanCaseNoteResponse } from '../testutils/mocks/xrayBodyScansApi'
import {
  convertRawScanCaseNoteResponse,
  convertRawScanResponse,
  convertRawScanSummaryResponse,
  XrayBodyScansApiClient,
} from './xrayBodyScansApiClient'
import type {
  CreateScanCaseNoteRequest,
  CreateScanRequest,
  LegacyScanResponse,
  ListScansRequest,
  ScanResponse,
} from './interfaces/xrayBodyScansApi'

beforeAll(() => {
  fixedClock()
})

const nowString = '2026-07-24T11:07:41.000Z'

const prisonerNumber = 'A1234BC'
const prisonId = 'LEI'
const username = 'abc12a'
const scanDate = yesterday
const scanDateString = '2026-07-23'

describe('X-ray body scans API client', () => {
  const scanResponse: ScanResponse = {
    ...mockScanResponse(prisonerNumber, scanDate, prisonId, username),
    caseNoteId: 'd971493e-d961-40d9-9c3b-7b564cb6a9c2',
    createdAt: now,
    lastModifiedAt: now,
  }
  const scanId = scanResponse.id
  const legacyScanResponse: LegacyScanResponse = mockLegacyScanResponse(prisonerNumber, scanDate, 'pos')
  const caseNoteResponse = {
    ...mockScanCaseNoteResponse(scanResponse),
    createdAt: now,
  }

  let xrayBodyScansApiClient: XrayBodyScansApiClient
  let mockAuthenticationClient: jest.Mocked<AuthenticationClient>

  beforeEach(() => {
    mockAuthenticationClient = {
      getToken: jest.fn().mockResolvedValue('test-system-token'),
    } as unknown as jest.Mocked<AuthenticationClient>

    xrayBodyScansApiClient = new XrayBodyScansApiClient(mockAuthenticationClient)
  })

  afterEach(() => {
    nock.cleanAll()
    jest.resetAllMocks()
  })

  describe('raw response conversion', () => {
    it('should convert scans', () => {
      let response = convertRawScanResponse({
        ...scanResponse,
        scanDate: '2026-07-23',
        mergedAt: null,
        createdAt: '2026-07-24T12:07:41',
        lastModifiedAt: '2026-07-24T11:07:41Z',
      })
      expect(response.scanDate).toBeInstanceOf(Date)
      expect(response.mergedAt).toBeNull()
      expect(response.createdAt).toBeInstanceOf(Date)
      expect(response.lastModifiedAt).toBeInstanceOf(Date)

      response = convertRawScanResponse({
        ...scanResponse,
        scanDate: '2026-07-23',
        mergedAt: '2026-07-24T12:07:41+01:00',
        createdAt: '2026-07-24T12:07:41',
        lastModifiedAt: '2026-07-24T11:07:41Z',
      })
      expect(response.scanDate).toBeInstanceOf(Date)
      expect(response.mergedAt).toBeInstanceOf(Date)
      expect(response.createdAt).toBeInstanceOf(Date)
      expect(response.lastModifiedAt).toBeInstanceOf(Date)
      expect(response.scanDate.getDate()).toEqual(23)
      expect(response.mergedAt!.getUTCHours()).toEqual(11)
      expect(response.createdAt.getHours()).toEqual(12)
      expect(response.lastModifiedAt.getUTCHours()).toEqual(11)

      let legacyResponse = convertRawScanResponse({
        ...legacyScanResponse,
        scanDate: '2026-07-23',
      })
      expect(legacyResponse.scanDate).toBeInstanceOf(Date)
      legacyResponse = convertRawScanResponse({
        ...legacyScanResponse,
        scanDate: null,
      })
      expect(legacyResponse.scanDate).toBeNull()
    })

    it('should convert case notes', () => {
      const response = convertRawScanCaseNoteResponse({
        ...caseNoteResponse,
        createdAt: '2026-07-24T12:07:41',
        occurredAt: '2026-07-23T00:00:00',
      })
      expect(response.createdAt).toBeInstanceOf(Date)
      expect(response.occurredAt).toBeInstanceOf(Date)
    })

    it('should convert scan summaries', () => {
      const response = convertRawScanSummaryResponse({
        prisonerNumber,
        nomisCount: 0,
        dpsCount: 0,
        totalCount: 0,
        negativeCount: 0,
        inconclusiveCount: 0,
        positiveCount: 0,
        annualLimit: 116,
        remainingScans: 116,
        nearingScanLimit: false,
        atScanLimit: false,
        relevantAlerts: null,
        fromScanDate: '2026-01-01', // UTC+0
        toScanDate: '2026-07-31', // UTC+1
      })
      expect(response.fromScanDate).toBeInstanceOf(Date)
      expect(response.fromScanDate.getMonth()).toEqual(0)
      expect(response.fromScanDate.getDate()).toEqual(1)
      expect(response.toScanDate).toBeInstanceOf(Date)
      expect(response.toScanDate.getMonth()).toEqual(6)
      expect(response.toScanDate.getDate()).toEqual(31)
    })
  })

  describe('getScanSummary', () => {
    it.each([true, false])('should send request with alerts: %s', async includeAlerts => {
      nock(config.apis.xrayBodyScansApi.url)
        .get(`/prisoner/${prisonerNumber}/scan/summary`)
        .query({ includeAlerts })
        .matchHeader('authorization', 'Bearer test-system-token')
        .reply(200, {
          prisonerNumber,
          nomisCount: 0,
          dpsCount: 2,
          totalCount: 2,
          negativeCount: 1,
          inconclusiveCount: 0,
          positiveCount: 1,
          annualLimit: 116,
          remainingScans: 114,
          nearingScanLimit: false,
          atScanLimit: false,
          relevantAlerts: includeAlerts ? [] : null,
          fromScanDate: '2026-01-01', // UTC+0
          toScanDate: '2026-07-31', // UTC+1
        })

      const response = await xrayBodyScansApiClient.getScanSummary(prisonerNumber, { includeAlerts }, username)
      expect(response.fromScanDate).toBeInstanceOf(Date)
    })
  })

  describe('getScan', () => {
    it('should return a scan', async () => {
      nock(config.apis.xrayBodyScansApi.url)
        .get(`/scan/${scanId}`)
        .reply(200, { ...scanResponse, scanDate: scanDateString, createdAt: nowString, lastModifiedAt: nowString })
      const response = await xrayBodyScansApiClient.getScan(scanId, username)
      const expected = {
        ...scanResponse,
        scanDate: expect.any(Date),
      }
      expect(response).toEqual(expected)
    })

    it('should return null instead of a 404', async () => {
      nock(config.apis.xrayBodyScansApi.url).get(`/scan/${scanId}`).reply(404, notFoundErrorResponse)
      const response = await xrayBodyScansApiClient.getScan(scanId, username)
      expect(response).toBeNull()
    })

    it('should throw for non-404 errors', async () => {
      nock(config.apis.xrayBodyScansApi.url).get(`/scan/${scanId}`).times(5).reply(500, internalServerErrorResponse)
      await expect(xrayBodyScansApiClient.getScan(scanId, username)).rejects.toThrow('Internal Server Error')
    })
  })

  describe('getScanCaseNote', () => {
    it('should return a case note', async () => {
      nock(config.apis.xrayBodyScansApi.url)
        .get(`/scan/${scanId}/case-note`)
        .reply(200, { ...caseNoteResponse, occurredAt: `${scanDateString}T00:00:00`, createdAt: nowString })
      const response = await xrayBodyScansApiClient.getScanCaseNote(scanId, username)
      expect(response).toEqual(caseNoteResponse)
    })

    it('should return null instead of a 404', async () => {
      nock(config.apis.xrayBodyScansApi.url).get(`/scan/${scanId}/case-note`).reply(404, notFoundErrorResponse)
      const response = await xrayBodyScansApiClient.getScanCaseNote(scanId, username)
      expect(response).toBeNull()
    })

    it('should throw for non-404 errors', async () => {
      nock(config.apis.xrayBodyScansApi.url)
        .get(`/scan/${scanId}/case-note`)
        .times(5)
        .reply(500, internalServerErrorResponse)
      await expect(xrayBodyScansApiClient.getScanCaseNote(scanId, username)).rejects.toThrow('Internal Server Error')
    })
  })

  describe('createScanCaseNote', () => {
    it('should post to create a case note and return nothing', async () => {
      const request: CreateScanCaseNoteRequest = {
        text: 'nothing of interest detected',
      }

      nock(config.apis.xrayBodyScansApi.url)
        .post(`/scan/${scanId}/case-note`)
        .matchHeader('authorization', 'Bearer test-system-token')
        .reply(201, (_uri, body) => {
          expect(body).toEqual(request)
          return undefined
        })

      const response = await xrayBodyScansApiClient.createScanCaseNote(scanId, request, username)

      expect(response).toEqual({})
      expect(mockAuthenticationClient.getToken).toHaveBeenCalledWith(username)
    })
  })

  describe('listScans', () => {
    interface Scenario {
      scenario: string
      request: ListScansRequest
      expectedQueryParameters: Parameters<Interceptor['query']>[0] | undefined
    }
    const scenarios: Scenario[] = [
      { scenario: 'without filters', request: {}, expectedQueryParameters: undefined },
      {
        scenario: 'with date range filters',
        request: {
          fromScanDate: new Date(2026, 0, 1, 12),
          toScanDate: new Date(2026, 6, 31, 12),
        },
        expectedQueryParameters: { fromScanDate: '2026-01-01', toScanDate: '2026-07-31' },
      },
      {
        scenario: 'with pagination',
        request: {
          fromScanDate: new Date(2026, 0, 1, 12),
          page: 2,
          size: 10,
          sort: ['scanDate,DESC'],
        },
        expectedQueryParameters: { fromScanDate: '2026-01-01', page: 2, size: 10, sort: 'scanDate,DESC' },
      },
    ]
    it.each(scenarios)('should send request $scenario', async ({ request, expectedQueryParameters }) => {
      const mock = nock(config.apis.xrayBodyScansApi.url).get(`/prisoner/${prisonerNumber}/scan`)
      if (expectedQueryParameters) {
        mock.query(expectedQueryParameters)
      }
      mock.matchHeader('authorization', 'Bearer test-system-token').reply(200, {
        content: [
          {
            ...scanResponse,
            scanDate: scanDateString,
            createdAt: nowString,
            lastModifiedAt: nowString,
          },
          {
            ...legacyScanResponse,
            scanDate: scanDateString,
          },
        ],
        totalElements: 2,
        totalPages: 1,
        number: 0,
        size: 20,
      })

      const response = await xrayBodyScansApiClient.listScans(prisonerNumber, request, username)
      expect(response.content).toHaveLength(2)
      const [dpsScan, nomisScan] = response.content
      expect(dpsScan.source).toEqual('DPS')
      if (dpsScan.source === 'DPS') expect(dpsScan.scanDate).toBeInstanceOf(Date)
      expect(nomisScan.source).toEqual('NOMIS')
      if (nomisScan.source === 'NOMIS') expect(nomisScan.scanDate).toBeInstanceOf(Date)
    })
  })

  describe('createScan', () => {
    it('should post to create a scan using a system token and return the response', async () => {
      const scanData: CreateScanRequest = {
        prisonId,
        scanDate: '2026-07-01',
        justification: 'INTELLIGENCE',
        outcome: 'NEGATIVE',
        createdBy: username,
      }
      const expectedResponse: ScanResponse = {
        ...scanResponse,
        scanDate: new Date(2026, 6, 1, 12),
        justification: scanData.justification,
        justificationDescription: 'Intelligence',
        outcome: scanData.outcome,
        outcomeDescription: 'No item detected',
      }

      nock(config.apis.xrayBodyScansApi.url)
        .post(`/prisoner/${prisonerNumber}/scan`)
        .matchHeader('authorization', 'Bearer test-system-token')
        .reply(201, (_uri, body) => {
          expect(body).toEqual(scanData)
          return {
            ...expectedResponse,
            scanDate: scanData.scanDate,
            createdAt: nowString,
            lastModifiedAt: nowString,
          }
        })

      const response = await xrayBodyScansApiClient.createScan(prisonerNumber, scanData, username)

      expect(response).toEqual(expectedResponse)
      expect(mockAuthenticationClient.getToken).toHaveBeenCalledWith(username)
    })
  })
})
