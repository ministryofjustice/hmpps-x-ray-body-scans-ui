import { Router } from 'express'
import { Forbidden, NotFound, Unauthorized } from 'http-errors'
import request from 'supertest'
import { appWithAllRoutes } from './routes/testutils/appSetup'
import { internalServerErrorResponse, mockThrownError } from './testutils/mocks/errorResponse'
import routes from './routes'

jest.mock('../logger')
jest.mock('./routes/index')

const mockedRoutes = jest.mocked(routes)

afterEach(() => {
  jest.resetAllMocks()
})

describe('Error handling', () => {
  describe.each([
    { scenario: 'in production', production: true },
    { scenario: 'not in production', production: false },
  ])('$scenario', ({ production }) => {
    it('should return 404 page when route is missing', () => {
      mockedRoutes.mockReturnValue(Router()) // mock app with no routes
      const app = appWithAllRoutes({ production })
      return request(app)
        .get('/not-found')
        .expect(404)
        .expect('Content-Type', /html/)
        .expect(res => {
          expect(res.text).toContain('Page not found')
          expect(res.text).not.toContain('Sorry, there is a problem with the service')
          expect(res.text).not.toContain('Authorisation Error')
          expect(res.text).not.toContain('NotFoundError')
        })
    })

    it('should return 404 page when NotFound error is caught', () => {
      const router = Router()
      router.get('/', (_req, _res, next) => {
        next(new NotFound())
      })
      mockedRoutes.mockReturnValue(router)
      const app = appWithAllRoutes({ production })
      return request(app)
        .get('/')
        .expect(404)
        .expect('Content-Type', /html/)
        .expect(res => {
          expect(res.text).toContain('Page not found')
          expect(res.text).not.toContain('Sorry, there is a problem with the service')
          expect(res.text).not.toContain('Authorisation Error')
          expect(res.text).not.toContain('NotFoundError')
        })
    })

    it.each([new Unauthorized(), new Forbidden()])(
      'should show authorisation error page when $message is caught',
      error => {
        const router = Router()
        router.get('/error', (_req, _res, next) => {
          next(error)
        })
        mockedRoutes.mockReturnValue(router)
        const app = appWithAllRoutes({ production })
        return request(app).get('/error').expect(302).expect('Location', '/authError')
      },
    )

    it('should show an error page when an api error is caught', () => {
      const router = Router()
      router.get('/', (_req, _res, next) => {
        next(mockThrownError(internalServerErrorResponse))
      })
      mockedRoutes.mockReturnValue(router)
      const app = appWithAllRoutes({ production })
      return request(app)
        .get('/')
        .expect(500)
        .expect('Content-Type', /html/)
        .expect(res => {
          expect(res.text).toContain('Sorry, there is a problem with the service')
          expect(res.text).not.toContain('Page not found')
          expect(res.text).not.toContain('Authorisation Error')

          if (production) {
            expect(res.text).not.toContain('Internal Server Error')
            expect(res.text).not.toContain('Status: 500')
            expect(res.text).not.toContain('developerMessage')
          } else {
            expect(res.text).toContain('Internal Server Error')
            expect(res.text).toContain('Status: 500')
            expect(res.text).toContain('developerMessage')
          }
        })
    })
  })
})
