import type { Request, Response, NextFunction } from 'express'
import { NotFound } from 'http-errors'
import type { XrayBodyScansApiClient } from '../data/xrayBodyScansApiClient'
import { mockPrisoner } from '../testutils/mocks/prisonerSearchApi'
import { mockScanResponse } from '../testutils/mocks/xrayBodyScansApi'
import { getScanMiddleware } from './getScanMiddleware'

describe('getScanMiddleware', () => {
  const prisonerNumber = 'A1234BC'
  const prisoner = mockPrisoner(prisonerNumber)
  const scan = mockScanResponse(prisonerNumber, new Date())
  const scanId = scan.id
  let xrayBodyScansApiClient: jest.Mocked<XrayBodyScansApiClient>

  beforeEach(() => {
    xrayBodyScansApiClient = {
      getScan: jest.fn(),
    } as unknown as jest.Mocked<XrayBodyScansApiClient>
  })

  it('should call x-ray body scans api and store result in res.locals', async () => {
    xrayBodyScansApiClient.getScan.mockResolvedValueOnce(scan)

    const req = { params: { prisonerNumber, scanId } } as unknown as Request
    const res = { locals: { prisoner, user: { username: 'abc12ab' } } } as Response
    const next = jest.fn() as NextFunction

    await getScanMiddleware(xrayBodyScansApiClient)(req, res, next)

    expect(res.locals.scan).toEqual(scan)
    expect(next).toHaveBeenCalledWith()
  })

  it('should return 404 when scan was not found', async () => {
    xrayBodyScansApiClient.getScan.mockResolvedValueOnce(null)

    const req = { params: { prisonerNumber, scanId } } as unknown as Request
    const res = { locals: { prisoner, user: { username: 'abc12ab' } } } as Response
    const next = jest.fn() as NextFunction

    await getScanMiddleware(xrayBodyScansApiClient)(req, res, next)

    expect(res.locals.scan).toBeUndefined()
    expect(next).toHaveBeenCalledWith(new NotFound())
  })

  it('should return 404 when scan did not match prisoner in res.local', async () => {
    xrayBodyScansApiClient.getScan.mockResolvedValueOnce({
      ...scan,
      prisonerNumber: 'B2222BB',
    })

    const req = { params: { prisonerNumber, scanId } } as unknown as Request
    const res = { locals: { prisoner, user: { username: 'abc12ab' } } } as Response
    const next = jest.fn() as NextFunction

    await getScanMiddleware(xrayBodyScansApiClient)(req, res, next)

    expect(res.locals.scan).toBeUndefined()
    expect(next).toHaveBeenCalledWith(new NotFound())
  })

  it('should return 404 when scanId is not in the URL parameters', async () => {
    xrayBodyScansApiClient.getScan.mockResolvedValueOnce(scan)

    const req = { params: { prisonerNumber } } as unknown as Request
    const res = { locals: { prisoner, user: { username: 'abc12ab' } } } as Response
    const next = jest.fn() as NextFunction

    await getScanMiddleware(xrayBodyScansApiClient)(req, res, next)

    expect(res.locals.scan).toBeUndefined()
    expect(next).toHaveBeenCalledWith(new NotFound())
  })

  it('should return 404 when prisoner is not in res.locals', async () => {
    xrayBodyScansApiClient.getScan.mockResolvedValueOnce(scan)

    const req = { params: { prisonerNumber, scanId } } as unknown as Request
    const res = { locals: { user: { username: 'abc12ab' } } } as Response
    const next = jest.fn() as NextFunction

    await getScanMiddleware(xrayBodyScansApiClient)(req, res, next)

    expect(res.locals.scan).toBeUndefined()
    expect(next).toHaveBeenCalledWith(new NotFound())
  })
})
