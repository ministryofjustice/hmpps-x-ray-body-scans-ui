import type { RequestHandler } from 'express'
import logger from '../../logger'
import config from '../config'

/** The user has an active case load */
// eslint-disable-next-line import/prefer-default-export
export function requireActiveCaseload(): RequestHandler {
  return (_req, res, next): void => {
    const { user } = res.locals
    const { activeCaseLoadId, activeCaseLoad } = user

    if (activeCaseLoadId && activeCaseLoad && activeCaseLoad.caseLoadId === activeCaseLoadId) {
      // TODO: forbid certain HQ/global case loads like CADM_I?
      next()
    } else {
      logger.info('User has no active caseload', { activeCaseLoadId, activeCaseLoad })
      res.redirect(config.serviceUrls.digitalPrison)
    }
  }
}
