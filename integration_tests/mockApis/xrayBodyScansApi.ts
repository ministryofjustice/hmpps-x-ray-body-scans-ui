import type { SuperAgentRequest } from 'superagent'
import { stubPing } from './wiremock'

export default {
  stubPing: (httpStatus = 200): SuperAgentRequest => stubPing('/xray-body-scans-api', httpStatus),
}
