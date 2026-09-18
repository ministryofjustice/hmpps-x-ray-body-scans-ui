import type { Request, Response, NextFunction } from 'express'
import { mockComponentsResponse, mockService, mockXrayBodyScansService } from '../testutils/mocks/componentsApi'
import { caseloadMDI } from '../testutils/mocks/prisonApi'
import { requireActiveAgency } from './requireActiveAgency'

describe('requireActiveAgency', () => {
  let req: Request
  let res: Response
  let next: NextFunction

  beforeEach(() => {
    req = {} as unknown as Request
    res = { locals: {}, redirect: jest.fn() } as unknown as Response
    next = jest.fn() as NextFunction
  })

  it('should call next handler when user has this service listed by MFE', () => {
    res.locals.feComponents = mockComponentsResponse(caseloadMDI, [mockService, mockXrayBodyScansService])
    requireActiveAgency()(req, res, next)
    expect(next).toHaveBeenCalledWith()
    expect(res.redirect).not.toHaveBeenCalled()
  })

  it('should redirect to DPS home page when user has no services set by MFE', () => {
    res.locals.feComponents = mockComponentsResponse(caseloadMDI, [mockService])
    requireActiveAgency()(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.redirect).toHaveBeenCalledWith('http://localhost:3001/dps-home')
  })

  it('should redirect to DPS home page when user does not have this service listed by MFE', () => {
    requireActiveAgency()(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.redirect).toHaveBeenCalledWith('http://localhost:3001/dps-home')
  })
})
