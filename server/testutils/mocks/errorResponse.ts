import { SanitisedError } from '@ministryofjustice/hmpps-rest-client'
import type { ErrorResponse } from '../../data/interfaces/errorResponse'

/** Payload typically returned by HMPPS apis in case of errors */
export function mockErrorResponse(status: number): ErrorResponse {
  const message =
    {
      400: 'Bad Request',
      404: 'Not Found',
      500: 'Internal Server Error',
    }[status] ?? 'Error message'
  return {
    status,
    userMessage: message,
    developerMessage: message,
  }
}

export const badRequestErrorResponse = mockErrorResponse(400)
export const notFoundErrorResponse = mockErrorResponse(404)
export const internalServerErrorResponse = mockErrorResponse(500)

/** Error thrown by HMPPS REST client */
export function mockThrownError(responseBody: ErrorResponse): SanitisedError<ErrorResponse> {
  const error = new SanitisedError<ErrorResponse>(responseBody.userMessage!)
  error.responseStatus = responseBody.status
  error.headers = {}
  error.data = responseBody
  error.text = JSON.stringify(responseBody)
  return error
}
