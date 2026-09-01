import * as z from 'zod'
import type { Request } from 'express'
import { fixedClock } from '../testutils/fixedClock'
import { type ListScansForm, listScansForm } from './listScansForm'

type FormInput = z.input<typeof listScansForm>

beforeAll(() => {
  fixedClock()
})

describe('createScanForm', () => {
  it('should parse an empty form', () => {
    const result = listScansForm.safeParse({} satisfies Request['query'] satisfies FormInput)
    expect(result.success).toBe(true)
    expect(result.data).toEqual<ListScansForm>({
      historicYears: [2025, 2024],
      yearFilter: undefined,
      listScansRequest: { page: 0 },
    })
  })

  it.each([
    { year: '', expectedYearFilter: undefined, expectedScanDateFilters: {} },
    { year: undefined, expectedYearFilter: undefined, expectedScanDateFilters: {} },
    {
      year: '2025',
      expectedYearFilter: 2025,
      expectedScanDateFilters: { fromScanDate: new Date(2025, 0, 1, 12), toScanDate: new Date(2025, 11, 31, 12) },
    },
    {
      year: '2024',
      expectedYearFilter: 2024,
      expectedScanDateFilters: { fromScanDate: new Date(2024, 0, 1, 12), toScanDate: new Date(2024, 11, 31, 12) },
    },
    {
      year: ' 2024 ',
      expectedYearFilter: 2024,
      expectedScanDateFilters: { fromScanDate: new Date(2024, 0, 1, 12), toScanDate: new Date(2024, 11, 31, 12) },
    },
    {
      year: ['last', '2024'],
      expectedYearFilter: 2024,
      expectedScanDateFilters: { fromScanDate: new Date(2024, 0, 1, 12), toScanDate: new Date(2024, 11, 31, 12) },
    },
    {
      year: 'all',
      expectedYearFilter: 'all' as const,
      expectedScanDateFilters: { fromScanDate: new Date(2000, 0, 1, 12) },
    },
  ])('should parse a form with year $year', ({ year, expectedYearFilter, expectedScanDateFilters }) => {
    const result = listScansForm.safeParse({ year } satisfies Request['query'] satisfies FormInput)
    expect(result.success).toBe(true)
    expect(result.data).toEqual<ListScansForm>({
      historicYears: [2025, 2024],
      yearFilter: expectedYearFilter,
      listScansRequest: { ...expectedScanDateFilters, page: 0 },
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
    expect(result.data).toEqual<ListScansForm>({
      historicYears: [2025, 2024],
      yearFilter: undefined,
      listScansRequest: { page: 0 },
    })
  })

  it.each([
    { page: undefined, expected: 0 },
    { page: '', expected: 0 },
    { page: '0', expected: 0 },
    { page: '1', expected: 1 },
    { page: '100', expected: 100 },
    { page: ' 20 ', expected: 20 },
    { page: ['all', '5'], expected: 5 },
  ])('should parse a form with page $page', ({ page, expected }) => {
    const result = listScansForm.safeParse({ page } satisfies Request['query'] satisfies FormInput)
    expect(result.success).toBe(true)
    expect(result.data).toEqual<ListScansForm>({
      historicYears: [2025, 2024],
      yearFilter: undefined,
      listScansRequest: { page: expected },
    })
  })

  it.each(['one', '-1', '1.4'])('should ignore page %s when parsing a form', page => {
    const result = listScansForm.safeParse({ page } satisfies Request['query'] satisfies FormInput)
    expect(result.success).toBe(true)
    expect(result.data).toEqual<ListScansForm>({
      historicYears: [2025, 2024],
      yearFilter: undefined,
      listScansRequest: { page: 0 },
    })
  })

  it.each([
    { scenario: 'this year', year: undefined, expectedYearFilter: undefined, expectedScanDateFilters: {} },
    {
      scenario: 'last year',
      year: '2025',
      expectedYearFilter: 2025,
      expectedScanDateFilters: { fromScanDate: new Date(2025, 0, 1, 12), toScanDate: new Date(2025, 11, 31, 12) },
    },
  ])('should parse a form with all pages for $scenario', ({ year, expectedYearFilter, expectedScanDateFilters }) => {
    const result = listScansForm.safeParse({ page: 'all', year } satisfies Request['query'] satisfies FormInput)
    expect(result.success).toBe(true)
    expect(result.data).toEqual<ListScansForm>({
      historicYears: [2025, 2024],
      yearFilter: expectedYearFilter,
      listScansRequest: {
        ...expectedScanDateFilters,
        page: 0,
        size: 5000,
      },
    })
  })

  it('should only get first page for a form with all pages for all year', () => {
    const result = listScansForm.safeParse({ page: 'all', year: 'all' } satisfies Request['query'] satisfies FormInput)
    expect(result.success).toBe(true)
    expect(result.data).toEqual<ListScansForm>({
      historicYears: [2025, 2024],
      yearFilter: 'all',
      listScansRequest: {
        page: 0,
        fromScanDate: new Date(2000, 0, 1, 12),
      },
    })
  })

  it.each([
    { sort: 'scanDate', expected: 'scanDate,ASC' },
    { sort: ' scanDate ', expected: 'scanDate,ASC' },
    { sort: '-scanDate', expected: 'scanDate,DESC' },
  ] as const)('should parse a form with sort $sort', ({ sort, expected }) => {
    const result = listScansForm.safeParse({ sort } satisfies Request['query'] satisfies FormInput)
    expect(result.success).toBe(true)
    expect(result.data).toEqual<ListScansForm>({
      historicYears: [2025, 2024],
      yearFilter: undefined,
      listScansRequest: {
        page: 0,
        sort: expected,
      },
    })
  })

  it.each([undefined, '', 'prisonerNumber'])('should ignore sort %s when parsing a form', sort => {
    const result = listScansForm.safeParse({ sort } satisfies Request['query'] satisfies FormInput)
    expect(result.success).toBe(true)
    expect(result.data).toEqual<ListScansForm>({
      historicYears: [2025, 2024],
      yearFilter: undefined,
      listScansRequest: {
        page: 0,
        sort: undefined,
      },
    })
  })
})
