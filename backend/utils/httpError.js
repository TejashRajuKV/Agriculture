// Errors that carry an HTTP status; the central error handler turns them into
// { error, details } JSON responses. Anything else becomes a generic 500.
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message, details) => new HttpError(400, message, details);
export const unauthorized = (message = 'Please log in') => new HttpError(401, message);
export const forbidden = (message = 'You do not have permission to do this') => new HttpError(403, message);
export const notFound = (message = 'Not found') => new HttpError(404, message);
export const conflict = (message, details) => new HttpError(409, message, details);

// Wrap async route handlers so rejected promises reach the error handler
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
