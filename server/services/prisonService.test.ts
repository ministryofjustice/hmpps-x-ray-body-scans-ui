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
      hGet: jest.fn(),
      hSet: jest.fn(),
    } as unknown as jest.Mocked<RedisClientType>

    const mockAuthenticationClient = {
      getToken: jest.fn().mockResolvedValue('test-system-token'),
    } as unknown as AuthenticationClient
    prisonRegisterApiClient = jest.mocked(new PrisonRegisterApiClient(mockAuthenticationClient))

    prisonService = new PrisonService(prisonRegisterApiClient, redisClient, 'token4')
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('should lookup the name of a known prison from redis cache', async () => {
    redisClient.hGet.mockResolvedValueOnce('Moorland (HMP & YOI)')

    await expect(prisonService.getPrisonName('MDI')).resolves.toEqual('Moorland (HMP & YOI)')

    expect(redisClient.hGet).toHaveBeenCalledWith(PrisonService.REDIS_CACHE_KEY, 'MDI')
    expect(prisonRegisterApiClient.getAllPrisons).not.toHaveBeenCalled()
    expect(redisClient.hSet).not.toHaveBeenCalled()
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('should lookup the name of a known prison from prison register when not in redis cache', async () => {
    redisClient.hGet.mockResolvedValueOnce(null)
    prisonRegisterApiClient.getAllPrisons.mockResolvedValueOnce([mockPrisonLEI, mockPrisonMDI])

    await expect(prisonService.getPrisonName('MDI')).resolves.toEqual('Moorland (HMP & YOI)')

    expect(redisClient.hGet).toHaveBeenCalledWith(PrisonService.REDIS_CACHE_KEY, 'MDI')
    expect(prisonRegisterApiClient.getAllPrisons).toHaveBeenCalledWith('token4')
    expect(redisClient.hSet).toHaveBeenCalledWith(PrisonService.REDIS_CACHE_KEY, {
      LEI: 'Leeds (HMP & YOI)',
      MDI: 'Moorland (HMP & YOI)',
    })
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('should simply return prison ID when code was not found in prison register', async () => {
    redisClient.hGet.mockResolvedValueOnce(null)
    prisonRegisterApiClient.getAllPrisons.mockResolvedValueOnce([mockPrisonLEI, mockPrisonMDI])

    await expect(prisonService.getPrisonName('BXI')).resolves.toEqual('BXI')

    expect(redisClient.hGet).toHaveBeenCalledWith(PrisonService.REDIS_CACHE_KEY, 'BXI')
    expect(prisonRegisterApiClient.getAllPrisons).toHaveBeenCalledWith('token4')
    expect(redisClient.hSet).toHaveBeenCalledWith(PrisonService.REDIS_CACHE_KEY, {
      LEI: 'Leeds (HMP & YOI)',
      MDI: 'Moorland (HMP & YOI)',
    })
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Prison “BXI” not found in prison register' }),
    )
  })

  it('should simply return prison ID when prison register returns an error', async () => {
    redisClient.hGet.mockResolvedValueOnce(null)
    prisonRegisterApiClient.getAllPrisons.mockRejectedValueOnce(mockThrownError(internalServerErrorResponse))

    await expect(prisonService.getPrisonName('BXI')).resolves.toEqual('BXI')

    expect(redisClient.hGet).toHaveBeenCalledWith(PrisonService.REDIS_CACHE_KEY, 'BXI')
    expect(prisonRegisterApiClient.getAllPrisons).toHaveBeenCalledWith('token4')
    expect(redisClient.hSet).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ message: 'Internal Server Error' }))
  })
})
