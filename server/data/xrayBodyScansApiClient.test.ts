import nock from 'nock'
import type { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import XrayBodyScansApiClient from './xrayBodyScansApiClient'
import config from '../config'

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
      const scanData = { scanDate: '2026-01-01' }
      const username = 'bob'
      const expectedResponse = { id: 1, prisonerNumber, scanDate: scanData.scanDate }

      nock(config.apis.xrayBodyScansApi.url)
        .post(`/prisoner/${prisonerNumber}/scan`, scanData)
        .matchHeader('authorization', 'Bearer test-system-token')
        .reply(201, expectedResponse)

      const response = await xrayBodyScansApiClient.createScan(prisonerNumber, scanData, username)

      expect(response).toEqual(expectedResponse)
      expect(mockAuthenticationClient.getToken).toHaveBeenCalledWith(username)
    })
  })
})
