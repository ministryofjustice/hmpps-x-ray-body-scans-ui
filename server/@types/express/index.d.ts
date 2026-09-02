import type { SharedData } from '@ministryofjustice/hmpps-connect-dps-components'
import type { PrisonUser } from '../../interfaces/hmppsUser'
import type { Prisoner } from '../../data/interfaces/prisonerSearchApi'
import type { ScanResponse } from '../../data/interfaces/xrayBodyScansApi'

export declare module 'express-session' {
  // Declare that the session will potentially contain these additional fields
  interface SessionData {
    returnTo: string
  }
}

export declare global {
  namespace Express {
    interface User {
      username: string
      token: string
      authSource: string
    }

    interface Request {
      verified?: boolean
      id: string
      logout(done: (err: unknown) => void): void
    }

    interface Locals {
      user: PrisonUser
      prisoner: Prisoner & {
        displayName: string
        reversedDisplayName: string
      }
      scan?: ScanResponse
      cspNonce: string
      csrfToken: string
      feComponents: {
        header: string
        footer: string
        cssIncludes: string[]
        jsIncludes: string[]
        sharedData: SharedData
      }
      asset_path: string
      applicationName: string
      environmentName: string
      environmentNameColour: string
      appInsightsConnectionString?: string
      appInsightsApplicationName?: string
      buildNumber?: string
    }
  }
}
