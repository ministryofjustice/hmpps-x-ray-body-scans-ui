import type { Request, Response, NextFunction } from 'express'
import type { PrisonUser } from '../interfaces/hmppsUser'
import { user } from '../routes/testutils/appSetup'
import { requireActiveCaseload } from './requireActiveCaseload'

describe('requireActiveCaseload', () => {
  it('should call next handler when user has an active caseload', () => {
    const req = {} as Request
    const res = {
      locals: { user: { ...user, activeCaseLoadId: 'MDI' } satisfies PrisonUser },
      redirect: jest.fn(),
    } as unknown as Response
    const next = jest.fn() as NextFunction

    requireActiveCaseload()(req, res, next)

    expect(next).toHaveBeenCalledWith()
    expect(res.redirect).not.toHaveBeenCalled()
  })

  it('should redirect to DPS home page when user has no active caseload', () => {
    const req = {} as Request
    const res = {
      locals: { user: { ...user, activeCaseLoadId: undefined } satisfies PrisonUser },
      redirect: jest.fn(),
    } as unknown as Response
    const next = jest.fn() as NextFunction

    requireActiveCaseload()(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.redirect).toHaveBeenCalledWith('http://localhost:3001')
  })
})
