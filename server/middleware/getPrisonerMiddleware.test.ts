import type { Request, Response, NextFunction } from 'express'
import { NotFound } from 'http-errors'
import type { PrisonerSearchApiClient } from '../data/prisonerSearchApiClient'
import { mockPrisoner } from '../testutils/mocks/prisonerSearchApi'
import { getPrisonerMiddleware } from './getPrisonerMiddleware'

describe('getPrisonerMiddleware', () => {
  let prisonerSearchApiClient: jest.Mocked<PrisonerSearchApiClient>

  beforeEach(() => {
    prisonerSearchApiClient = {
      getPrisoner: jest.fn(),
    } as unknown as jest.Mocked<PrisonerSearchApiClient>
  })

  it('should call prisoner search and store result in res.locals', async () => {
    prisonerSearchApiClient.getPrisoner.mockResolvedValueOnce(mockPrisoner('A1234AA'))

    const req = { params: { prisonerNumber: 'A1234AA' } } as unknown as Request
    const res = { locals: { user: { username: 'abc12ab' } } } as Response
    const next = jest.fn() as NextFunction

    await getPrisonerMiddleware(prisonerSearchApiClient)(req, res, next)

    expect(res.locals.prisoner.prisonerNumber).toEqual('A1234AA')
    expect(res.locals.prisoner.displayName).toEqual('John Smith')
    expect(res.locals.prisoner.reversedDisplayName).toEqual('Smith, John')
    expect(next).toHaveBeenCalledWith()
  })

  it('should return 404 if prisoner search did not find the prisoner', async () => {
    prisonerSearchApiClient.getPrisoner.mockResolvedValueOnce(null)

    const req = { params: { prisonerNumber: 'A1234AA' } } as unknown as Request
    const res = { locals: { user: { username: 'abc12ab' } } } as Response
    const next = jest.fn() as NextFunction

    await getPrisonerMiddleware(prisonerSearchApiClient)(req, res, next)

    expect(res.locals.prisoner).toBeUndefined()
    expect(next).toHaveBeenCalledWith(new NotFound())
  })
})
