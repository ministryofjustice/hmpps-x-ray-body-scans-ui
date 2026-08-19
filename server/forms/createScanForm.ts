import * as z from 'zod'
import { formatIsoDate } from '../utils/dates'
import { justifications, outcomes, typesOfFind } from '../data/interfaces/xrayBodyScansApiClient'
import type { ZodErrorTree } from './formErrors'

const dayMillis = 24 * 60 * 60 * 1000

const messages = {
  selectScanDateOption: 'Select when the scan happened',
  enterDate: 'Enter a valid date',
  selectJustification: 'Select why the scan was carried out',
  selectOutcome: 'Select the result of the scan',
  selectTypeOfFind: 'Select the type of item that was detected',
}

const baseCreateScanForm = z.object({
  scanDateOption: z.enum(['today', 'yesterday', 'other'], messages.selectScanDateOption),
  'scanDate-day': z.coerce.number(messages.enterDate).optional(),
  'scanDate-month': z.coerce.number(messages.enterDate).optional(),
  'scanDate-year': z.coerce.number(messages.enterDate).optional(),
  justification: z.enum(justifications, messages.selectJustification),
  outcome: z.enum(outcomes, messages.selectOutcome),
  typeOfFind: z.enum(typesOfFind, messages.selectTypeOfFind).optional(),
})

export const createScanForm = baseCreateScanForm
  .refine(({ outcome, typeOfFind }) => outcome !== 'POSITIVE' || typeOfFind, {
    when(payload) {
      return baseCreateScanForm.pick({ outcome: true, typeOfFind: true }).safeParse(payload.value).success
    },
    error: messages.selectTypeOfFind,
    path: ['typeOfFind'],
  })
  .refine(
    form => {
      const { scanDateOption, 'scanDate-day': day, 'scanDate-month': month, 'scanDate-year': year } = form
      if (scanDateOption === 'other') {
        if (year && month && day && year >= 2000) {
          const date = new Date(year, month - 1, day, 12)
          // check whether year, month or day wrapped around
          return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
          // TODO: forbid future
        }
        return false
      }
      return true
    },
    {
      when(payload) {
        return baseCreateScanForm
          .pick({ scanDateOption: true, 'scanDate-day': true, 'scanDate-month': true, 'scanDate-year': true })
          .safeParse(payload.value).success
      },
      error: messages.enterDate,
      path: ['scanDate-day'],
    },
  )
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

    let scanDate: string = ''
    if (scanDateOption === 'today') {
      scanDate = formatIsoDate(new Date())
    } else if (scanDateOption === 'yesterday') {
      scanDate = formatIsoDate(new Date(Date.now() - dayMillis))
    } else if (year && month && day && year >= 2000) {
      const date = new Date(year, month - 1, day, 12)
      scanDate = formatIsoDate(date)
    }

    return {
      scanDate,
      outcome,
      justification,
      typeOfFind: outcome === 'POSITIVE' ? (typeOfFind ?? null) : null,
    }
  })

export type CreateScanForm = z.infer<typeof createScanForm>

export function treeifyCreateScanFormErrors(error: z.ZodError<CreateScanForm>): ZodErrorTree<CreateScanForm> {
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
    errors.properties = {
      scanDate: { errors: [...scanDateErrors] },
      ...errors.properties,
    }
  }
  return errors
}
