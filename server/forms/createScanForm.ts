import * as z from 'zod'
import { formatIsoDate } from '../utils/dates'
import { justifications, outcomes, typesOfFind } from '../data/interfaces/xrayBodyScansApiClient'
import type { ZodErrorTree } from './formErrors'

const dayMillis = 24 * 60 * 60 * 1000

const errorMessages = {
  invalidScanDateOption: 'Select when the scan happened',
  invalidScanDate: 'Enter a real date',
  scanDateBlankComponent(component?: 'year' | 'month' | 'day'): string {
    if (!component) {
      return 'The scan date must include a day, month and year'
    }
    return `The scan date must include a ${component}`
  },
  futureScanDate: 'The scan date cannot be in the future',
  // TODO: oldScanDate: 'Enter a scan date within the last week/month',
  invalidJustification: 'Select why the scan was carried out',
  invalidOutcome: 'Select the result of the scan',
  invalidTypeOfFind: 'Select type of item detected',
}

const baseCreateScanForm = z.object({
  scanDateOption: z.enum(['today', 'yesterday', 'other'], errorMessages.invalidScanDateOption),
  'scanDate-day': z.string().optional(),
  'scanDate-month': z.string().optional(),
  'scanDate-year': z.string().optional(),
  justification: z.enum(justifications, errorMessages.invalidJustification),
  outcome: z.enum(outcomes, errorMessages.invalidOutcome),
  typeOfFind: z.enum(typesOfFind, errorMessages.invalidTypeOfFind).optional(),
})

export const createScanForm = baseCreateScanForm
  // check type of find when required
  .refine(({ outcome, typeOfFind }) => outcome !== 'POSITIVE' || typeOfFind, {
    when(payload) {
      return baseCreateScanForm.pick({ outcome: true, typeOfFind: true }).safeParse(payload.value).success
    },
    error: errorMessages.invalidTypeOfFind,
    path: ['typeOfFind'],
  })
  // check custom scan date
  .superRefine(
    (form, ctx) => {
      const { scanDateOption } = form
      if (scanDateOption !== 'other') {
        return
      }

      const { 'scanDate-day': dayStr, 'scanDate-month': monthStr, 'scanDate-year': yearStr } = form
      const day = strictParseInt(dayStr, 1, 31)
      const month = strictParseInt(monthStr, 1, 12)
      const year = strictParseInt(yearStr, 2000)
      const components = [day, month, year]
      const componentNames = ['day', 'month', 'year'] as const

      const someInvalidComponent = components.some(component => component === 'invalid')
      const blankComponentCount = components.reduce(
        (count: number, component) => (component === 'blank' ? count + 1 : count),
        0,
      )
      let componentErrorMessage: string | undefined // the worst error message all components will share
      if (someInvalidComponent) {
        componentErrorMessage = errorMessages.invalidScanDate
      } else if (blankComponentCount >= 2) {
        componentErrorMessage = errorMessages.scanDateBlankComponent()
      } else if (blankComponentCount) {
        componentNames.forEach((componentName, index) => {
          const isBlank = components[index] === 'blank'
          if (isBlank) {
            componentErrorMessage = errorMessages.scanDateBlankComponent(componentName)
          }
        })
      }

      if (componentErrorMessage) {
        componentNames.forEach((componentName, index) => {
          const hasError = components[index] === 'blank' || components[index] === 'invalid'
          if (hasError) {
            ctx.addIssue({
              code: 'custom',
              message: componentErrorMessage,
              path: [`scanDate-${componentName}`],
            })
          }
        })
        return
      }

      if (typeof day !== 'number' || typeof month !== 'number' || typeof year !== 'number') {
        // NB: needed to convince typescript that day, month and year are numbers
        throw new Error('unreachable')
      }

      const date = new Date(year, month - 1, day, 12)

      if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        // year, month or day wrapped around
        ctx.addIssue({
          code: 'custom',
          message: errorMessages.invalidScanDate,
          path: ['scanDate'],
        })
        return
      }

      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      if (formatIsoDate(date) >= formatIsoDate(tomorrow)) {
        // future date
        ctx.addIssue({
          code: 'custom',
          message: errorMessages.futureScanDate,
          path: ['scanDate'],
        })
      }

      // TODO: forbid old dates
    },
    {
      when(payload) {
        return baseCreateScanForm
          .pick({ scanDateOption: true, 'scanDate-day': true, 'scanDate-month': true, 'scanDate-year': true })
          .safeParse(payload.value).success
      },
    },
  )
  // calculate scan date and clear type of find when not needed
  .transform(form => {
    const {
      scanDateOption,
      'scanDate-day': day,
      'scanDate-month': month,
      'scanDate-year': year,
      justification,
      outcome,
      typeOfFind,
    } = form

    let scanDate: string
    if (scanDateOption === 'today') {
      scanDate = formatIsoDate(new Date())
    } else if (scanDateOption === 'yesterday') {
      scanDate = formatIsoDate(new Date(Date.now() - dayMillis))
    } else if (year && month && day) {
      const date = new Date(Number.parseInt(year, 10), Number.parseInt(month, 10) - 1, Number.parseInt(day, 10), 12)
      scanDate = formatIsoDate(date)
    } else {
      // NB: unreachable because of previous refinement but needed to convince typescript
      throw new Error('unreachable')
    }

    return {
      scanDate,
      outcome,
      justification,
      typeOfFind: outcome === 'POSITIVE' ? (typeOfFind ?? null) : null,
    }
  })

export type CreateScanForm = z.infer<typeof createScanForm>

type ScanDateComponents = 'scanDate-year' | 'scanDate-month' | 'scanDate-day'
export interface CreateScanFormErrors {
  /** A zod error tree for the scan creation form */
  errors: ZodErrorTree<CreateScanForm>
  /** The set of scan date component fields which have errors */
  scanDateComponentsWithErrors: Set<ScanDateComponents>
}

export function treeifyCreateScanFormErrors(error: z.ZodError<CreateScanForm>): CreateScanFormErrors {
  const errors = z.treeifyError(error)

  const scanDateErrors = new Set<string>(errors?.properties?.scanDate?.errors)
  const scanDateComponentFields = ['scanDate-year', 'scanDate-month', 'scanDate-day'] as const
  const scanDateComponentsWithErrors = new Set<ScanDateComponents>()

  errors.properties = Object.fromEntries(
    Object.entries(errors.properties ?? {}).filter(([field, fieldErrors]) => {
      if (scanDateComponentFields.includes(field as never) && fieldErrors) {
        scanDateComponentsWithErrors.add(field as ScanDateComponents)
        fieldErrors.errors.forEach(fieldError => scanDateErrors.add(fieldError))
        return false
      }
      return true
    }),
  )
  if (scanDateErrors.size > 0) {
    errors.properties = {
      scanDate: { errors: [...scanDateErrors] },
      ...errors.properties,
    }
  }
  return { errors, scanDateComponentsWithErrors }
}

function strictParseInt(input: string | undefined, min: number, max?: number): number | 'blank' | 'invalid' {
  if (input === undefined || input.length === 0) {
    return 'blank'
  }
  const int = Number.parseFloat(input)
  if (Number.isSafeInteger(int) && int >= min && (max === undefined || int <= max)) {
    return int
  }
  return 'invalid'
}
