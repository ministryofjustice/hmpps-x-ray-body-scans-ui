import type { Request, Response } from 'express'
import { signalEndJourneyRoute } from './signalEndJourneyRoute'

describe('signalEndJourneyRoute', () => {
  let req: Request
  let res: Response

  beforeEach(() => {
    req = { query: {}, session: {} } as unknown as Request
    res = { sendStatus: jest.fn() } as unknown as Response
  })

  it('should send 404 if journey name is not provided', () => {
    signalEndJourneyRoute(req, res)
    expect(res.sendStatus).toHaveBeenCalledWith(404)
  })

  it('should send 404 if unknown journey name is provided', () => {
    req.query.name = 'profile'
    signalEndJourneyRoute(req, res)
    expect(res.sendStatus).toHaveBeenCalledWith(404)
  })

  it('should clear WPIP return path from session', () => {
    req.query.name = 'wpip'
    req.session.wpipReturnPath = '/recent-arrivals?search=John'
    signalEndJourneyRoute(req, res)
    expect(res.sendStatus).toHaveBeenCalledWith(204)
    expect(req.session.wpipReturnPath).toBeUndefined()
  })
})
