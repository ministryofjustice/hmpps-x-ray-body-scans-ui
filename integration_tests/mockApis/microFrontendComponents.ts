import type { SuperAgentRequest } from 'superagent'
import type CaseLoad from '@ministryofjustice/hmpps-connect-dps-components/dist/types/CaseLoad'
import type Service from '@ministryofjustice/hmpps-connect-dps-components/dist/types/Service'
import { stubFor, stubPing } from './wiremock'
import { mockService, mockXrayBodyScansService } from '../../server/testutils/mocks/componentsApi'
import { caseloadMDI } from '../../server/testutils/mocks/prisonApi'

export default {
  stubPing: (httpStatus = 200): SuperAgentRequest => stubPing('/frontend-components', httpStatus),

  stubUnavailable() {
    return stubFor({
      request: {
        method: 'GET',
        urlPath: '/frontend-components/components',
      },
      response: { status: 503 },
    })
  },

  stubComponents(
    options: {
      caseLoads?: CaseLoad[]
      services?: Service[]
    } = {},
  ): SuperAgentRequest {
    const caseLoads = options.caseLoads ?? [caseloadMDI]

    return stubFor({
      request: {
        method: 'GET',
        urlPath: '/frontend-components/components',
      },
      response: {
        status: 200,
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
        },
        jsonBody: {
          header: { html: '<header>DPS HEADER</header>', css: [], javascript: [] },
          footer: { html: '<footer>DPS FOOTER</footer>', css: [], javascript: [] },
          meta: {
            caseLoads,
            activeCaseLoad: caseLoads.find(caseLoad => caseLoad.currentlyActive),
            services: options.services || [mockService, mockXrayBodyScansService],
            cspDirectives: Object.fromEntries(
              ['font-src', 'form-action', 'img-src', 'script-src', 'style-src'].map(directive => [
                directive,
                ['http://localhost:9091'],
              ]),
            ),
          },
        },
      },
    })
  },
}
