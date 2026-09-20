import { Router } from 'express'
import { Forbidden } from 'http-errors'
import {
  type PermissionsService,
  CaseNotesPermission,
  XRayBodyScansPermission,
  prisonerPermissionsGuard,
} from '@ministryofjustice/hmpps-prison-permissions-lib'
import type { XrayBodyScansApiClient } from '../data/xrayBodyScansApiClient'
import { getScanMiddleware } from '../middleware/getScanMiddleware'
import type AuditService from '../services/auditService'
import type { PrisonService } from '../services/prisonService'
import { canAddCaseNotToScan } from '../utils/scanPermissions'
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

  // TODO: record perms
  // router.use(
  //   '/record-scan',
  //   prisonerPermissionsGuard(prisonPermissionsService, {
  //     requestDependentOn: [],
  //   }),
  // )
  router.get('/record-scan', (req, res, next) => scanController.getCreateScan(req, res).catch(next))
  router.post('/record-scan', (req, res, next) => scanController.postCreateScan(req, res).catch(next))

  router.use(
    '/scan/:scanId',
    getScanMiddleware(xrayBodyScansApiClient),
    caseNoteRouter(auditService, prisonPermissionsService, xrayBodyScansApiClient),
  )

  return router
}

function caseNoteRouter(
  auditService: AuditService,
  prisonPermissionsService: PermissionsService,
  xrayBodyScansApiClient: XrayBodyScansApiClient,
): Router {
  const caseNoteController = new CaseNoteController(auditService, xrayBodyScansApiClient)

  const router = Router({ mergeParams: true })

  router.get('/case-note', (req, res, next) => caseNoteController.getScanCaseNote(req, res).catch(next))

  router.use(
    '/add-a-scan-case-note',
    prisonerPermissionsGuard(prisonPermissionsService, {
      requestDependentOn: [CaseNotesPermission.read],
    }),
    (_req, res, next) => {
      const { user, scan } = res.locals
      if (canAddCaseNotToScan(user, scan!)) {
        next()
      } else {
        next(new Forbidden())
      }
    },
  )
  router.get('/add-a-scan-case-note', (req, res, next) => caseNoteController.getAddScanCaseNote(req, res).catch(next))
  router.post('/add-a-scan-case-note', (req, res, next) => caseNoteController.postAddScanCaseNote(req, res).catch(next))

  return router
}
