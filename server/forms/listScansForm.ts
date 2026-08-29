import * as z from 'zod'
import type { ListScansRequest } from '../data/interfaces/xrayBodyScansApi'

const historicYearsToShow = 2
function getHistoricYears(): number[] {
  const currentYear = new Date().getFullYear()
  return Array.from({ length: historicYearsToShow }).map((_, i) => currentYear - i - 1)
}

const baseListScansForm = z.preprocess(
  form => {
    if (form && typeof form === 'object' && 'year' in form && Array.isArray(form.year)) {
      // eslint-disable-next-line no-param-reassign
      form.year = form.year.at(-1)
    }
    return form
  },
  z.union([
    z.object({ year: z.literal('all') }),
    z.object({
      year: z.preprocess(v => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.coerce.number().optional()),
    }),
  ]),
)

export const listScansForm = baseListScansForm
  .superRefine(
    // force year filter to undefined if there’s an error
    (form, ctx) => {
      ctx.issues = ctx.issues.filter(issue => issue?.path?.[0] === 'year')
      // eslint-disable-next-line no-param-reassign
      form.year = undefined
    },
    {
      when(payload) {
        return !baseListScansForm.safeParse(payload.value).success
      },
    },
  )
  .transform(({ year }) => {
    const historicYears = getHistoricYears()
    if (typeof year === 'number' && !historicYears.includes(year)) {
      // eslint-disable-next-line no-param-reassign
      year = undefined
    }

    const listScansRequest: ListScansRequest = {}
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
