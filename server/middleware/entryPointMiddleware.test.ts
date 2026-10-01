import type { NextFunction, Request, Response } from 'express'
import { telemetry } from '@ministryofjustice/hmpps-azure-telemetry'
import logger from '../../logger'
import entryPointMiddleware from './entryPointMiddleware'

jest.mock('@ministryofjustice/hmpps-azure-telemetry', () => ({ telemetry: { trackEvent: jest.fn() } }))
jest.mock('../../logger', () => ({ info: jest.fn() }))

describe('entryPointMiddleware', () => {
  let req: Request
  let res: Response
  let next: NextFunction

  beforeEach(() => {
    req = { query: {}, path: '/scan-overview' } as unknown as Request
    res = {
      locals: {
        user: { username: 'USER1', activeCaseLoadId: 'LEI' },
        prisoner: { prisonerNumber: 'A1234BC' },
      },
    } as unknown as Response
    next = jest.fn()
  })

  const expectedCommon = {
    page: '/scan-overview',
    username: 'USER1',
    activeCaseLoadId: 'LEI',
    prisonerNumber: 'A1234BC',
  }

  it('should track other when no entryPoint param', () => {
    entryPointMiddleware(req, res, next)

    expect(logger.info).toHaveBeenCalledWith({ ...expectedCommon, entryPoint: 'other' }, 'XRBSEntryPoint')
    expect(telemetry.trackEvent).toHaveBeenCalledWith('XRBSEntryPoint', { ...expectedCommon, entryPoint: 'other' })
    expect(next).toHaveBeenCalledWith()
  })

  it.each(['wpip', 'profile-overview', 'xrbs-summary'] as const)('should track entryPoint %s', entryPoint => {
    req.query.entryPoint = entryPoint

    entryPointMiddleware(req, res, next)

    expect(logger.info).toHaveBeenCalledWith({ ...expectedCommon, entryPoint }, 'XRBSEntryPoint')
    expect(telemetry.trackEvent).toHaveBeenCalledWith('XRBSEntryPoint', { ...expectedCommon, entryPoint })
    expect(next).toHaveBeenCalledWith()
  })
})
