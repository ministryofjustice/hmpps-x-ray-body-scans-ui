import { Router } from 'express'

import type { XrayBodyScansApiClient } from '../data/xrayBodyScansApiClient'
import type AuditService from '../services/auditService'
import type { PrisonService } from '../services/prisonService'
import ScanController from '../controllers/scanController'
import CaseNoteController from '../controllers/caseNoteController'

export default function scanRouter(
  auditService: AuditService,
  prisonService: PrisonService,
  xrayBodyScansApiClient: XrayBodyScansApiClient,
): Router {
  const router = Router({ mergeParams: true })
  const scanController = new ScanController(auditService, prisonService, xrayBodyScansApiClient)
  const caseNoteController = new CaseNoteController(auditService, xrayBodyScansApiClient)

  router.get('/', (_req, res) => {
    const { prisonerNumber } = res.locals.prisoner
    // TODO: should this redirect to profile page instead?
    res.redirect(`/prisoner/${prisonerNumber}/scan-overview`)
  })

  router.get('/scan-overview', (req, res, next) => scanController.getScanList(req, res).catch(next))
  router.get('/record-scan', (req, res, next) => scanController.getCreateScan(req, res).catch(next))
  router.post('/record-scan', (req, res, next) => scanController.postCreateScan(req, res).catch(next))

  router.get('/scan/:scanId/add-a-scan-case-note', (req, res, next) =>
    caseNoteController.getAddScanCaseNote(req, res).catch(next),
  )
  router.post('/scan/:scanId/add-a-scan-case-note', (req, res, next) =>
    caseNoteController.postAddScanCaseNote(req, res).catch(next),
  )

  return router
}
