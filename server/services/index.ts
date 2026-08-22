import logger from '../../logger'
import { dataAccess } from '../data'
import { createRedisClient } from '../data/redisClient'
import AuditService from './auditService'
import { PrisonService } from './prisonService'

export const services = () => {
  const {
    applicationInfo,
    hmppsAuditClient,
    prisonRegisterApiClient,
    prisonerSearchApiClient,
    xrayBodyScansApiClient,
  } = dataAccess()

  const redisClient = createRedisClient()
  redisClient.connect().catch(error => logger.error(error, 'Error connecting to Redis'))

  return {
    applicationInfo,
    auditService: new AuditService(hmppsAuditClient),
    prisonService: new PrisonService(prisonRegisterApiClient, redisClient),
    prisonerSearchApiClient,
    xrayBodyScansApiClient,
  }
}

export type Services = ReturnType<typeof services>
