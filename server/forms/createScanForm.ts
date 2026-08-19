import * as z from 'zod'
import { formatIsoDate } from '../utils/dates'
import { justifications, outcomes, typesOfFind } from '../data/interfaces/xrayBodyScansApiClient'

const dayMillis = 24 * 60 * 60 * 1000

const messages = {
  selectScanDateOption: 'Select when the scan happened',
  enterDate: 'Enter a valid date',
  selectJustification: 'Select why the scan was carried out',
  selectOutcome: 'Select the result of the scan',
  selectTypeOfFind: 'Select the type of item that was detected',
}

export const createScanForm = z
  .object({
    scanDateOption: z.enum(['today', 'yesterday', 'other'], messages.selectScanDateOption),
    'scanDate-day': z.coerce.number(messages.enterDate).optional(),
    'scanDate-month': z.coerce.number(messages.enterDate).optional(),
    'scanDate-year': z.coerce.number(messages.enterDate).min(2000, messages.enterDate).optional(),
    justification: z.enum(justifications, messages.selectJustification),
    outcome: z.enum(outcomes, messages.selectOutcome),
    typeOfFind: z
      .enum(typesOfFind, messages.selectTypeOfFind)
      .optional()
      .transform(typeOfFind => typeOfFind ?? null),
  })
  .transform((form, ctx) => {
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
      const date = new Date(year, month - 1, day, 12)
      if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        // year, month or day wrapped around
        ctx.addIssue({
          code: 'custom',
          message: messages.enterDate,
          path: ['scanDate-day'],
        })
        return z.NEVER
      }
      // TODO: forbid future
      scanDate = formatIsoDate(date)
    } else {
      ctx.addIssue({
        code: 'custom',
        message: messages.enterDate,
        path: ['scanDate-day'],
      })
      return z.NEVER
    }

    if (outcome === 'POSITIVE' && !typeOfFind) {
      ctx.addIssue({
        code: 'custom',
        message: messages.selectTypeOfFind,
        path: ['typeOfFind'],
      })
      return z.NEVER
    }

    return {
      scanDate,
      outcome,
      justification,
      typeOfFind: outcome === 'POSITIVE' ? typeOfFind : null,
    }
  })

export function treeifyCreateScanFormErrors<S extends Record<string, unknown>>(error: z.ZodError<S>) {
  const errors = z.treeifyError(error)
  const scanDateErrors = new Set<string>()
  errors.properties = Object.fromEntries(
    Object.entries(errors.properties ?? {}).filter(([field, fieldErrors]) => {
      if (field.startsWith('scanDate-') && fieldErrors) {
        fieldErrors.errors.forEach(fieldError => scanDateErrors.add(fieldError))
        return false
      }
      return true
    }),
  )
  if (scanDateErrors.size > 0) {
    errors.properties.scanDate = { errors: [...scanDateErrors] }
  }
  return errors
}
