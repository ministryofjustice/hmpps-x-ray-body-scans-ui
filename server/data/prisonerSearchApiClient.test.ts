import nock from 'nock'
import type { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import config from '../config'
import { internalServerErrorResponse, notFoundErrorResponse } from '../testutils/mocks/errorResponse'
import { PrisonerSearchApiClient } from './prisonerSearchApiClient'
import { mockPrisoner } from '../testutils/mocks/prisonerSearchApi'

describe('Prisoner search API client', () => {
  let prisonerSearchApiClient: PrisonerSearchApiClient
  let mockAuthenticationClient: jest.Mocked<AuthenticationClient>

  beforeEach(() => {
    mockAuthenticationClient = {
      getToken: jest.fn().mockResolvedValue('test-system-token'),
    } as unknown as jest.Mocked<AuthenticationClient>
    prisonerSearchApiClient = new PrisonerSearchApiClient(mockAuthenticationClient)
  })

  afterEach(() => {
    nock.cleanAll()
  })

  const prisonerNumber = 'G6123VU'
  const username = 'abc12a'

  function mockApiServer() {
    return nock(config.apis.prisonerSearchApi.url)
      .get(`/prisoner/${prisonerNumber}`)
      .matchHeader('authorization', 'Bearer test-system-token')
  }

  it('should return prisoner details', async () => {
    mockApiServer().reply(200, mockPrisoner(prisonerNumber))

    const prisoner = await prisonerSearchApiClient.getPrisoner(prisonerNumber, username)
    expect(prisoner?.prisonerNumber).toEqual(prisonerNumber)
  })

  it('should return null when prisoner not found', async () => {
    mockApiServer().reply(404, notFoundErrorResponse)

    const prisoner = await prisonerSearchApiClient.getPrisoner(prisonerNumber, username)
    expect(prisoner).toBeNull()
  })

  it('should throw when api returns an error', async () => {
    mockApiServer().times(5).reply(500, internalServerErrorResponse)

    await expect(prisonerSearchApiClient.getPrisoner(prisonerNumber, username)).rejects.toThrow('Internal Server Error')
  })
})
