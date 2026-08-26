import * as z from 'zod'
import { justifications, outcomes, typesOfFind } from '../data/interfaces/xrayBodyScansApiClient'
import { fixedClock } from '../testutils/fixedClock'
import { createScanForm, treeifyCreateScanFormErrors } from './createScanForm'

type FormInput = z.input<typeof createScanForm>

beforeAll(() => {
  fixedClock()
})

describe('createScanForm', () => {
  describe('should parse', () => {
    it.each([
      { scanDateOption: 'today' as const, expectedScanDate: '2026-07-24' },
      { scanDateOption: 'yesterday' as const, expectedScanDate: '2026-07-23' },
    ])('$scanDateOption as the scan date', ({ scanDateOption, expectedScanDate }) => {
      const result = createScanForm.safeParse({
        scanDateOption,
        justification: 'INTELLIGENCE',
        outcome: 'NEGATIVE',
      } satisfies FormInput)
      expect(result.success).toBe(true)
      expect(result.data?.scanDate).toEqual(expectedScanDate)
      expect(result.error).toBeUndefined()
    })

    it.each([
      ['21', '7', '2026'],
      ['21', '07', '2026'],
      ['21 ', ' 7 ', ' 2026'],
    ])('another scan date: %s/%s/%s', (day, month, year) => {
      const result = createScanForm.safeParse({
        scanDateOption: 'other',
        'scanDate-day': day,
        'scanDate-month': month,
        'scanDate-year': year,
        justification: 'INTELLIGENCE',
        outcome: 'NEGATIVE',
      } satisfies FormInput)
      expect(result.success).toBe(true)
      expect(result.data?.scanDate).toEqual('2026-07-21')
      expect(result.error).toBeUndefined()
    })

    it.each(justifications)('justification: %s', justification => {
      const result = createScanForm.safeParse({
        scanDateOption: 'today',
        justification,
        outcome: 'NEGATIVE',
      } satisfies FormInput)
      expect(result.success).toBe(true)
      expect(result.data?.justification).toEqual(justification)
      expect(result.error).toBeUndefined()
    })

    it.each(outcomes.filter(outcome => outcome !== 'POSITIVE'))('outcome: %s (and clear typeOfFind)', outcome => {
      const result = createScanForm.safeParse({
        scanDateOption: 'today',
        justification: 'INTELLIGENCE',
        outcome,
        typeOfFind: 'NOT_KNOWN',
      } satisfies FormInput)
      expect(result.success).toBe(true)
      expect(result.data?.outcome).toEqual(outcome)
      expect(result.data?.typeOfFind).toBeNull()
      expect(result.error).toBeUndefined()
    })

    it.each(typesOfFind)('type of find: %s', typeOfFind => {
      const result = createScanForm.safeParse({
        scanDateOption: 'today',
        justification: 'INTELLIGENCE',
        outcome: 'POSITIVE',
        typeOfFind,
      } satisfies FormInput)
      expect(result.success).toBe(true)
      expect(result.data?.outcome).toEqual('POSITIVE')
      expect(result.data?.typeOfFind).toEqual(typeOfFind)
      expect(result.error).toBeUndefined()
    })
  })

  describe('should not parse', () => {
    it.each([undefined, null, [], {}, '', 'a=1'])('invalid form value %j', body => {
      const result = createScanForm.safeParse(body)
      expect(result.success).toBe(false)
      expect(result.data).toBeUndefined()
    })

    it.each(['year', 'month', 'day'] as const)('invalid scan date with blank %s', blankComponent => {
      const result = createScanForm.safeParse({
        scanDateOption: 'other',
        'scanDate-day': blankComponent === 'day' ? '' : '10',
        'scanDate-month': blankComponent === 'month' ? '' : '7',
        'scanDate-year': blankComponent === 'year' ? '' : '2026',
        justification: 'INTELLIGENCE',
        outcome: 'NEGATIVE',
      } satisfies FormInput)
      expect(result.success).toBe(false)
      expect(result.data).toBeUndefined()

      const { errors, scanDateComponentsWithErrors } = treeifyCreateScanFormErrors(result.error!)
      expect(errors).toEqual({
        errors: [],
        properties: { scanDate: { errors: [`The scan date must include a ${blankComponent}`] } },
      })
      expect(scanDateComponentsWithErrors).toEqual(new Set([`scanDate-${blankComponent}`]))
    })

    it.each([
      { scenario: 'components', blankComponents: ['year', 'month', 'day'] },
      { scenario: 'year and month', blankComponents: ['year', 'month'] },
      { scenario: 'year and day', blankComponents: ['year', 'day'] },
      { scenario: 'month and day', blankComponents: ['month', 'day'] },
    ])('invalid scan date with blank $scenario', ({ blankComponents }) => {
      const result = createScanForm.safeParse({
        scanDateOption: 'other',
        'scanDate-day': blankComponents.includes('day') ? '' : '10',
        'scanDate-month': blankComponents.includes('month') ? '' : '7',
        'scanDate-year': blankComponents.includes('year') ? '' : '2026',
        justification: 'INTELLIGENCE',
        outcome: 'NEGATIVE',
      } satisfies FormInput)
      expect(result.success).toBe(false)
      expect(result.data).toBeUndefined()

      const { errors, scanDateComponentsWithErrors } = treeifyCreateScanFormErrors(result.error!)
      expect(errors).toEqual({
        errors: [],
        properties: { scanDate: { errors: ['The scan date must include a day, month and year'] } },
      })
      expect(scanDateComponentsWithErrors).toHaveProperty('size', blankComponents.length)
    })

    it.each(['today', '0', '1.5', '-1', '32'])('invalid scan date with day %j', day => {
      const result = createScanForm.safeParse({
        scanDateOption: 'other',
        'scanDate-day': day,
        'scanDate-month': '7',
        'scanDate-year': '2026',
        justification: 'INTELLIGENCE',
        outcome: 'NEGATIVE',
      } satisfies FormInput)
      expect(result.success).toBe(false)
      expect(result.data).toBeUndefined()

      const { errors, scanDateComponentsWithErrors } = treeifyCreateScanFormErrors(result.error!)
      expect(errors).toEqual({
        errors: [],
        properties: { scanDate: { errors: ['Enter a real date'] } },
      })
      expect(scanDateComponentsWithErrors).toEqual(new Set(['scanDate-day']))
    })

    it.each(['may', '0', '1.5', '-1', '13'])('invalid scan date with month %j', month => {
      const result = createScanForm.safeParse({
        scanDateOption: 'other',
        'scanDate-day': '10',
        'scanDate-month': month,
        'scanDate-year': '2026',
        justification: 'INTELLIGENCE',
        outcome: 'NEGATIVE',
      } satisfies FormInput)
      expect(result.success).toBe(false)
      expect(result.data).toBeUndefined()

      const { errors, scanDateComponentsWithErrors } = treeifyCreateScanFormErrors(result.error!)
      expect(errors).toEqual({
        errors: [],
        properties: { scanDate: { errors: ['Enter a real date'] } },
      })
      expect(scanDateComponentsWithErrors).toEqual(new Set(['scanDate-month']))
    })

    it.each(['last', '0', '1.5', '-1', '26'])('invalid scan date with year %j', year => {
      const result = createScanForm.safeParse({
        scanDateOption: 'other',
        'scanDate-day': '10',
        'scanDate-month': '7',
        'scanDate-year': year,
        justification: 'INTELLIGENCE',
        outcome: 'NEGATIVE',
      } satisfies FormInput)
      expect(result.success).toBe(false)
      expect(result.data).toBeUndefined()

      const { errors, scanDateComponentsWithErrors } = treeifyCreateScanFormErrors(result.error!)
      expect(errors).toEqual({
        errors: [],
        properties: { scanDate: { errors: ['Enter a real date'] } },
      })
      expect(scanDateComponentsWithErrors).toEqual(new Set(['scanDate-year']))
    })

    it.each([
      { scenario: 'components', invalidComponents: ['year', 'month', 'day'] },
      { scenario: 'year and month', invalidComponents: ['year', 'month'] },
      { scenario: 'year and day', invalidComponents: ['year', 'day'] },
      { scenario: 'month and day', invalidComponents: ['month', 'day'] },
    ])('invalid scan date with invalid $scenario', ({ invalidComponents }) => {
      const result = createScanForm.safeParse({
        scanDateOption: 'other',
        'scanDate-day': invalidComponents.includes('day') ? 'today' : '10',
        'scanDate-month': invalidComponents.includes('month') ? 'may' : '7',
        'scanDate-year': invalidComponents.includes('year') ? 'last' : '2026',
        justification: 'INTELLIGENCE',
        outcome: 'NEGATIVE',
      } satisfies FormInput)
      expect(result.success).toBe(false)
      expect(result.data).toBeUndefined()

      const { errors, scanDateComponentsWithErrors } = treeifyCreateScanFormErrors(result.error!)
      expect(errors).toEqual({
        errors: [],
        properties: { scanDate: { errors: ['Enter a real date'] } },
      })
      expect(scanDateComponentsWithErrors).toHaveProperty('size', invalidComponents.length)
    })

    it('invalid scan date with blank and invalid components', () => {
      const result = createScanForm.safeParse({
        scanDateOption: 'other',
        'scanDate-day': '10',
        'scanDate-month': '26',
        'scanDate-year': '',
        justification: 'INTELLIGENCE',
        outcome: 'NEGATIVE',
      } satisfies FormInput)
      expect(result.success).toBe(false)
      expect(result.data).toBeUndefined()

      const { errors, scanDateComponentsWithErrors } = treeifyCreateScanFormErrors(result.error!)
      expect(errors).toEqual({
        errors: [],
        // invalid error takes precedence over blank
        properties: { scanDate: { errors: ['Enter a real date'] } },
      })
      expect(scanDateComponentsWithErrors).toEqual(new Set(['scanDate-month', 'scanDate-year']))
    })

    it.each([['30', '2', '2026', new Date(2026, 2, 3, 12)]])('invalid scan date %s/%s/%s', (day, month, year, now) => {
      fixedClock(now)
      const result = createScanForm.safeParse({
        scanDateOption: 'other',
        'scanDate-day': day,
        'scanDate-month': month,
        'scanDate-year': year,
        justification: 'INTELLIGENCE',
        outcome: 'NEGATIVE',
      } satisfies FormInput)
      expect(result.success).toBe(false)
      expect(result.data).toBeUndefined()

      const { errors, scanDateComponentsWithErrors } = treeifyCreateScanFormErrors(result.error!)
      expect(errors).toEqual({
        errors: [],
        properties: { scanDate: { errors: ['Enter a real date'] } },
      })
      expect(scanDateComponentsWithErrors).toEqual(new Set())
    })

    it('future scan date', () => {
      const result = createScanForm.safeParse({
        scanDateOption: 'other',
        'scanDate-day': '25',
        'scanDate-month': '7',
        'scanDate-year': '2026',
        justification: 'INTELLIGENCE',
        outcome: 'NEGATIVE',
      } satisfies FormInput)
      expect(result.success).toBe(false)
      expect(result.data).toBeUndefined()

      const { errors, scanDateComponentsWithErrors } = treeifyCreateScanFormErrors(result.error!)
      expect(errors).toEqual({
        errors: [],
        properties: { scanDate: { errors: ['The scan date cannot be in the future'] } },
      })
      expect(scanDateComponentsWithErrors).toEqual(new Set())
    })

    it.each([
      { scenario: 'missing', justification: undefined },
      { scenario: 'blank', justification: '' },
      { scenario: 'invalid', justification: 'intel' },
    ])('$scenario justification', ({ justification }) => {
      const form = {
        scanDateOption: 'today',
        justification,
        outcome: 'NEGATIVE',
      }
      if (justification === undefined) {
        delete form.justification
      }
      const result = createScanForm.safeParse(form)
      expect(result.success).toBe(false)
      expect(result.data).toBeUndefined()

      const { errors, scanDateComponentsWithErrors } = treeifyCreateScanFormErrors(result.error!)
      expect(errors).toEqual({
        errors: [],
        properties: { justification: { errors: ['Select why the scan was carried out'] } },
      })
      expect(scanDateComponentsWithErrors).toEqual(new Set())
    })

    it.each([
      { scenario: 'missing', outcome: undefined },
      { scenario: 'blank', outcome: '' },
      { scenario: 'invalid', outcome: 'unclear' },
    ])('$scenario outcome', ({ outcome }) => {
      const form = {
        scanDateOption: 'today',
        justification: 'INTELLIGENCE',
        outcome,
      }
      if (outcome === undefined) {
        delete form.outcome
      }
      const result = createScanForm.safeParse(form)
      expect(result.success).toBe(false)
      expect(result.data).toBeUndefined()

      const { errors, scanDateComponentsWithErrors } = treeifyCreateScanFormErrors(result.error!)
      expect(errors).toEqual({
        errors: [],
        properties: { outcome: { errors: ['Select the result of the scan'] } },
      })
      expect(scanDateComponentsWithErrors).toEqual(new Set())
    })

    it.each([
      { scenario: 'missing', typeOfFind: undefined },
      { scenario: 'blank', typeOfFind: '' },
      { scenario: 'invalid', typeOfFind: 'mobile' },
    ])('$scenario type of find', ({ typeOfFind }) => {
      const form = {
        scanDateOption: 'today',
        justification: 'INTELLIGENCE',
        outcome: 'POSITIVE',
        typeOfFind,
      }
      if (typeOfFind === undefined) {
        delete form.typeOfFind
      }
      const result = createScanForm.safeParse(form)
      expect(result.success).toBe(false)
      expect(result.data).toBeUndefined()

      const { errors, scanDateComponentsWithErrors } = treeifyCreateScanFormErrors(result.error!)
      expect(errors).toEqual({
        errors: [],
        properties: { typeOfFind: { errors: ['Select type of item detected'] } },
      })
      expect(scanDateComponentsWithErrors).toEqual(new Set())
    })

    it('form with many errors', () => {
      const result = createScanForm.safeParse({
        scanDateOption: 'tomorrow',
        justification: 'intel',
        outcome: 'item found',
        typeOfFind: 'unclear',
      })
      expect(result.success).toBe(false)
      expect(result.data).toBeUndefined()

      const { errors, scanDateComponentsWithErrors } = treeifyCreateScanFormErrors(result.error!)
      expect(errors).toEqual({
        errors: [],
        properties: {
          scanDateOption: { errors: ['Select when the scan happened'] },
          justification: { errors: ['Select why the scan was carried out'] },
          outcome: { errors: ['Select the result of the scan'] },
          typeOfFind: { errors: ['Select type of item detected'] },
        },
      })
      expect(scanDateComponentsWithErrors).toEqual(new Set())
    })

    it('form with dependent errors', () => {
      const result = createScanForm.safeParse({
        scanDateOption: 'other',
        'scanDate-day': '',
        'scanDate-month': '7',
        'scanDate-year': '2026',
        justification: 'INTELLIGENCE',
        outcome: '',
      })
      expect(result.success).toBe(false)
      expect(result.data).toBeUndefined()

      const { errors, scanDateComponentsWithErrors } = treeifyCreateScanFormErrors(result.error!)
      expect(errors).toEqual({
        errors: [],
        properties: {
          // scan date is checked in super refinement despite base schema errors
          scanDate: { errors: ['The scan date must include a day'] },
          outcome: { errors: ['Select the result of the scan'] },
        },
      })
      expect(scanDateComponentsWithErrors).toEqual(new Set(['scanDate-day']))
    })
  })
})
