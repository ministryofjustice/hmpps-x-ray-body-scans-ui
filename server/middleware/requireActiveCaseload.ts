import type { RequestHandler } from 'express'
import config from '../config'
import type { PrisonUser } from '../interfaces/hmppsUser'

// eslint-disable-next-line import/prefer-default-export
export function requireActiveCaseload(): RequestHandler {
  return (_req, res, next): void => {
    const { user } = res.locals
    const activeCaseload = (user as PrisonUser).activeCaseLoadId
    if (activeCaseload) {
      next()
    } else {
      res.redirect(config.serviceUrls.digitalPrison)
    }
  }
}
