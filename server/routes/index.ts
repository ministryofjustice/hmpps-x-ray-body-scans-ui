import { Router } from 'express'

import type { Services } from '../services'
import { Page } from '../services/auditService'
import scanRouter from './scanRouter'

export default function routes(services: Services): Router {
  const router = Router()
  const { auditService, xrayBodyScansApiClient } = services

  router.get('/', async (req, res, _next) => {
    await auditService.logPageView(Page.HOME, { who: res.locals.user.username, correlationId: req.id })

    return res.render('pages/index')
  })

  router.use('/prisoner/:prisonerNumber', scanRouter(xrayBodyScansApiClient, auditService))

  return router
}
