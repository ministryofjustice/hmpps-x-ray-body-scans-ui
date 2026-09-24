import type { RequestHandler } from 'express'
import config from '../config'

/** The service is enabled for this user’s active case load according to MFE */
// eslint-disable-next-line import/prefer-default-export
export function requireActiveAgency(): RequestHandler {
  return (_req, res, next) => {
    const services = res.locals.feComponents?.sharedData?.services ?? []
    if (services.some(service => service.id === 'x-ray-body-scans')) {
      next()
    } else {
      res.redirect(config.serviceUrls.digitalPrison)
    }
  }
}
