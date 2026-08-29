/* eslint-disable no-param-reassign */
import * as z from 'zod'
import type { ListScansRequest } from '../data/interfaces/xrayBodyScansApi'

const historicYearsToShow = 2
function getHistoricYears(): number[] {
  const currentYear = new Date().getFullYear()
  return Array.from({ length: historicYearsToShow }).map((_, i) => currentYear - i - 1)
}

const optionalNumber = z.preprocess(
  // preprocess '' to undefined otherwise it coerces to 0
  v => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.coerce.number().optional(),
)

const baseListScansForm = z.preprocess(
  (form: Record<string, string | string[] | undefined>) => {
    // take the last value for any repeated parameters
    if (form && typeof form === 'object') {
      Object.getOwnPropertyNames(form).forEach(field => {
        if (Array.isArray(form[field])) {
          form[field] = form[field].at(-1)
        }
      })
    }
    return form
  },
  z.object({
    year: z.union([z.literal('all'), optionalNumber]),
    page: optionalNumber.default(0), // TODO: all pages
  }),
)

export const listScansForm = baseListScansForm
  // force defaults when there’s an error
  .superRefine(
    (form, ctx) => {
      ctx.issues = ctx.issues.filter(issue => {
        const field = issue?.path?.[0]
        if (field === 'year') {
          form.year = undefined
          return false
        }
        if (field === 'page') {
          form.page = 0
          return false
        }
        return true
      })
    },
    {
      when(payload) {
        return !baseListScansForm.safeParse(payload.value).success
      },
    },
  )
  // transform into ListScansRequest and variables needed by the scansList.njk template
  .transform(({ year, page }) => {
    const historicYears = getHistoricYears()
    if (typeof year === 'number' && !historicYears.includes(year)) {
      year = undefined
    }

    if (!Number.isSafeInteger(page) || page < 0) {
      page = 0
    }

    const listScansRequest: ListScansRequest = { page }
    if (year === 'all') {
      listScansRequest.fromScanDate = new Date(2000, 0, 1, 12)
    } else if (typeof year === 'number') {
      const fromScanDate = new Date(year, 0, 1, 12)
      const toScanDate = new Date(year + 1, 0, 1, 12)
      toScanDate.setDate(toScanDate.getDate() - 1)
      listScansRequest.fromScanDate = fromScanDate
      listScansRequest.toScanDate = toScanDate
    }

    return {
      historicYears,
      yearFilter: year,
      listScansRequest,
    }
  })

export type ListScansForm = z.infer<typeof listScansForm>
