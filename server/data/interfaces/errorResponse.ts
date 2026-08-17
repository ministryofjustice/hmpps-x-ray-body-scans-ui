export interface ErrorResponse {
  status: number
  errorCode?: string | null
  userMessage: string | null
  developerMessage: string | null
  moreInfo?: string | null
}
