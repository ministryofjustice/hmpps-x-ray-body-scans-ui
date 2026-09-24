import type { Locals } from 'express'
import type Service from '@ministryofjustice/hmpps-connect-dps-components/dist/types/Service'
import type { CaseLoad } from '../../data/interfaces/prisonApi'

export function mockComponentsResponse(
  caseLoad: CaseLoad | null = null,
  services: Service[] = [],
): Locals['feComponents'] {
  return {
    header: 'DPS header',
    footer: 'DPS footer',
    cssIncludes: [],
    jsIncludes: [],
    sharedData: {
      activeCaseLoad: caseLoad,
      caseLoads: caseLoad ? [caseLoad] : [],
      services,
      allocationJobResponsibilities: [],
      cspDirectives: {},
    },
  }
}

export const mockXrayBodyScansService: Service = {
  id: 'x-ray-body-scans',
  heading: 'X-ray body scans',
  description: 'X-ray body scans API',
  href: 'http://localhost:3001/xRayBodyScansApi',
  navEnabled: false,
}
export const mockService: Service = {
  id: 'check-my-diary',
  heading: 'Check my diary',
  description: 'View your prison staff detail (staff rota) from home.',
  href: 'http://localhost:3001',
  navEnabled: true,
}
