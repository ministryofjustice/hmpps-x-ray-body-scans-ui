import { dataAccess } from '../data'
import AuditService from './auditService'

export const services = () => {
  const { applicationInfo, hmppsAuditClient, prisonerSearchApiClient, xrayBodyScansApiClient } = dataAccess()

  return {
    applicationInfo,
    auditService: new AuditService(hmppsAuditClient),
    prisonerSearchApiClient,
    xrayBodyScansApiClient,
  }
}

export type Services = ReturnType<typeof services>
