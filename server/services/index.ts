import { dataAccess } from '../data'
import AuditService from './auditService'
import ExampleService from './exampleService'

export const services = () => {
  const { applicationInfo, hmppsAuditClient, exampleApiClient, xrayBodyScansApiClient } = dataAccess()

  return {
    applicationInfo,
    auditService: new AuditService(hmppsAuditClient),
    exampleService: new ExampleService(exampleApiClient),
    xrayBodyScansApiClient, // We can use a more sophisticated service later, IFF we need to.
  }
}

export type Services = ReturnType<typeof services>
