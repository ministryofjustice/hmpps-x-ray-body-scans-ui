import express from 'express'
import nunjucks from 'nunjucks'
import { emptyPageResponse, pageResponse } from '../testutils/pagination'
import nunjucksSetup from './nunjucksSetup'
import type { PageRequest } from '../data/interfaces/pagination'
import { type Pagination, paginate, sortable } from './paginate'

describe('paginate', () => {
  let njkEnv: nunjucks.Environment

  beforeAll(() => {
    njkEnv = nunjucksSetup(express())
  })

  function renderPagination(pagination: Pagination | null): string {
    return njkEnv
      .renderString(
        `
        {% from "components/pagination.njk" import paginate %}
        {{ paginate(pagination) }}
        `,
        { pagination },
      )
      .trim()
      .replaceAll(/<\/?[^>]+>/g, '') // remove all html tags to get pure text content
  }

  it('should handle an empty page response and render nothing', () => {
    const pagination = paginate(emptyPageResponse(), '/')
    expect(pagination).toBeNull()

    const rendered = renderPagination(pagination)
    expect(rendered).toEqual('')
  })

  it.each([
    { scenario: 'one result', response: pageResponse([1]), n: 1 },
    { scenario: 'one page of results', response: pageResponse([1, 2, 3]), n: 3 },
  ])('should handle $scenario and render no links', ({ response, n }) => {
    const pagination = paginate(response, '/')
    expect(pagination).toEqual<Pagination>({
      showing: [1, n, n],
    })

    const rendered = renderPagination(pagination)
    expect(rendered).toContain(`Showing 1 to ${n} of ${n} result`)
    expect(rendered).not.toContain('View all')
  })

  it('should handle first page of 8 with all links showing', () => {
    const pagination = paginate(
      {
        content: [], // invalid, but ignored anyway
        numberOfElements: 20,
        totalElements: 155,
        number: 0,
        totalPages: 8,
        size: 20,
      },
      '/',
    )
    expect(pagination).toEqual<Pagination>({
      govukPagination: {
        items: [
          { number: '1', href: '/?page=0', current: true },
          { number: '2', href: '/?page=1', current: false },
          { number: '3', href: '/?page=2', current: false },
          { number: '4', href: '/?page=3', current: false },
          { number: '5', href: '/?page=4', current: false },
          { number: '6', href: '/?page=5', current: false },
          { number: '7', href: '/?page=6', current: false },
          { number: '8', href: '/?page=7', current: false },
        ],
        next: { href: '/?page=1' },
      },
      showing: [1, 20, 155],
      viewAllUrl: '/?page=all',
    })

    const rendered = renderPagination(pagination)
    expect(rendered).toContain('Showing 1 to 20 of 155 results')
    expect(rendered).toContain('View all')
  })

  it('should handle second page of 8 with all links showing', () => {
    const pagination = paginate(
      {
        content: [], // invalid, but ignored anyway
        numberOfElements: 20,
        totalElements: 155,
        number: 1,
        totalPages: 8,
        size: 20,
      },
      '/',
    )
    expect(pagination).toEqual<Pagination>({
      govukPagination: {
        previous: { href: '/?page=0' },
        items: [
          { number: '1', href: '/?page=0', current: false },
          { number: '2', href: '/?page=1', current: true },
          { number: '3', href: '/?page=2', current: false },
          { number: '4', href: '/?page=3', current: false },
          { number: '5', href: '/?page=4', current: false },
          { number: '6', href: '/?page=5', current: false },
          { number: '7', href: '/?page=6', current: false },
          { number: '8', href: '/?page=7', current: false },
        ],
        next: { href: '/?page=2' },
      },
      showing: [21, 40, 155],
      viewAllUrl: '/?page=all',
    })

    const rendered = renderPagination(pagination)
    expect(rendered).toContain('Showing 21 to 40 of 155 results')
    expect(rendered).toContain('View all')
  })

  it('should handle last page of 8 with all links showing', () => {
    const pagination = paginate(
      {
        content: [], // invalid, but ignored anyway
        numberOfElements: 15,
        totalElements: 155,
        number: 7,
        totalPages: 8,
        size: 20,
      },
      '/',
    )
    expect(pagination).toEqual<Pagination>({
      govukPagination: {
        previous: { href: '/?page=6' },
        items: [
          { number: '1', href: '/?page=0', current: false },
          { number: '2', href: '/?page=1', current: false },
          { number: '3', href: '/?page=2', current: false },
          { number: '4', href: '/?page=3', current: false },
          { number: '5', href: '/?page=4', current: false },
          { number: '6', href: '/?page=5', current: false },
          { number: '7', href: '/?page=6', current: false },
          { number: '8', href: '/?page=7', current: true },
        ],
      },
      showing: [141, 155, 155],
      viewAllUrl: '/?page=all',
    })

    const rendered = renderPagination(pagination)
    expect(rendered).toContain('Showing 141 to 155 of 155 results')
    expect(rendered).toContain('View all')
  })

  it('should handle first page of more than 8 and hide intermediate links', () => {
    const pagination = paginate(
      {
        content: [], // invalid, but ignored anyway
        numberOfElements: 10,
        totalElements: 89,
        number: 0,
        totalPages: 9,
        size: 10,
      },
      '/',
      false,
    )
    expect(pagination).toEqual<Pagination>({
      govukPagination: {
        items: [
          { number: '1', href: '/?page=0', current: true },
          { number: '2', href: '/?page=1', current: false },
          { ellipsis: true },
          { number: '9', href: '/?page=8', current: false },
        ],
        next: { href: '/?page=1' },
      },
      showing: [1, 10, 89],
    })

    const rendered = renderPagination(pagination)
    expect(rendered).toContain('Showing 1 to 10 of 89 results')
    expect(rendered).not.toContain('View all')
  })

  it('should handle second page of more than 8 and hide intermediate links', () => {
    const pagination = paginate(
      {
        content: [], // invalid, but ignored anyway
        numberOfElements: 10,
        totalElements: 89,
        number: 1,
        totalPages: 9,
        size: 10,
      },
      '/',
      false,
    )
    expect(pagination).toEqual<Pagination>({
      govukPagination: {
        previous: { href: '/?page=0' },
        items: [
          { number: '1', href: '/?page=0', current: false },
          { number: '2', href: '/?page=1', current: true },
          { number: '3', href: '/?page=2', current: false },
          { ellipsis: true },
          { number: '9', href: '/?page=8', current: false },
        ],
        next: { href: '/?page=2' },
      },
      showing: [11, 20, 89],
    })

    const rendered = renderPagination(pagination)
    expect(rendered).toContain('Showing 11 to 20 of 89 results')
    expect(rendered).not.toContain('View all')
  })

  it('should handle a mid page of more than 8 and hide intermediate links', () => {
    const pagination = paginate(
      {
        content: [], // invalid, but ignored anyway
        numberOfElements: 10,
        totalElements: 89,
        number: 6,
        totalPages: 9,
        size: 10,
      },
      '/',
      false,
    )
    expect(pagination).toEqual<Pagination>({
      govukPagination: {
        previous: { href: '/?page=5' },
        items: [
          { number: '1', href: '/?page=0', current: false },
          { ellipsis: true },
          { number: '6', href: '/?page=5', current: false },
          { number: '7', href: '/?page=6', current: true },
          { number: '8', href: '/?page=7', current: false },
          { number: '9', href: '/?page=8', current: false },
        ],
        next: { href: '/?page=7' },
      },
      showing: [61, 70, 89],
    })

    const rendered = renderPagination(pagination)
    expect(rendered).toContain('Showing 61 to 70 of 89 results')
    expect(rendered).not.toContain('View all')
  })

  it('should handle second to last page of more than 8 and hide intermediate links', () => {
    const pagination = paginate(
      {
        content: [], // invalid, but ignored anyway
        numberOfElements: 10,
        totalElements: 89,
        number: 7,
        totalPages: 9,
        size: 10,
      },
      '/',
      false,
    )
    expect(pagination).toEqual<Pagination>({
      govukPagination: {
        previous: { href: '/?page=6' },
        items: [
          { number: '1', href: '/?page=0', current: false },
          { ellipsis: true },
          { number: '7', href: '/?page=6', current: false },
          { number: '8', href: '/?page=7', current: true },
          { number: '9', href: '/?page=8', current: false },
        ],
        next: { href: '/?page=8' },
      },
      showing: [71, 80, 89],
    })

    const rendered = renderPagination(pagination)
    expect(rendered).toContain('Showing 71 to 80 of 89 results')
    expect(rendered).not.toContain('View all')
  })

  it('should handle last page of more than 8 and hide intermediate links', () => {
    const pagination = paginate(
      {
        content: [], // invalid, but ignored anyway
        numberOfElements: 9,
        totalElements: 89,
        number: 8,
        totalPages: 9,
        size: 10,
      },
      '/',
      false,
    )
    expect(pagination).toEqual<Pagination>({
      govukPagination: {
        previous: { href: '/?page=7' },
        items: [
          { number: '1', href: '/?page=0', current: false },
          { ellipsis: true },
          { number: '8', href: '/?page=7', current: false },
          { number: '9', href: '/?page=8', current: true },
        ],
      },
      showing: [81, 89, 89],
    })

    const rendered = renderPagination(pagination)
    expect(rendered).toContain('Showing 81 to 89 of 89 results')
    expect(rendered).not.toContain('View all')
  })

  it.each([-1, 2])('should handle out of bounds page %d (0-based) of 2 total', number => {
    const pagination = paginate(
      {
        content: [], // invalid, but ignored anyway
        numberOfElements: 10,
        totalElements: 20,
        number,
        totalPages: 2,
        size: 10,
      },
      '/',
    )
    expect(pagination).toEqual<Pagination>({
      govukPagination: {
        items: [
          { number: '1', href: '/?page=0', current: true },
          { number: '2', href: '/?page=1', current: false },
        ],
        next: { href: '/?page=1' },
      },
      showing: [1, 10, 20],
      viewAllUrl: '/?page=all',
    })

    const rendered = renderPagination(pagination)
    expect(rendered).toContain('Showing 1 to 10 of 20 result')
    expect(rendered).toContain('View all')
  })

  it('should override page query parameter keeping others', () => {
    const pagination = paginate(
      {
        content: [], // invalid, but ignored anyway
        numberOfElements: 1,
        totalElements: 3,
        number: 1,
        totalPages: 3,
        size: 1,
      },
      '/?year=2026&page=0',
    )
    expect(pagination).toEqual<Pagination>({
      govukPagination: {
        previous: expect.objectContaining({ href: '/?year=2026&page=0' }),
        items: [
          expect.objectContaining({ href: '/?year=2026&page=0' }),
          expect.objectContaining({ href: '/?year=2026&page=1' }),
          expect.objectContaining({ href: '/?year=2026&page=2' }),
        ],
        next: expect.objectContaining({ href: '/?year=2026&page=2' }),
      },
      showing: [2, 2, 3],
      viewAllUrl: '/?year=2026&page=all',
    })
  })
})

describe('sortable', () => {
  interface ExamplePageRequest extends PageRequest<'a' | 'b'> {
    a: number
    b: number
    c?: number
  }

  it('should build url for sortable columns when there’s no current sort order set', () => {
    const request: ExamplePageRequest = { a: 0, b: 0 }
    const sorter = sortable(request, '/table?query=test')
    expect(sorter('a')).toEqual({ href: '/table?query=test&sort=a', direction: 'ASC', currentDirection: undefined })
    expect(sorter('b')).toEqual({ href: '/table?query=test&sort=b', direction: 'ASC' })
  })

  it.each(['a', 'a,ASC'] as const)(
    'should build url for sortable columns when an ascending sort order is set (%s)',
    sort => {
      const request: ExamplePageRequest = { a: 0, b: 0, sort }
      const sorter = sortable(request, '/table?query=test&sort=a')
      expect(sorter('a')).toEqual({ href: '/table?query=test&sort=-a', direction: 'DESC', currentDirection: 'ASC' })
      expect(sorter('b')).toEqual({ href: '/table?query=test&sort=b', direction: 'ASC' })
    },
  )

  it('should build url for sortable columns when a descending sort order is set (a,DESC)', () => {
    const request: ExamplePageRequest = { a: 0, b: 0, sort: 'a,DESC' }
    const sorter = sortable(request, '/table?query=test&sort=-a')
    expect(sorter('a')).toEqual({ href: '/table?query=test&sort=a', direction: 'ASC', currentDirection: 'DESC' })
    expect(sorter('b')).toEqual({ href: '/table?query=test&sort=b', direction: 'ASC' })
  })

  it('should reset the page to 0 in sortable columns', () => {
    const request: ExamplePageRequest = { a: 0, b: 0 }
    const sorter = sortable(request, '/table?page=2&query=test')
    expect(sorter('a')).toEqual({ href: '/table?query=test&sort=a', direction: 'ASC', currentDirection: undefined })
    expect(sorter('b')).toEqual({ href: '/table?query=test&sort=b', direction: 'ASC' })
  })
})
