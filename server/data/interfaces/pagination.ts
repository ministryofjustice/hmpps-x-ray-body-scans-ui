type SortOption<O extends string> = O | `${O},ASC` | `${O},DESC`

/**
 * For Spring api queries that return paginated results,
 * ie. accept a parameter of the form org.springframework.data.domain.Pageable
 */
export interface PageRequest<SortBy extends string = string> {
  page?: number
  size?: number
  sort?: SortOption<SortBy> | SortOption<SortBy>[]
}

/**
 * Shape of a Spring Data org.springframework.data.domain.Page response
 */
export interface PageResponse<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}
