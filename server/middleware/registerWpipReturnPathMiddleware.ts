import type { NextFunction, Request, Response } from 'express'

/**
 * Given a “safe” `wpipReturnPath` query parameter, stores it in the session to allow returning users back to where
 * they came from in the “Welcome people into prison” service if they cancel their action
 * or complete a multi-page journey.
 *
 * Once in the session, it is copied into `res.locals` for all subsequent requests until deleted.
 *
 * It is unconditionally deleted from the `req.query` to not pollute further URLs.
 */
// eslint-disable-next-line import/prefer-default-export
export function registerWpipReturnPathMiddleware(req: Request, res: Response, next: NextFunction) {
  const wpipReturnPath = req.query?.wpipReturnPath

  if (
    wpipReturnPath &&
    typeof wpipReturnPath === 'string' &&
    wpipReturnPath.startsWith('/') &&
    !wpipReturnPath.includes(':')
  ) {
    req.session.wpipReturnPath = wpipReturnPath
  }

  if (req.session.wpipReturnPath) {
    res.locals.wpipReturnPath = req.session.wpipReturnPath
  }

  if (req.query && typeof req.query === 'object') {
    delete req.query.wpipReturnPath
  }

  next()
}
