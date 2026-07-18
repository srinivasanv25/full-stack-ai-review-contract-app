export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'PROMPT_INJECTION'
  | 'RATE_LIMITED'
  | 'OPENAI_TIMEOUT'
  | 'OPENAI_ERROR'
  | 'INTERNAL_ERROR'

export class ApiRouteError extends Error {
  status: number
  code: ApiErrorCode
  details?: unknown

  constructor(status: number, code: ApiErrorCode, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiRouteError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export function errorResponse(err: ApiRouteError): Response {
  return Response.json(
    { error: { code: err.code, message: err.message, details: err.details } },
    { status: err.status }
  )
}

export function handleRouteError(err: unknown): Response {
  if (err instanceof ApiRouteError) {
    return errorResponse(err)
  }
  console.error(err)
  return errorResponse(
    new ApiRouteError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.')
  )
}
