import { Router } from 'express'

import type { XrayBodyScansApiClient } from '../data/xrayBodyScansApiClient'
import ScanController from '../controllers/scanController'
import type AuditService from '../services/auditService'

export default function scanRouter(xrayBodyScansApiClient: XrayBodyScansApiClient, auditService: AuditService): Router {
  const router = Router({ mergeParams: true })
  const scanController = new ScanController(xrayBodyScansApiClient, auditService)

  router.get('/', (_req, res) => {
    const { prisonerNumber } = res.locals.prisoner
    // TODO: should this redirect to profile page instead?
    res.redirect(`/prisoner/${prisonerNumber}/scans`)
  })

  router.get('/scans', (req, res, next) => scanController.getScanList(req, res).catch(next))
  router.get('/record-scan', (req, res, next) => scanController.getCreateScan(req, res).catch(next))
  router.post('/record-scan', (req, res, next) => scanController.postCreateScan(req, res).catch(next))

  router.get('/scan/:scanId/add-a-scan-case-note', (req, res, next) =>
    scanController.getAddScanCaseNote(req, res).catch(next),
  )
  router.post('/scan/:scanId/add-a-scan-case-note', (req, res, next) =>
    scanController.postAddScanCaseNote(req, res).catch(next),
  )

  return router
}
