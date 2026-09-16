import type { NextFunction, Request, Response } from 'express'
import { registerWpipReturnPathMiddleware } from './registerWpipReturnPathMiddleware'

describe('registerWpipReturnPathMiddleware', () => {
  let req: Request
  let res: Response
  let next: NextFunction

  beforeEach(() => {
    req = { query: {}, session: {} } as unknown as Request
    res = { locals: {} } as Response
    next = jest.fn() as NextFunction
  })

  afterEach(() => {
    // query param is unconditionally deleted
    expect(req.query.wpipReturnPath).toBeUndefined()
  })

  it('should ignore missing WPIP return path', () => {
    registerWpipReturnPathMiddleware(req, res, next)

    expect(next).toHaveBeenCalledWith()
    expect(req.session.wpipReturnPath).toBeUndefined()
    expect(res.locals.wpipReturnPath).toBeUndefined()
  })

  it.each(['http://localhost', 'https://welcome.prison.service.justice.gov.uk/recent-arrivals', 'recent-arrivals'])(
    'should ignore `%s` WPIP return path',
    wpipReturnPath => {
      req.query.wpipReturnPath = wpipReturnPath
      registerWpipReturnPathMiddleware(req, res, next)

      expect(next).toHaveBeenCalledWith()
      expect(req.session.wpipReturnPath).toBeUndefined()
      expect(res.locals.wpipReturnPath).toBeUndefined()
    },
  )

  it.each(['/recent-arrivals', '/recent-arrivals?search=John'])(
    'should store `%s` WPIP return path in session',
    wpipReturnPath => {
      req.query.wpipReturnPath = wpipReturnPath
      registerWpipReturnPathMiddleware(req, res, next)

      expect(next).toHaveBeenCalledWith()
      expect(req.session.wpipReturnPath).toEqual(wpipReturnPath)
      expect(res.locals.wpipReturnPath).toEqual(wpipReturnPath)
    },
  )

  it('should copy WPIP return path from session to locals', () => {
    const wpipReturnPath = '/recent-arrivals?search=John'
    req.session.wpipReturnPath = wpipReturnPath
    registerWpipReturnPathMiddleware(req, res, next)

    expect(next).toHaveBeenCalledWith()
    expect(res.locals.wpipReturnPath).toEqual(wpipReturnPath)
  })
})
