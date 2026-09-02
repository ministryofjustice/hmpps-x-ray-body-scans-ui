import HmppsAuditClient, { type AuditEvent } from '../data/hmppsAuditClient'

export enum Page {
  HOME = 'HOME',
  SCAN_LIST = 'SCAN_LIST',
  CREATE_SCAN = 'CREATE_SCAN',
  CREATE_SCAN_SUCCESS = 'CREATE_SCAN_SUCCESS',
  ADD_SCAN_CASE_NOTE = 'ADD_SCAN_CASE_NOTE',
  VIEW_SCAN_CASE_NOTE = 'VIEW_SCAN_CASE_NOTE',
}

export interface PageViewEventDetails {
  who: string
  subjectId?: string
  subjectType?: string
  correlationId?: string
  details?: object
}

export default class AuditService {
  constructor(private readonly hmppsAuditClient: HmppsAuditClient) {}

  async logAuditEvent(event: AuditEvent) {
    await this.hmppsAuditClient.sendMessage(event)
  }

  async logPageView(page: Page, eventDetails: PageViewEventDetails) {
    const event: AuditEvent = {
      ...eventDetails,
      what: `PAGE_VIEW_${page}`,
    }
    await this.hmppsAuditClient.sendMessage(event)
  }
}
