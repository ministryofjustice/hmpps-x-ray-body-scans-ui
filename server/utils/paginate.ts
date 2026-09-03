import type { PageRequest, PageResponse } from '../data/interfaces/pagination'

export interface Pagination {
  govukPagination?: {
    previous?: { href: string }
    items: (
      | {
          number: string
          href: string
          current?: boolean
        }
      | { ellipsis: true }
    )[]
    next?: { href: string }
  }
  showing: [number, number, number]
  viewAllUrl?: string
}

/** Turn a PageResponse into parameters necessary for the pagination component */
export function paginate<T = unknown>(
  pageResponse: PageResponse<T>,
  url: string,
  allowViewAll = true,
): Pagination | null {
  const { number: rawNumber, totalPages, size, numberOfElements, totalElements } = pageResponse

  // no results
  if (!totalElements) {
    return null
  }

  let number: number
  if (rawNumber < 0 || rawNumber >= totalPages) {
    number = 0
  } else {
    number = rawNumber
  }

  const showing: Pagination['showing'] = [number * size + 1, number * size + numberOfElements, totalElements]

  // not enough to paginate
  if (!totalPages || totalPages < 2) {
    return { showing }
  }

  // 0-based pages to display
  let pages: number[]
  if (totalPages <= 8) {
    pages = Array.from({ length: totalPages }).map((_, page) => page)
  } else {
    pages = Array.from(new Set([0, number - 1, number, number + 1, totalPages - 1]))
      .filter(page => page >= 0 && page < totalPages)
      .sort()
  }

  const [baseUrl, query] = url.split('?', 2)
  const params = new URLSearchParams(query ?? '')
  function buildUrl(newPage: number | 'all'): string {
    params.set('page', newPage.toString())
    return `${baseUrl}?${params}`
  }

  let pagesWithEllipses: (number | null)[]
  if (pages.length > 2) {
    pagesWithEllipses = []
    for (let index = 0; index < pages.length - 1; index += 1) {
      const thisPage = pages[index]
      const nextPage = pages[index + 1]
      if (thisPage + 1 !== nextPage) {
        pagesWithEllipses.push(thisPage, null)
      } else {
        pagesWithEllipses.push(thisPage)
      }
    }
    pagesWithEllipses.push(pages.at(-1)!)
  } else {
    pagesWithEllipses = pages
  }

  return {
    govukPagination: {
      previous: number > 0 ? { href: buildUrl(number - 1) } : undefined,
      items: pagesWithEllipses.map(page =>
        page === null
          ? { ellipsis: true }
          : {
              number: (page + 1).toString(),
              href: buildUrl(page),
              current: number === page,
            },
      ),
      next: number < totalPages - 1 ? { href: buildUrl(number + 1) } : undefined,
    },
    showing,
    viewAllUrl: allowViewAll ? buildUrl('all') : undefined,
  }
}

type SortableFields<P> = P extends PageRequest<infer S> ? S : never

export function sortable<P extends PageRequest<S>, S extends string>(
  pageRequest: P,
  url: string,
): (field: SortableFields<P>) => SortSettings {
  const [baseUrl, query] = url.split('?', 2)
  const params = new URLSearchParams(query ?? '')
  if (params.has('page')) {
    params.delete('page')
  }

  function buildUrl(newSort: SortableFields<P>, descending = false): string {
    params.set('sort', descending ? `-${newSort}` : newSort)
    return `${baseUrl}?${params}`
  }

  const { sort } = pageRequest
  let currentField: SortableFields<P> | undefined
  let currentDirection: 'ASC' | 'DESC' | undefined
  if (typeof sort === 'string') {
    const [field, direction = 'ASC'] = sort.split(',', 2)
    currentField = field as SortableFields<P>
    currentDirection = direction as 'ASC' | 'DESC'
  }

  return field => {
    if (currentField === field) {
      return {
        href: buildUrl(field, currentDirection === 'ASC'),
        currentDirection,
        direction: currentDirection === 'ASC' ? 'DESC' : 'ASC',
      }
    }
    return { href: buildUrl(field), direction: 'ASC' }
  }
}

interface SortSettings {
  /** URL with instructions to sort by this field */
  href: string
  /** The direction href will sort by */
  direction: 'ASC' | 'DESC'
  /** The direction currently sorted by this field, if any */
  currentDirection?: 'ASC' | 'DESC'
}
