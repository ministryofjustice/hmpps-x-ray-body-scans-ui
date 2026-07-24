import nock from 'nock'
import type { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import XrayBodyScansApiClient, { type CreateScanRequest, type ScanResponse } from './xrayBodyScansApiClient'
import config from '../config'

const sampleId = '019f94a7-17cd-746f-b1df-5d4848da42e1'
const now = new Date().toISOString()

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

  describe('createScan', () => {
    it('should post to create a scan using a system token and return the response', async () => {
      const prisonerNumber = 'A1234BC'
      const scanData: CreateScanRequest = {
        prisonId: 'LEI',
        scanDate: '2026-07-01',
        justification: 'INTELLIGENCE',
        outcome: 'NEGATIVE',
        createdBy: 'abc12a',
      }
      const username = 'bob'
      const expectedResponse: ScanResponse = {
        id: sampleId,
        prisonerNumber,
        prisonId: scanData.prisonId,
        scanDate: scanData.scanDate,
        justification: scanData.justification,
        justificationDescription: 'Intelligence',
        outcome: scanData.outcome,
        outcomeDescription: 'Negative',
        typeOfFind: null,
        typeOfFindDescription: null,
        caseNoteId: null,
        mergedFromPrisonerNumber: null,
        mergedAt: null,
        createdAt: now,
        createdBy: scanData.createdBy,
        lastModifiedAt: now,
        lastModifiedBy: scanData.createdBy,
      }

      nock(config.apis.xrayBodyScansApi.url)
        .post(`/prisoner/${prisonerNumber}/scan`)
        .matchHeader('authorization', 'Bearer test-system-token')
        .reply(201, expectedResponse)

      const response = await xrayBodyScansApiClient.createScan(prisonerNumber, scanData, username)

      expect(response).toEqual(expectedResponse)
      expect(mockAuthenticationClient.getToken).toHaveBeenCalledWith(username)
    })
  })
})
