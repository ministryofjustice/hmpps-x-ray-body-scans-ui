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

    it('another scan date', () => {
      const result = createScanForm.safeParse({
        scanDateOption: 'other',
        'scanDate-day': '21',
        'scanDate-month': '7',
        'scanDate-year': '2026',
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

    it.each(['', 'today', '0', '-1', '32'])('invalid scan date with day %j', day => {
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

      const errors = treeifyCreateScanFormErrors(result.error!)
      expect(errors).toEqual({
        errors: [],
        properties: { scanDate: { errors: ['Enter a valid date'] } },
      })
    })

    it.each(['', 'may', '0', '-1', '13'])('invalid scan date with month %j', month => {
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

      const errors = treeifyCreateScanFormErrors(result.error!)
      expect(errors).toEqual({
        errors: [],
        properties: { scanDate: { errors: ['Enter a valid date'] } },
      })
    })

    it.each(['', 'last', '0', '-1', '13'])('invalid scan date with year %j', year => {
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

      const errors = treeifyCreateScanFormErrors(result.error!)
      expect(errors).toEqual({
        errors: [],
        properties: { scanDate: { errors: ['Enter a valid date'] } },
      })
    })

    it.each([
      { scenario: 'missing', date: undefined },
      { scenario: 'blank', date: '' },
      { scenario: 'invalid', date: 'one' },
    ])('$scenario scan date', date => {
      const result = createScanForm.safeParse({
        scanDateOption: 'other',
        'scanDate-day': date,
        'scanDate-month': date,
        'scanDate-year': date,
        justification: 'INTELLIGENCE',
        outcome: 'NEGATIVE',
      } satisfies FormInput)
      expect(result.success).toBe(false)
      expect(result.data).toBeUndefined()

      const errors = treeifyCreateScanFormErrors(result.error!)
      expect(errors).toEqual({
        errors: [],
        properties: { scanDate: { errors: ['Enter a valid date'] } },
      })
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
      const result = createScanForm.safeParse(form)
      expect(result.success).toBe(false)
      expect(result.data).toBeUndefined()

      const errors = treeifyCreateScanFormErrors(result.error!)
      expect(errors).toEqual({
        errors: [],
        properties: { justification: { errors: ['Select why the scan was carried out'] } },
      })
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
      const result = createScanForm.safeParse(form)
      expect(result.success).toBe(false)
      expect(result.data).toBeUndefined()

      const errors = treeifyCreateScanFormErrors(result.error!)
      expect(errors).toEqual({
        errors: [],
        properties: { outcome: { errors: ['Select the result of the scan'] } },
      })
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
      const result = createScanForm.safeParse(form)
      expect(result.success).toBe(false)
      expect(result.data).toBeUndefined()

      const errors = treeifyCreateScanFormErrors(result.error!)
      expect(errors).toEqual({
        errors: [],
        properties: { typeOfFind: { errors: ['Select the type of item that was detected'] } },
      })
    })
  })
})
