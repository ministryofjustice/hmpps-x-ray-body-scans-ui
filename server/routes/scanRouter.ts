import { Router } from 'express'

import type XrayBodyScansApiClient from '../data/xrayBodyScansApiClient'
import ScanController from '../controllers/scanController'

export default function scanRouter(xrayBodyScansApiClient: XrayBodyScansApiClient): Router {
  const router = Router({ mergeParams: true })
  const scanController = new ScanController(xrayBodyScansApiClient)

  router.get('/create-scan', (req, res, next) => scanController.getCreateScan(req, res).catch(next))
  router.post('/create-scan', (req, res, next) => scanController.postCreateScan(req, res).catch(next))

  return router
}
