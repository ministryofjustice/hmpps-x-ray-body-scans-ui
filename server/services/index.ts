import { dataAccess } from '../data'
import AuditService from './auditService'

export const services = () => {
  const { applicationInfo, hmppsAuditClient, xrayBodyScansApiClient } = dataAccess()

  return {
    applicationInfo,
    auditService: new AuditService(hmppsAuditClient),
    xrayBodyScansApiClient, // We can use a more sophisticated service later, IFF we need to.
  }
}

export type Services = ReturnType<typeof services>
