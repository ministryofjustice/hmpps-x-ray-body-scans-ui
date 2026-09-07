import type { Express } from 'express'
import request from 'supertest'
import {
  PermissionsService,
  PrisonerBasePermission,
  CorePersonRecordPermission,
} from '@ministryofjustice/hmpps-prison-permissions-lib'
import { appWithAllRoutes, user } from './testutils/appSetup'
import createUserToken from '../testutils/createUserToken'
import type { Services } from '../services'
import AuditService from '../services/auditService'
import { PrisonService } from '../services/prisonService'
import { PrisonApiClient } from '../data/prisonApi'
import { PrisonerSearchApiClient } from '../data/prisonerSearchApiClient'
import { XrayBodyScansApiClient } from '../data/xrayBodyScansApiClient'
import { internalServerErrorResponse, mockThrownError } from '../testutils/mocks/errorResponse'
import {
  mockGrantPrisonerPermissions,
  mockGrantMinimalPrisonerPermissions,
} from '../testutils/mocks/prisonPermissionsService'
import { mockPrisoner } from '../testutils/mocks/prisonerSearchApi'
import { mockPhotoReadable } from '../testutils/mocks/prisonApi'

jest.mock('@ministryofjustice/hmpps-prison-permissions-lib')
jest.mock('../data/prisonApi')
jest.mock('../data/prisonerSearchApiClient')
jest.mock('../data/xrayBodyScansApiClient')
jest.mock('../services/auditService')
jest.mock('../services/prisonService')

const auditService = jest.mocked(new AuditService({} as never))
const prisonApiClient = jest.mocked(new PrisonApiClient({} as never))
const prisonPermissionsService = jest.mocked(PermissionsService.create({} as never))
const prisonService = jest.mocked(new PrisonService({} as never, {} as never))
const prisonerSearchApiClient = jest.mocked(new PrisonerSearchApiClient({} as never))
const xrayBodyScansApiClient = jest.mocked(new XrayBodyScansApiClient({} as never))
const services: Services = {
  applicationInfo: {} as never,
  auditService,
  prisonApiClient,
  prisonPermissionsService,
  prisonService,
  prisonerSearchApiClient,
  xrayBodyScansApiClient,
}

const prisonerNumber = 'A1234BC'
const prisoner = {
  ...mockPrisoner(prisonerNumber),
  currentFacialImageId: '1008971246',
}
const photoUrl = `/prisoner/${prisonerNumber}/photo`

const jpegMockImageSize = 3260
const pngPlaceholderSize = 2084

let app: Express

const unauthorisedUser = { ...user, token: createUserToken([]) }

beforeEach(() => {
  auditService.logAuditEvent.mockResolvedValue(undefined)
  mockGrantMinimalPrisonerPermissions()
  prisonerSearchApiClient.getPrisoner.mockResolvedValue(prisoner)
})

afterEach(() => {
  jest.resetAllMocks()
})

describe('photo router', () => {
  it('should redirect to auth error page when unauthorised', () => {
    app = appWithAllRoutes({
      services,
      userSupplier: () => unauthorisedUser,
    })

    return request(app)
      .get(photoUrl)
      .expect(302)
      .expect('Location', '/authError')
      .expect(() => {
        expect(auditService.logAuditEvent).not.toHaveBeenCalled()
        expect(prisonApiClient.getPhoto).not.toHaveBeenCalled()
      })
  })

  it('should send 404 when prisoner was not found', () => {
    app = appWithAllRoutes({ services })
    prisonerSearchApiClient.getPrisoner.mockResolvedValueOnce(null)

    return request(app)
      .get(photoUrl)
      .expect(404)
      .expect(() => {
        expect(auditService.logAuditEvent).not.toHaveBeenCalled()
        expect(prisonApiClient.getPhoto).not.toHaveBeenCalled()
      })
  })

  it('should pipe photo from prison-api when permission is granted', () => {
    app = appWithAllRoutes({ services })
    mockGrantPrisonerPermissions(PrisonerBasePermission.read, CorePersonRecordPermission.read_photo)
    prisonApiClient.getPhoto.mockResolvedValueOnce(mockPhotoReadable())

    return request(app)
      .get(photoUrl)
      .expect(200)
      .expect('Content-Type', 'image/jpeg')
      .expect('Cache-Control', 'private, max-age=86400')
      .expect(res => {
        expect(auditService.logAuditEvent).toHaveBeenCalledWith({
          what: 'VIEW_PHOTO',
          who: user.username,
          subjectId: prisonerNumber,
          subjectType: 'PRISONER_ID',
          correlationId: expect.any(String),
          details: { photoId: '1008971246' },
        })
        expect(prisonApiClient.getPhoto).toHaveBeenCalledWith('1008971246', false, user.token)
        const body = res.body as Buffer
        expect(body.byteLength).toEqual(jpegMockImageSize)
      })
  })

  it('should send placeholder image when prison-api returns an error', () => {
    app = appWithAllRoutes({ services })
    mockGrantPrisonerPermissions(PrisonerBasePermission.read, CorePersonRecordPermission.read_photo)
    prisonApiClient.getPhoto.mockRejectedValueOnce(mockThrownError(internalServerErrorResponse))

    return request(app)
      .get(photoUrl)
      .expect(200)
      .expect('Content-Type', 'image/png')
      .expect('Cache-Control', 'private, max-age=86400')
      .expect(res => {
        expect(auditService.logAuditEvent).toHaveBeenCalledWith({
          what: 'VIEW_PHOTO',
          who: user.username,
          subjectId: prisonerNumber,
          subjectType: 'PRISONER_ID',
          correlationId: expect.any(String),
          details: { photoId: '1008971246' },
        })
        expect(prisonApiClient.getPhoto).toHaveBeenCalledWith('1008971246', false, user.token)
        const body = res.body as Buffer
        expect(body.byteLength).toEqual(pngPlaceholderSize)
      })
  })

  it('should send placeholder image when permission is not granted', () => {
    app = appWithAllRoutes({ services })

    return request(app)
      .get(photoUrl)
      .expect(200)
      .expect('Content-Type', 'image/png')
      .expect('Cache-Control', 'private, max-age=86400')
      .expect(res => {
        expect(auditService.logAuditEvent).not.toHaveBeenCalled()
        expect(prisonApiClient.getPhoto).not.toHaveBeenCalled()
        const body = res.body as Buffer
        expect(body.byteLength).toEqual(pngPlaceholderSize)
      })
  })

  it('should send placeholder image when prisoner does not have a current facial image', () => {
    app = appWithAllRoutes({ services })
    mockGrantPrisonerPermissions(PrisonerBasePermission.read, CorePersonRecordPermission.read_photo)
    prisonerSearchApiClient.getPrisoner.mockResolvedValueOnce({
      ...prisoner,
      currentFacialImageId: undefined,
    })

    return request(app)
      .get(photoUrl)
      .expect(200)
      .expect('Content-Type', 'image/png')
      .expect('Cache-Control', 'private, max-age=86400')
      .expect(res => {
        expect(auditService.logAuditEvent).not.toHaveBeenCalled()
        expect(prisonApiClient.getPhoto).not.toHaveBeenCalled()
        const body = res.body as Buffer
        expect(body.byteLength).toEqual(pngPlaceholderSize)
      })
  })
})
