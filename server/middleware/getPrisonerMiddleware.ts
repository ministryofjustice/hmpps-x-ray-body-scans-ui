import type { RequestHandler } from 'express'
import { NotFound } from 'http-errors'
import type { PrisonerSearchApiClient } from '../data/prisonerSearchApiClient'

// eslint-disable-next-line import/prefer-default-export
export function getPrisonerMiddleware(prisonerSearchApiClient: PrisonerSearchApiClient): RequestHandler {
  return async (req, res, next): Promise<void> => {
    const { prisonerNumber } = req.params as { prisonerNumber: string }
    const { username } = res.locals.user
    const prisoner = await prisonerSearchApiClient.getPrisoner(prisonerNumber, username)
    if (!prisoner) {
      next(new NotFound())
    } else {
      res.locals.prisoner = prisoner
      next()
    }
  }
}
