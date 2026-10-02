import type { NextFunction, Request, Response } from 'express'
import { telemetry } from '@ministryofjustice/hmpps-azure-telemetry'
import logger from '../../logger'

const trackedPaths = ['/scan-overview', '/record-scan']

export default function entryPointMiddleware(req: Request, res: Response, next: NextFunction): void {
  const pathWithoutQuery = req.path.split('?')[0]
  if (!trackedPaths.some(path => pathWithoutQuery.endsWith(path))) {
    next()
    return
  }

  let entryPoint: string
  if (req.query.wpipReturnPath) {
    entryPoint = 'wpip'
  } else if (typeof req.query.entryPoint === 'string') {
    entryPoint = req.query.entryPoint
  } else {
    entryPoint = 'other'
  }

  const { username, activeCaseLoadId } = res.locals.user
  const { prisonerNumber } = res.locals.prisoner

  const properties = {
    page: req.path,
    entryPoint,
    username,
    activeCaseLoadId: activeCaseLoadId ?? '',
    prisonerNumber,
  }

  logger.info(properties, 'XRBSEntryPoint')
  telemetry.trackEvent('XRBSEntryPoint', properties)

  delete req.query.entryPoint

  next()
}
