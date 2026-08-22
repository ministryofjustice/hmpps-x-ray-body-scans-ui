import type { RedisClientType } from 'redis'
import type { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import logger from '../../logger'
import { PrisonRegisterApiClient } from '../data/prisonRegisterApiClient'
import { internalServerErrorResponse, mockThrownError } from '../testutils/mocks/errorResponse'
import { mockPrisonLEI, mockPrisonMDI } from '../testutils/mocks/prisonRegister'
import { PrisonService } from './prisonService'

jest.mock('redis')
jest.mock('../../logger')
jest.mock('../data/prisonRegisterApiClient')

describe('PrisonService', () => {
  let redisClient: jest.Mocked<RedisClientType>
  let prisonRegisterApiClient: jest.Mocked<PrisonRegisterApiClient>
  let prisonService: PrisonService

  beforeEach(() => {
    redisClient = {
      hmGet: jest.fn(),
      hSet: jest.fn(),
    } as unknown as jest.Mocked<RedisClientType>

    const mockAuthenticationClient = {
      getToken: jest.fn().mockResolvedValue('test-system-token'),
    } as unknown as AuthenticationClient
    prisonRegisterApiClient = jest.mocked(new PrisonRegisterApiClient(mockAuthenticationClient))

    prisonService = new PrisonService(prisonRegisterApiClient, redisClient)
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('should fetch prisons from redis cache when available', async () => {
    redisClient.hmGet.mockResolvedValueOnce(['Leeds (HMP & YOI)', 'Moorland (HMP & YOI)'])

    await expect(prisonService.getPrisonNames(['LEI', 'MDI'])).resolves.toEqual(
      new Map([
        ['LEI', 'Leeds (HMP & YOI)'],
        ['MDI', 'Moorland (HMP & YOI)'],
      ]),
    )

    expect(redisClient.hmGet).toHaveBeenCalledWith(PrisonService.REDIS_CACHE_KEY, ['LEI', 'MDI'])
    expect(prisonRegisterApiClient.getAllPrisons).not.toHaveBeenCalled()
    expect(redisClient.hSet).not.toHaveBeenCalled()
    expect(logger.error).not.toHaveBeenCalled()
  })

  it.each([
    {
      scenario: 'cache is empty',
      // simulate first lookup
      redisCache: [null, null],
    },
    {
      scenario: 'cache is missing an item',
      // simulate a renamed and a new prison
      redisCache: ['Leeds (HMP)', null],
    },
  ])('should refresh redis cache from prison register when $scenario', async ({ redisCache }) => {
    redisClient.hmGet.mockResolvedValueOnce(redisCache)
    prisonRegisterApiClient.getAllPrisons.mockResolvedValueOnce([mockPrisonLEI, mockPrisonMDI])

    await expect(prisonService.getPrisonNames(['LEI', 'MDI'])).resolves.toEqual(
      new Map([
        ['LEI', 'Leeds (HMP & YOI)'],
        ['MDI', 'Moorland (HMP & YOI)'],
      ]),
    )

    expect(redisClient.hmGet).toHaveBeenCalledWith(PrisonService.REDIS_CACHE_KEY, ['LEI', 'MDI'])
    expect(prisonRegisterApiClient.getAllPrisons).toHaveBeenCalledWith()
    expect(redisClient.hSet).toHaveBeenCalledWith(PrisonService.REDIS_CACHE_KEY, {
      LEI: 'Leeds (HMP & YOI)',
      MDI: 'Moorland (HMP & YOI)',
    })
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('should return prison ID for those missing from cache and prison register', async () => {
    redisClient.hmGet.mockResolvedValueOnce([null, 'Moorland (HMP & YOI)'])
    prisonRegisterApiClient.getAllPrisons.mockResolvedValueOnce([mockPrisonLEI, mockPrisonMDI])

    await expect(prisonService.getPrisonNames(['BXI', 'MDI'])).resolves.toEqual(
      new Map([
        ['BXI', 'BXI'],
        ['MDI', 'Moorland (HMP & YOI)'],
      ]),
    )

    expect(redisClient.hmGet).toHaveBeenCalledWith(PrisonService.REDIS_CACHE_KEY, ['BXI', 'MDI'])
    expect(prisonRegisterApiClient.getAllPrisons).toHaveBeenCalledWith()
    expect(redisClient.hSet).toHaveBeenCalledWith(PrisonService.REDIS_CACHE_KEY, {
      LEI: 'Leeds (HMP & YOI)',
      MDI: 'Moorland (HMP & YOI)',
    })
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('should simply return all prison IDs when redis throws an error', async () => {
    redisClient.hmGet.mockRejectedValueOnce(new Error('Disconnected'))

    await expect(prisonService.getPrisonNames(['LEI', 'MDI'])).resolves.toEqual(
      new Map([
        ['LEI', 'LEI'],
        ['MDI', 'MDI'],
      ]),
    )

    expect(redisClient.hmGet).toHaveBeenCalledWith(PrisonService.REDIS_CACHE_KEY, ['LEI', 'MDI'])
    expect(prisonRegisterApiClient.getAllPrisons).not.toHaveBeenCalledWith()
    expect(redisClient.hSet).not.toHaveBeenCalledWith()
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ message: 'Disconnected' }))
  })

  it('should simply return all prison IDs when prison-register throws an error', async () => {
    redisClient.hmGet.mockResolvedValueOnce([null, null])
    prisonRegisterApiClient.getAllPrisons.mockRejectedValueOnce(mockThrownError(internalServerErrorResponse))

    await expect(prisonService.getPrisonNames(['LEI', 'MDI'])).resolves.toEqual(
      new Map([
        ['LEI', 'LEI'],
        ['MDI', 'MDI'],
      ]),
    )

    expect(redisClient.hmGet).toHaveBeenCalledWith(PrisonService.REDIS_CACHE_KEY, ['LEI', 'MDI'])
    expect(prisonRegisterApiClient.getAllPrisons).toHaveBeenCalledWith()
    expect(redisClient.hSet).not.toHaveBeenCalledWith()
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ message: 'Internal Server Error' }))
  })
})
