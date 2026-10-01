import type { NextFunction, Request, Response } from 'express'
import { telemetry } from '@ministryofjustice/hmpps-azure-telemetry'
import logger from '../../logger'

const wpipHostPattern = /^welcome(-\w+)?\.prison\.service\.justice\.gov\.uk$/
const profileHostPattern = /^prisoner(-\w+)?\.digital\.prison\.service\.justice\.gov\.uk$/
const xrbsHostPattern = /^(x-ray-body-scans(-\w+)?\.hmpps\.service\.justice\.gov\.uk|localhost)$/

export type EntryPoint = 'wpip' | 'profile-overview' | 'xrbs-summary' | 'other' | 'unspecified'

export function entryPointMiddleware(req: Request, res: Response, next: NextFunction): void {
  const { referer } = req.headers
  let entryPoint: EntryPoint = 'unspecified'
  if (referer) {
    const { hostname } = new URL(referer)
    if (wpipHostPattern.test(hostname)) entryPoint = 'wpip'
    else if (profileHostPattern.test(hostname)) entryPoint = 'profile-overview'
    else if (xrbsHostPattern.test(hostname)) entryPoint = 'xrbs-summary'
    else entryPoint = 'other'
  }

  const { username, activeCaseLoadId } = res.locals.user
  const { prisonerNumber } = res.locals.prisoner

  const properties = {
    page: req.path,
    entryPoint,
    referer: referer ?? 'unspecified',
    username,
    activeCaseLoadId: activeCaseLoadId ?? '',
    prisonerNumber,
  }

  logger.info(properties, 'XRBSEntryPoint')
  telemetry.trackEvent('XRBSEntryPoint', properties)

  next()
}
