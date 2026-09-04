import { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import { telemetry as telemetryClient } from '@ministryofjustice/hmpps-azure-telemetry'
import { PermissionsService } from '@ministryofjustice/hmpps-prison-permissions-lib'
import config from '../config'
import logger from '../../logger'
import { dataAccess } from '../data'
import { createRedisClient } from '../data/redisClient'
import AuditService from './auditService'
import { PrisonService } from './prisonService'

export const services = () => {
  const {
    applicationInfo,
    hmppsAuditClient,
    tokenStore,
    prisonRegisterApiClient,
    prisonerSearchApiClient,
    xrayBodyScansApiClient,
  } = dataAccess()

  const redisClient = createRedisClient()
  redisClient.connect().catch(error => logger.error(error, 'Error connecting to Redis'))

  const auditService = new AuditService(hmppsAuditClient)

  const prisonPermissionsService = PermissionsService.create({
    prisonerSearchConfig: config.apis.prisonerSearchApi,
    authenticationClient: new AuthenticationClient(config.apis.hmppsAuth, logger, tokenStore),
    logger,
    telemetryClient,
  })

  const prisonService = new PrisonService(prisonRegisterApiClient, redisClient)

  return {
    applicationInfo,
    auditService,
    prisonPermissionsService,
    prisonService,
    prisonerSearchApiClient,
    xrayBodyScansApiClient,
  }
}

export type Services = ReturnType<typeof services>
