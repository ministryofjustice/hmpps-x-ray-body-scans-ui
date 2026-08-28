import type { RedisClientType } from 'redis'
import logger from '../../logger'
import type { PrisonRegisterApiClient } from '../data/prisonRegisterApiClient'

// eslint-disable-next-line import/prefer-default-export
export class PrisonService {
  static REDIS_CACHE_KEY: string = '.all-prison-names'

  constructor(
    private readonly prisonRegisterApiClient: PrisonRegisterApiClient,
    private readonly redisClient: RedisClientType,
  ) {}

  /** Map prison ids to their names (or the same id if no name was found) */
  async getPrisonNames(prisonIds: string[]): Promise<Map<string, string>> {
    try {
      return await this.lookupPrisonNames(prisonIds)
    } catch (error) {
      // fall back to codes in case of api/redis errors
      logger.error(error)
      return new Map(prisonIds.map(prisonId => [prisonId, prisonId]))
    }
  }

  private async lookupPrisonNames(prisonIds: string[]): Promise<Map<string, string>> {
    const prisonNamesList = await this.redisClient.hmGet(PrisonService.REDIS_CACHE_KEY, prisonIds)

    const prisonNames = new Map()
    let someMissing = false
    prisonIds.forEach((prisonId, index) => {
      const prisonName = prisonNamesList[index]
      if (prisonName) {
        prisonNames.set(prisonId, prisonName)
      } else {
        someMissing = true
      }
    })

    if (someMissing) {
      // some prison id was missing in cache so update from prison register
      const prisons = await this.prisonRegisterApiClient.getAllPrisons()
      const prisonsCache: Record<string, string> = Object.fromEntries(
        prisons.map(prison => [prison.prisonId, prison.prisonName]),
      )
      await this.redisClient.hSet(PrisonService.REDIS_CACHE_KEY, prisonsCache)

      // back fill any missing names
      prisonIds.forEach(prisonId => {
        if (prisonId in prisonsCache) {
          prisonNames.set(prisonId, prisonsCache[prisonId])
        } else if (!prisonNames.has(prisonId)) {
          prisonNames.set(prisonId, prisonId)
        }
      })
    }

    return prisonNames
  }
}
