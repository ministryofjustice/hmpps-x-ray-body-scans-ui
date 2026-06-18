import type { SuperAgentRequest } from 'superagent'
import type CaseLoad from '@ministryofjustice/hmpps-connect-dps-components/dist/types/CaseLoad'
import type Service from '@ministryofjustice/hmpps-connect-dps-components/dist/types/Service'
import { stubFor, stubPing } from './wiremock'

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
    const caseLoads = options.caseLoads || [
      {
        caseLoadId: 'LEI',
        description: 'Leeds (HMP)',
        type: 'INST',
        caseloadFunction: 'GENERAL',
        currentlyActive: true,
      },
    ]

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
            services: options.services || [
              {
                id: 'check-my-diary',
                heading: 'Check my diary',
                description: 'View your prison staff detail (staff rota) from home.',
                href: 'http://localhost:3001',
                navEnabled: true,
              },
              {
                id: 'key-worker-allocations',
                heading: 'My key worker allocation',
                description: 'View your key worker cases.',
                href: 'http://localhost:3001/key-worker/111111',
                navEnabled: true,
              },
            ],
          },
        },
      },
    })
  },
}
