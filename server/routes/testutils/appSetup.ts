import { randomUUID } from 'node:crypto'
import express, { Express } from 'express'
import { NotFound } from 'http-errors'
import routes from '../index'
import nunjucksSetup from '../../utils/nunjucksSetup'
import errorHandler from '../../errorHandler'
import type { Services } from '../../services'
import AuditService from '../../services/auditService'
import { PrisonService } from '../../services/prisonService'
import type { PrisonUser } from '../../interfaces/hmppsUser'
import setUpWebSession from '../../middleware/setUpWebSession'
import createUserToken from '../../testutils/createUserToken'
import { mockComponentsResponse, mockXrayBodyScansService } from '../../testutils/mocks/componentsApi'
import { caseloadMDI } from '../../testutils/mocks/prisonApi'
import { mockPrisoner } from '../../testutils/mocks/prisonerSearchApi'

jest.mock('../../services/auditService')

/** Prison user with minimal roles to access this service */
export const user: PrisonUser = {
  name: 'FIRST LAST',
  userId: 'id',
  userUuid: '11111111-1111-1111-1111-111111111111',
  token: createUserToken(['ROLE_PRISON', 'ROLE_DPS_APPLICATION_DEVELOPER']),
  username: 'user1',
  displayName: 'First Last',
  authSource: 'nomis',
  staffId: 1234,
  activeCaseLoadId: 'MDI',
  activeCaseLoad: caseloadMDI,
  caseLoads: [caseloadMDI],
  userRoles: [],
}

export const flashProvider = jest.fn()

function appSetup(services: Services, production: boolean, userSupplier: () => PrisonUser): Express {
  const app = express()

  app.set('view engine', 'njk')

  nunjucksSetup(app)
  app.use(setUpWebSession())
  app.use((req, res, next) => {
    const generatedUser = userSupplier()
    req.user = generatedUser
    req.flash = flashProvider
    res.locals = {
      user: generatedUser,
      prisoner: {
        ...mockPrisoner('A1234AA'),
        displayName: 'John Smith',
        reversedDisplayName: 'Smith, John',
      },
      prisonerPermissions: {} as never,
      cspNonce: '',
      csrfToken: '',
      feComponents: mockComponentsResponse(generatedUser.activeCaseLoad, [mockXrayBodyScansService]),
      asset_path: '',
      applicationName: '',
      environmentName: '',
      environmentNameColour: '',
    }
    next()
  })
  app.use((req, _res, next) => {
    req.id = randomUUID()
    next()
  })
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))
  app.use(routes(services))
  app.use((_req, _res, next) => next(new NotFound()))
  app.use(errorHandler(production))

  return app
}

export function appWithAllRoutes({
  production = false,
  services = {
    auditService: jest.mocked(new AuditService({} as never)),
    prisonService: jest.mocked(new PrisonService({} as never, {} as never)),
  },
  userSupplier = () => user,
}: {
  production?: boolean
  services?: Partial<Services>
  userSupplier?: () => PrisonUser
}): Express {
  return appSetup(services as Services, production, userSupplier)
}
