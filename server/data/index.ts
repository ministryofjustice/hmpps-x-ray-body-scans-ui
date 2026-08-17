import { AuthenticationClient, InMemoryTokenStore, RedisTokenStore } from '@ministryofjustice/hmpps-auth-clients'
import config from '../config'
import logger from '../../logger'
import applicationInfoSupplier from '../applicationInfo'
import HmppsAuditClient from './hmppsAuditClient'
import { createRedisClient } from './redisClient'
import { PrisonerSearchApiClient } from './prisonerSearchApiClient'
import { XrayBodyScansApiClient } from './xrayBodyScansApiClient'

const applicationInfo = applicationInfoSupplier()

export const dataAccess = () => {
  const hmppsAuthClient = new AuthenticationClient(
    config.apis.hmppsAuth,
    logger,
    config.redis.enabled ? new RedisTokenStore(createRedisClient()) : new InMemoryTokenStore(),
  )

  return {
    applicationInfo,
    hmppsAuthClient,
    hmppsAuditClient: new HmppsAuditClient(config.sqs.audit),
    prisonerSearchApiClient: new PrisonerSearchApiClient(hmppsAuthClient),
    xrayBodyScansApiClient: new XrayBodyScansApiClient(hmppsAuthClient),
  }
}

export type DataAccess = ReturnType<typeof dataAccess>

export { AuthenticationClient, HmppsAuditClient }
