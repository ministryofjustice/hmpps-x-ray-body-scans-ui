import { Router } from 'express'
import { NotFound } from 'http-errors'
import { PrisonerBasePermission, prisonerPermissionsGuard } from '@ministryofjustice/hmpps-prison-permissions-lib'
import config from '../config'
import type { Services } from '../services'
import authorisationMiddleware from '../middleware/authorisationMiddleware'
import { getPrisonerMiddleware } from '../middleware/getPrisonerMiddleware'
import { registerWpipReturnPathMiddleware } from '../middleware/registerWpipReturnPathMiddleware'
import { requireActiveAgency } from '../middleware/requireActiveAgency'
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
    xrayBodyScansApiClient,
  } = services

  router.get('/', async (_req, res) => {
    res.redirect(config.serviceUrls.digitalPrison)
  })

  if (config.environment === 'local') {
    // this route exists to allow testing of the fallback header & footer without MFE having provided a list of caseloads or services
    router.get('/not-found', (_req, _res, next) => next(new NotFound()))
  }

  router.use(
    authorisationMiddleware(['DPS_APPLICATION_DEVELOPER']), // TODO: will either require no roles or PRISON
    requireActiveCaseload(),
    requireActiveAgency(),
  )

  router.get('/api/signal-end-journey', signalEndJourneyRoute)

  router.use(
    '/prisoner/:prisonerNumber',
    getPrisonerMiddleware(prisonerSearchApiClient),
    prisonerPermissionsGuard(prisonPermissionsService, { requestDependentOn: [PrisonerBasePermission.read] }),
    registerWpipReturnPathMiddleware,
    scanRouter(auditService, prisonService, xrayBodyScansApiClient),
    photoRouter(auditService, prisonApiClient),
  )

  return router
}
