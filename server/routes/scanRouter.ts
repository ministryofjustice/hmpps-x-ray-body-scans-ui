import { Router } from 'express'

import type { XrayBodyScansApiClient } from '../data/xrayBodyScansApiClient'
import ScanController from '../controllers/scanController'
import type AuditService from '../services/auditService'

export default function scanRouter(xrayBodyScansApiClient: XrayBodyScansApiClient, auditService: AuditService): Router {
  const router = Router({ mergeParams: true })
  const scanController = new ScanController(xrayBodyScansApiClient, auditService)

  router.get('/scans', (req, res, next) => scanController.getScanList(req, res).catch(next))
  router.get('/record-scan', (req, res, next) => scanController.getCreateScan(req, res).catch(next))
  router.post('/record-scan', (req, res, next) => scanController.postCreateScan(req, res).catch(next))
  router.get('/record-scan/success', (req, res, next) => scanController.getCreateScanSuccess(req, res).catch(next))

  return router
}
