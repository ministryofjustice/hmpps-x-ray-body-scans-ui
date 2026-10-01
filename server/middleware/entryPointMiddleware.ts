import type { NextFunction, Request, Response } from 'express'
import { telemetry } from '@ministryofjustice/hmpps-azure-telemetry'
import logger from '../../logger'

export default function entryPointMiddleware(req: Request, res: Response, next: NextFunction): void {
  const entryPoint = typeof req.query.entryPoint === 'string' ? req.query.entryPoint : 'other'

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

  next()
}
