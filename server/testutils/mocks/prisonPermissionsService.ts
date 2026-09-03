import { Forbidden } from 'http-errors'
import {
  type PrisonerPermission,
  isGranted,
  prisonerPermissionsGuard,
  PrisonerBasePermission,
} from '@ministryofjustice/hmpps-prison-permissions-lib'

// NB: required in test module:
// jest.mock('@ministryofjustice/hmpps-prison-permissions-lib')

export function mockGrantEveryPrisonerPermission(): void {
  jest.mocked(isGranted).mockReturnValue(true)
  jest.mocked(prisonerPermissionsGuard).mockImplementation((_service, _options) => {
    return async (_req, _res, next) => {
      next()
    }
  })
}

export function mockGrantNoPrisonerPermissions(): void {
  jest.mocked(isGranted).mockReturnValue(false)
  jest.mocked(prisonerPermissionsGuard).mockImplementation((_service, { requestDependentOn: requiredPermissions }) => {
    return async (_req, _res, next) => {
      next(new PrisonerPermissionError(requiredPermissions))
    }
  })
}

export function mockGrantPrisonerPermissions(...grantedPermissions: PrisonerPermission[]): void {
  jest.mocked(isGranted).mockImplementation((permission, _permissions) => {
    return grantedPermissions.includes(permission) ?? false
  })
  jest.mocked(prisonerPermissionsGuard).mockImplementation((_service, { requestDependentOn: requiredPermissions }) => {
    return async (_req, _res, next) => {
      const deniedPermissionChecks = requiredPermissions.filter(permission => !grantedPermissions.includes(permission))
      // TODO: res.locals.prisonerPermissions = { ...grantedPermissions }??
      if (deniedPermissionChecks.length) {
        next(new PrisonerPermissionError(deniedPermissionChecks))
      } else {
        next()
      }
    }
  })
}

export function mockGrantMinimalPrisonerPermissions(): void {
  return mockGrantPrisonerPermissions(PrisonerBasePermission.read)
}

// mimics unexported class used internally by permissions lib
class PrisonerPermissionError extends Forbidden {
  constructor(public readonly deniedPermissionChecks: PrisonerPermission[]) {
    super('Denied permissions')
  }
}
