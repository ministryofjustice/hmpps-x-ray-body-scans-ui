import type { SuperAgentRequest } from 'superagent'
import { stubFor } from './wiremock'

export default {
  stubWpipRecentArrivals(): SuperAgentRequest {
    return stubFor({
      request: {
        method: 'GET',
        urlPath: '/welcome/recent-arrivals',
      },
      response: {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
        },
        body: '<html lang="en"><body><h1>Welcome people into prison</h1><h2>Recent arrivals</h2></body></html>',
      },
    })
  },
}
