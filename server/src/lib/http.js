export class HttpError extends Error {
  constructor(status, message, details) {
    super(message)
    this.status = status
    this.details = details
  }
}

// Validate `data` with a zod schema; throws a 400 HttpError on failure.
export function parse(schema, data) {
  const result = schema.safeParse(data)
  if (result.success) return result.data
  throw new HttpError(
    400,
    'Invalid request',
    result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
  )
}
