import express, { Express } from 'express'
import { NotFound } from 'http-errors'

import { randomUUID } from 'crypto'
import routes from '../index'
import nunjucksSetup from '../../utils/nunjucksSetup'
import errorHandler from '../../errorHandler'
import type { Services } from '../../services'
import AuditService from '../../services/auditService'
import type { PrisonUser, HmppsUser } from '../../interfaces/hmppsUser'
import setUpWebSession from '../../middleware/setUpWebSession'
import HmppsAuditClient from '../../data/hmppsAuditClient'
import createUserToken from '../../testutils/createUserToken'
import { mockPrisoner } from '../../testutils/mocks/prisonerSearchApiClient'

jest.mock('../../services/auditService')

/** Prison user with minimal roles to access this service */
export const user: PrisonUser = {
  name: 'FIRST LAST',
  userId: 'id',
  token: createUserToken(['ROLE_DPS_APPLICATION_DEVELOPER']), // TODO: replace with ROLE_PRISON
  username: 'user1',
  displayName: 'First Last',
  authSource: 'nomis',
  staffId: 1234,
  activeCaseLoadId: 'MDI',
  userRoles: [],
}

export const flashProvider = jest.fn()

function appSetup(services: Services, production: boolean, userSupplier: () => HmppsUser): Express {
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
      prisoner: mockPrisoner('A1234AA'),
      cspNonce: '',
      csrfToken: '',
      feComponents: {
        header: 'DPS header',
        footer: 'DPS footer',
        cssIncludes: [],
        jsIncludes: [],
        sharedData: {
          caseLoads: [],
          activeCaseLoad: {},
          services: [],
          allocationJobResponsibilities: [],
          cspDirectives: {},
        },
      },
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
    auditService: new AuditService({} as HmppsAuditClient) as jest.Mocked<AuditService>,
  },
  userSupplier = () => user,
}: {
  production?: boolean
  services?: Partial<Services>
  userSupplier?: () => HmppsUser
}): Express {
  return appSetup(services as Services, production, userSupplier)
}
