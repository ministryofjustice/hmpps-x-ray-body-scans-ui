import { Router } from 'express'
import { PrisonerBasePermission, prisonerPermissionsGuard } from '@ministryofjustice/hmpps-prison-permissions-lib'
import config from '../config'
import type { Services } from '../services'
import authorisationMiddleware from '../middleware/authorisationMiddleware'
import { getPrisonerMiddleware } from '../middleware/getPrisonerMiddleware'
import { registerWpipReturnPathMiddleware } from '../middleware/registerWpipReturnPathMiddleware'
import { requireActiveCaseload } from '../middleware/requireActiveCaseload'
import { photoRouter } from './photoRouter'
import scanRouter from './scanRouter'
import { signalEndJourneyRoute } from './signalEndJourneyRoute'

export default function routes(services: Services): Router {
  const router = Router()
  const {
    auditService,
    prisonApiClient,
    prisonPermissionsService,
    prisonService,
    prisonerSearchApiClient,
    telemetryService,
    xrayBodyScansApiClient,
  } = services

  router.get('/', async (_req, res) => {
    res.redirect(config.serviceUrls.digitalPrison)
  })

  router.use(authorisationMiddleware(['DPS_APPLICATION_DEVELOPER']))

  router.get('/api/signal-end-journey', signalEndJourneyRoute)

  router.use(
    '/prisoner/:prisonerNumber',
    requireActiveCaseload(),
    getPrisonerMiddleware(prisonerSearchApiClient),
    prisonerPermissionsGuard(prisonPermissionsService, { requestDependentOn: [PrisonerBasePermission.read] }),
    registerWpipReturnPathMiddleware,
    scanRouter(auditService, prisonService, telemetryService, xrayBodyScansApiClient),
    photoRouter(auditService, prisonApiClient),
  )

  return router
}
