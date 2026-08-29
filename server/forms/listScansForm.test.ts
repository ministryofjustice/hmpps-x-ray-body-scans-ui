import * as z from 'zod'
import type { Request } from 'express'
import { fixedClock } from '../testutils/fixedClock'
import { listScansForm } from './listScansForm'

type FormInput = z.input<typeof listScansForm>

beforeAll(() => {
  fixedClock()
})

describe('createScanForm', () => {
  it('should parse an empty form', () => {
    const result = listScansForm.safeParse({} satisfies Request['query'] satisfies FormInput)
    expect(result.success).toBe(true)
    expect(result.data).toEqual({
      historicYears: [2025, 2024],
      yearFilter: undefined,
      listScansRequest: {},
    })
  })

  it.each([
    { year: '', expectedYearFilter: undefined, expectedListScansRequest: {} },
    { year: undefined, expectedYearFilter: undefined, expectedListScansRequest: {} },
    {
      year: '2025',
      expectedYearFilter: 2025,
      expectedListScansRequest: { fromScanDate: new Date(2025, 0, 1, 12), toScanDate: new Date(2025, 11, 31, 12) },
    },
    {
      year: '2024',
      expectedYearFilter: 2024,
      expectedListScansRequest: { fromScanDate: new Date(2024, 0, 1, 12), toScanDate: new Date(2024, 11, 31, 12) },
    },
    {
      year: ' 2024 ',
      expectedYearFilter: 2024,
      expectedListScansRequest: { fromScanDate: new Date(2024, 0, 1, 12), toScanDate: new Date(2024, 11, 31, 12) },
    },
    {
      year: ['all', '2024'],
      expectedYearFilter: 2024,
      expectedListScansRequest: { fromScanDate: new Date(2024, 0, 1, 12), toScanDate: new Date(2024, 11, 31, 12) },
    },
    {
      year: 'all',
      expectedYearFilter: 'all',
      expectedListScansRequest: { fromScanDate: new Date(2000, 0, 1, 12) },
    },
  ])('should parse a form with year $year', ({ year, expectedYearFilter, expectedListScansRequest }) => {
    const result = listScansForm.safeParse({ year } satisfies Request['query'] satisfies FormInput)
    expect(result.success).toBe(true)
    expect(result.data).toEqual({
      historicYears: [2025, 2024],
      yearFilter: expectedYearFilter,
      listScansRequest: expectedListScansRequest,
    })
  })

  it.each([
    { year: '2027' },
    { year: '2026' },
    { year: '2023' },
    { year: '25' },
    { year: 'current' },
    { year: 'last' },
  ])('should ignore year $year when parsing a form', ({ year }) => {
    const result = listScansForm.safeParse({ year } satisfies Request['query'] satisfies FormInput)
    expect(result.success).toBe(true)
    expect(result.data).toEqual({
      historicYears: [2025, 2024],
      yearFilter: undefined,
      listScansRequest: {},
    })
  })
})
