import type { Request, Response, NextFunction } from 'express'
import type { HttpError } from 'http-errors'
import type { HTTPError as SuperagentHttpError } from 'superagent'
import type { SanitisedError } from '@ministryofjustice/hmpps-rest-client'
import logger from '../logger'

export default function createErrorHandler(production: boolean) {
  return (
    error: HttpError | SuperagentHttpError | SanitisedError,
    req: Request,
    res: Response,
    _next: NextFunction,
  ): void => {
    logger.error(`Error handling request for '${req.originalUrl}', user '${res.locals.user?.username}'`, error)

    const status = ('status' in error && error.status) || ('responseStatus' in error && error.responseStatus) || 500

    if (status === 401 || status === 403) {
      res.redirect('/authError')
      return
    }

    res.status(status)
    if (status === 404) {
      res.render('pages/notFound')
    } else {
      res.render('pages/error', { status, error, production })
    }
  }
}
