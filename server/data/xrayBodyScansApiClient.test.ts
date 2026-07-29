import nock from 'nock'
import type { Interceptor } from 'nock'
import type { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import config from '../config'
import { convertRawScanResponse, convertRawScanSummaryResponse, XrayBodyScansApiClient } from './xrayBodyScansApiClient'
import type { CreateScanRequest, ListScansRequest, ScanResponse } from './interfaces/xrayBodyScansApiClient'

const now = new Date()
const nowString = now.toISOString()

const prisonerNumber = 'A1234BC'
const prisonId = 'LEI'
const username = 'abc12a'
const sampleId = '019f94a7-17cd-746f-b1df-5d4848da42e1'

const scanResponse: ScanResponse = {
  id: sampleId,
  prisonerNumber,
  prisonId,
  scanDate: new Date(2026, 6, 20, 12),
  justification: 'REASONABLE_SUSPICION',
  justificationDescription: 'Reasonable suspicion',
  outcome: 'POSITIVE',
  outcomeDescription: 'Item detected',
  typeOfFind: 'INORGANIC',
  typeOfFindDescription: 'Inorganic',
  caseNoteId: null,
  mergedFromPrisonerNumber: null,
  mergedAt: null,
  createdAt: now,
  createdBy: username,
  lastModifiedAt: now,
  lastModifiedBy: username,
}

describe('XrayBodyScansApiClient', () => {
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
    it('should send request', async () => {
      nock(config.apis.xrayBodyScansApi.url)
        .get(`/prisoner/${prisonerNumber}/scan/summary`)
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
          fromScanDate: '2026-01-01', // UTC+0
          toScanDate: '2026-07-31', // UTC+1
        })

      const response = await xrayBodyScansApiClient.getScanSummary(prisonerNumber, username)
      expect(response.fromScanDate).toBeInstanceOf(Date)
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
            createdAt: nowString,
            lastModifiedAt: nowString,
          },
        ],
        totalElements: 1,
        totalPages: 1,
        number: 0,
        size: 20,
      })

      const response = await xrayBodyScansApiClient.listScans(prisonerNumber, request, username)
      expect(response).toHaveLength(1)
      expect(response[0].createdAt).toBeInstanceOf(Date)
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
