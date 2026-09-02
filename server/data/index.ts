import {
  type TokenStore,
  AuthenticationClient,
  InMemoryTokenStore,
  RedisTokenStore,
} from '@ministryofjustice/hmpps-auth-clients'
import config from '../config'
import logger from '../../logger'
import applicationInfoSupplier from '../applicationInfo'
import HmppsAuditClient from './hmppsAuditClient'
import { createRedisClient } from './redisClient'
import { PrisonRegisterApiClient } from './prisonRegisterApiClient'
import { PrisonerSearchApiClient } from './prisonerSearchApiClient'
import { XrayBodyScansApiClient } from './xrayBodyScansApiClient'

const applicationInfo = applicationInfoSupplier()

export const dataAccess = () => {
  const tokenStore: TokenStore = config.redis.enabled
    ? new RedisTokenStore(createRedisClient())
    : new InMemoryTokenStore()
  const hmppsAuthClient = new AuthenticationClient(config.apis.hmppsAuth, logger, tokenStore)

  return {
    applicationInfo,
    hmppsAuthClient,
    tokenStore,
    hmppsAuditClient: new HmppsAuditClient(config.sqs.audit),
    prisonRegisterApiClient: new PrisonRegisterApiClient(hmppsAuthClient),
    prisonerSearchApiClient: new PrisonerSearchApiClient(hmppsAuthClient),
    xrayBodyScansApiClient: new XrayBodyScansApiClient(hmppsAuthClient),
  }
}

export type DataAccess = ReturnType<typeof dataAccess>
