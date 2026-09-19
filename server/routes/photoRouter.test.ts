import type { Express } from 'express'
import request from 'supertest'
import { PrisonerBasePermission, CorePersonRecordPermission } from '@ministryofjustice/hmpps-prison-permissions-lib'
import { appWithAllRoutes, user } from './testutils/appSetup'
import { internalServerErrorResponse, mockThrownError } from '../testutils/mocks/errorResponse'
import {
  mockGrantNoPrisonerPermissions,
  mockGrantPrisonerPermissions,
} from '../testutils/mocks/prisonPermissionsService'
import { mockPrisoner } from '../testutils/mocks/prisonerSearchApi'
import { mockPhotoReadable } from '../testutils/mocks/prisonApi'
import { mockServices } from '../testutils/mocks/services'

jest.mock('@ministryofjustice/hmpps-prison-permissions-lib')
jest.mock('../data/prisonApi')
jest.mock('../data/prisonerSearchApiClient')
jest.mock('../data/xrayBodyScansApiClient')
jest.mock('../services/auditService')
jest.mock('../services/prisonService')

const { auditService, prisonApiClient, prisonerSearchApiClient } = mockServices

const prisonerNumber = 'A1234BC'
const prisoner = mockPrisoner(prisonerNumber, { currentFacialImageId: '1008971246' })
const photoUrl = `/prisoner/${prisonerNumber}/photo`

const jpegMockImageSize = 3260
const pngPlaceholderSize = 2084

let app: Express

beforeEach(() => {
  auditService.logAuditEvent.mockResolvedValue(undefined)
  mockGrantPrisonerPermissions(PrisonerBasePermission.read, CorePersonRecordPermission.read_photo)
  prisonerSearchApiClient.getPrisoner.mockResolvedValue(prisoner)
})

afterEach(() => {
  jest.resetAllMocks()
})

describe('photo router', () => {
  it('should redirect to auth error page when unauthorised', () => {
    mockGrantNoPrisonerPermissions()
    app = appWithAllRoutes({ services: mockServices })

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
    app = appWithAllRoutes({ services: mockServices })
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
    app = appWithAllRoutes({ services: mockServices })
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
    app = appWithAllRoutes({ services: mockServices })
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
    mockGrantPrisonerPermissions(PrisonerBasePermission.read)
    app = appWithAllRoutes({ services: mockServices })

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
    app = appWithAllRoutes({ services: mockServices })
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
