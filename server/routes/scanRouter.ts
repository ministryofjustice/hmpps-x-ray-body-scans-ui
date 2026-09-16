import { Router } from 'express'

import type { XrayBodyScansApiClient } from '../data/xrayBodyScansApiClient'
import { getScanMiddleware } from '../middleware/getScanMiddleware'
import type AuditService from '../services/auditService'
import type { PrisonService } from '../services/prisonService'
import type { TelemetryService } from '../services/telemetryService'
import ScanController from '../controllers/scanController'
import CaseNoteController from '../controllers/caseNoteController'

export default function scanRouter(
  auditService: AuditService,
  prisonService: PrisonService,
  telemetryService: TelemetryService,
  xrayBodyScansApiClient: XrayBodyScansApiClient,
): Router {
  const router = Router({ mergeParams: true })
  const scanController = new ScanController(auditService, prisonService, telemetryService, xrayBodyScansApiClient)

  router.get('/', (_req, res) => {
    const { prisonerNumber } = res.locals.prisoner
    // TODO: should this redirect to profile page instead?
    res.redirect(`/prisoner/${prisonerNumber}/scan-overview`)
  })

  router.get('/scan-overview', (req, res, next) => scanController.getScanList(req, res).catch(next))
  router.get('/record-scan', (req, res, next) => scanController.getCreateScan(req, res).catch(next))
  router.post('/record-scan', (req, res, next) => scanController.postCreateScan(req, res).catch(next))

  router.use(
    '/scan/:scanId',
    getScanMiddleware(xrayBodyScansApiClient),
    caseNoteRouter(auditService, telemetryService, xrayBodyScansApiClient),
  )

  return router
}

function caseNoteRouter(
  auditService: AuditService,
  telemetryService: TelemetryService,
  xrayBodyScansApiClient: XrayBodyScansApiClient,
): Router {
  const caseNoteController = new CaseNoteController(auditService, telemetryService, xrayBodyScansApiClient)

  const router = Router({ mergeParams: true })
  router.get('/case-note', (req, res, next) => caseNoteController.getScanCaseNote(req, res).catch(next))
  router.get('/add-a-scan-case-note', (req, res, next) => caseNoteController.getAddScanCaseNote(req, res).catch(next))
  router.post('/add-a-scan-case-note', (req, res, next) => caseNoteController.postAddScanCaseNote(req, res).catch(next))
  return router
}
