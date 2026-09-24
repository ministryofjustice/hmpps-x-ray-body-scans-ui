import type { RequestHandler } from 'express'
import config from '../config'
import type { PrisonUser } from '../interfaces/hmppsUser'

/** The user has an active case load */
// eslint-disable-next-line import/prefer-default-export
export function requireActiveCaseload(): RequestHandler {
  return (_req, res, next): void => {
    const { user } = res.locals
    const activeCaseload = (user as PrisonUser).activeCaseLoadId
    if (activeCaseload) {
      // TODO: forbid certain HQ/global case loads like CADM_I?
      next()
    } else {
      res.redirect(config.serviceUrls.digitalPrison)
    }
  }
}
