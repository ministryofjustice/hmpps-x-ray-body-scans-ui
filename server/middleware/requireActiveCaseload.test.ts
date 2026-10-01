import type { Request, Response, NextFunction } from 'express'
import logger from '../../logger'
import type { PrisonUser } from '../interfaces/hmppsUser'
import { user } from '../routes/testutils/appSetup'
import { caseloadLEI, caseloadMDI } from '../testutils/mocks/prisonApi'
import { requireActiveCaseload } from './requireActiveCaseload'

jest.mock('../../logger')

describe('requireActiveCaseload', () => {
  it('should call next handler when user has an active caseload', () => {
    const req = {} as Request
    const res = {
      locals: {
        user: { ...user, activeCaseLoad: caseloadMDI, activeCaseLoadId: caseloadMDI.caseLoadId } satisfies PrisonUser,
      },
      redirect: jest.fn(),
    } as unknown as Response
    const next = jest.fn() as NextFunction

    requireActiveCaseload()(req, res, next)

    expect(next).toHaveBeenCalledWith()
    expect(res.redirect).not.toHaveBeenCalled()
    expect(logger.info).not.toHaveBeenCalled()
  })

  it('should redirect to DPS home page when user has no active caseload', () => {
    const req = {} as Request
    const res = {
      locals: { user: { ...user, activeCaseLoad: undefined, activeCaseLoadId: undefined } satisfies PrisonUser },
      redirect: jest.fn(),
    } as unknown as Response
    const next = jest.fn() as NextFunction

    requireActiveCaseload()(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.redirect).toHaveBeenCalledWith('http://localhost:3001/dps-home')
    expect(logger.info).toHaveBeenCalledWith('User has no active caseload', {
      activeCaseLoad: undefined,
      activeCaseLoadId: undefined,
    })
  })

  it('should redirect to DPS home page when user has an active caseload mismatch somehow', () => {
    const req = {} as Request
    const res = {
      locals: {
        user: { ...user, activeCaseLoad: caseloadLEI, activeCaseLoadId: caseloadMDI.caseLoadId } satisfies PrisonUser,
      },
      redirect: jest.fn(),
    } as unknown as Response
    const next = jest.fn() as NextFunction

    requireActiveCaseload()(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.redirect).toHaveBeenCalledWith('http://localhost:3001/dps-home')
    expect(logger.info).toHaveBeenCalledWith('User has no active caseload', {
      activeCaseLoad: caseloadLEI,
      activeCaseLoadId: caseloadMDI.caseLoadId,
    })
  })
})
