import type { ErrorResponse } from '../../data/interfaces/errorResponse'

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
