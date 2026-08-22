import { Router } from 'express'

import type { XrayBodyScansApiClient } from '../data/xrayBodyScansApiClient'
import type AuditService from '../services/auditService'
import type { PrisonService } from '../services/prisonService'
import ScanController from '../controllers/scanController'

export default function scanRouter(
  auditService: AuditService,
  prisonService: PrisonService,
  xrayBodyScansApiClient: XrayBodyScansApiClient,
): Router {
  const router = Router({ mergeParams: true })
  const scanController = new ScanController(auditService, prisonService, xrayBodyScansApiClient)

  router.get('/', (_req, res) => {
    const { prisonerNumber } = res.locals.prisoner
    // TODO: should this redirect to profile page instead?
    res.redirect(`/prisoner/${prisonerNumber}/scans`)
  })

  router.get('/scans', (req, res, next) => scanController.getScanList(req, res).catch(next))
  router.get('/record-scan', (req, res, next) => scanController.getCreateScan(req, res).catch(next))
  router.post('/record-scan', (req, res, next) => scanController.postCreateScan(req, res).catch(next))

  return router
}
