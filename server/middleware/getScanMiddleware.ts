import type { RequestHandler } from 'express'
import { NotFound } from 'http-errors'
import type { XrayBodyScansApiClient } from '../data/xrayBodyScansApiClient'

// eslint-disable-next-line import/prefer-default-export
export function getScanMiddleware(xrayBodyScansApiClient: XrayBodyScansApiClient): RequestHandler {
  return async (req, res, next): Promise<void> => {
    const { scanId } = req.params as { scanId?: string }
    if (!scanId) {
      next(new NotFound())
      return
    }
    const { username } = res.locals.user
    const scanResponse = await xrayBodyScansApiClient.getScan(scanId, username)
    if (!scanResponse) {
      next(new NotFound())
      return
    }
    const { prisoner } = res.locals
    if (!prisoner || scanResponse.prisonerNumber !== prisoner.prisonerNumber) {
      next(new NotFound())
      return
    }
    // TODO: check that the case note type is XRBS to prevent reading any old case note?
    res.locals.scan = scanResponse
    next()
  }
}
