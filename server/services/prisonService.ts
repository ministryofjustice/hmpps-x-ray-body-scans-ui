import type { RedisClientType } from 'redis'
import logger from '../../logger'
import type { Prison } from '../data/interfaces/prisonRegisterApi'
import type { PrisonRegisterApiClient } from '../data/prisonRegisterApiClient'

// eslint-disable-next-line import/prefer-default-export
export class PrisonService {
  static REDIS_CACHE_KEY: string = '.all-prison-names'

  constructor(
    private readonly prisonRegisterApiClient: PrisonRegisterApiClient,
    private readonly redisClient: RedisClientType,
    private readonly token: string,
  ) {}

  private async lookupAndCachePrison(prisonId: string): Promise<Prison> {
    const prisonName = await this.redisClient.hGet(PrisonService.REDIS_CACHE_KEY, prisonId)
    if (prisonName) {
      return { prisonId, prisonName }
    }

    const prisons = await this.prisonRegisterApiClient.getAllPrisons(this.token)
    await this.redisClient.hSet(
      PrisonService.REDIS_CACHE_KEY,
      Object.fromEntries(prisons.map(prison => [prison.prisonId, prison.prisonName])),
    )
    const prison = prisons.find(p => p.prisonId === prisonId)
    if (prison) {
      return prison
    }
    throw Error(`Prison “${prisonId}” not found in prison register`)
  }

  async getPrisonName(prisonId: string): Promise<string> {
    try {
      const { prisonName } = await this.lookupAndCachePrison(prisonId)
      return prisonName
    } catch (error) {
      logger.error(error)
      return prisonId
    }
  }
}
