import type { NextFunction, Request, Response } from 'express'
import { telemetry } from '@ministryofjustice/hmpps-azure-telemetry'
import logger from '../../logger'
import { entryPointMiddleware } from './entryPointMiddleware'

jest.mock('@ministryofjustice/hmpps-azure-telemetry', () => ({ telemetry: { trackEvent: jest.fn() } }))
jest.mock('../../logger', () => ({ info: jest.fn() }))

describe('entryPointMiddleware', () => {
  let req: Request
  let res: Response
  let next: NextFunction

  beforeEach(() => {
    req = { headers: {}, path: '/scan-overview' } as unknown as Request
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

  it('should track unspecified when no referer', () => {
    entryPointMiddleware(req, res, next)

    expect(logger.info).toHaveBeenCalledWith(
      { ...expectedCommon, entryPoint: 'unspecified', referer: 'unspecified' },
      'XRBSEntryPoint',
    )
    expect(telemetry.trackEvent).toHaveBeenCalledWith('XRBSEntryPoint', {
      ...expectedCommon,
      entryPoint: 'unspecified',
      referer: 'unspecified',
    })
    expect(next).toHaveBeenCalledWith()
  })

  it.each([
    ['https://welcome.prison.service.justice.gov.uk/recent-arrivals', 'wpip'],
    ['https://welcome-dev.prison.service.justice.gov.uk/recent-arrivals', 'wpip'],
    ['https://welcome-preprod.prison.service.justice.gov.uk/recent-arrivals', 'wpip'],
    ['https://prisoner.digital.prison.service.justice.gov.uk/prisoner/A1234BC/overview', 'profile-overview'],
    ['https://prisoner-dev.digital.prison.service.justice.gov.uk/prisoner/A1234BC/overview', 'profile-overview'],
    ['https://prisoner-preprod.digital.prison.service.justice.gov.uk/prisoner/A1234BC/overview', 'profile-overview'],
    ['https://x-ray-body-scans.hmpps.service.justice.gov.uk/prisoner/A1234BC/scan-overview', 'xrbs-summary'],
    ['https://x-ray-body-scans-dev.hmpps.service.justice.gov.uk/prisoner/A1234BC/scan-overview', 'xrbs-summary'],
    ['https://x-ray-body-scans-preprod.hmpps.service.justice.gov.uk/prisoner/A1234BC/scan-overview', 'xrbs-summary'],
    ['http://localhost:3000/prisoner/A1234BC/scan-overview', 'xrbs-summary'],
    ['https://some-other-service.justice.gov.uk/foo', 'other'],
  ])('should track entryPoint %s as %s', (referer, entryPoint) => {
    req.headers.referer = referer

    entryPointMiddleware(req, res, next)

    expect(logger.info).toHaveBeenCalledWith({ ...expectedCommon, entryPoint, referer }, 'XRBSEntryPoint')
    expect(telemetry.trackEvent).toHaveBeenCalledWith('XRBSEntryPoint', { ...expectedCommon, entryPoint, referer })
    expect(next).toHaveBeenCalledWith()
  })
})
