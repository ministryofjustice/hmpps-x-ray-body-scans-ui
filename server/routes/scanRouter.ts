import { Router } from 'express'
import {
  type PermissionsService,
  XRayBodyScansPermission,
  prisonerPermissionsGuard,
} from '@ministryofjustice/hmpps-prison-permissions-lib'
import type { XrayBodyScansApiClient } from '../data/xrayBodyScansApiClient'
import { getScanMiddleware } from '../middleware/getScanMiddleware'
import type AuditService from '../services/auditService'
import type { PrisonService } from '../services/prisonService'
import ScanController from '../controllers/scanController'
import CaseNoteController from '../controllers/caseNoteController'

export default function scanRouter(
  auditService: AuditService,
  prisonPermissionsService: PermissionsService,
  prisonService: PrisonService,
  xrayBodyScansApiClient: XrayBodyScansApiClient,
): Router {
  const scanController = new ScanController(auditService, prisonService, xrayBodyScansApiClient)

  const router = Router({ mergeParams: true })
  router.use(
    prisonerPermissionsGuard(prisonPermissionsService, {
      requestDependentOn: [XRayBodyScansPermission.read_scans],
    }),
  )

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
    caseNoteRouter(auditService, xrayBodyScansApiClient),
  )

  return router
}

function caseNoteRouter(auditService: AuditService, xrayBodyScansApiClient: XrayBodyScansApiClient): Router {
  const caseNoteController = new CaseNoteController(auditService, xrayBodyScansApiClient)

  const router = Router({ mergeParams: true })
  router.get('/case-note', (req, res, next) => caseNoteController.getScanCaseNote(req, res).catch(next))
  router.get('/add-a-scan-case-note', (req, res, next) => caseNoteController.getAddScanCaseNote(req, res).catch(next))
  router.post('/add-a-scan-case-note', (req, res, next) => caseNoteController.postAddScanCaseNote(req, res).catch(next))
  return router
}
