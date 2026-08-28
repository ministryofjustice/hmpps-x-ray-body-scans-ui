import { Router } from 'express'

import type { Services } from '../services'
import { Page } from '../services/auditService'
import authorisationMiddleware from '../middleware/authorisationMiddleware'
import { getPrisonerMiddleware } from '../middleware/getPrisonerMiddleware'
import { requireActiveCaseload } from '../middleware/requireActiveCaseload'
import scanRouter from './scanRouter'

export default function routes(services: Services): Router {
  const router = Router()
  const { auditService, prisonService, prisonerSearchApiClient, xrayBodyScansApiClient } = services

  router.use(authorisationMiddleware(['DPS_APPLICATION_DEVELOPER']))

  router.get('/', async (req, res, _next) => {
    await auditService.logPageView(Page.HOME, { who: res.locals.user.username, correlationId: req.id })

    return res.render('pages/index')
  })

  router.use(
    '/prisoner/:prisonerNumber',
    requireActiveCaseload(),
    getPrisonerMiddleware(prisonerSearchApiClient),
    scanRouter(auditService, prisonService, xrayBodyScansApiClient),
  )

  return router
}
