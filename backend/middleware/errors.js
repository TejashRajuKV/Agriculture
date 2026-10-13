import { HttpError } from '../utils/httpError.js';

export const notFoundHandler = (req, res) => {
  res.status(404).json({ error: `No API route for ${req.method} ${req.path}` });
};

// Every error becomes { error, details? }; internal details are logged, never sent.
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, ...(err.details ? { details: err.details } : {}) });
  }
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body is not valid JSON' });
  if (err?.name === 'CastError') return res.status(400).json({ error: `Invalid ${err.path}` });
  if (err?.name === 'ValidationError') {
    return res.status(400).json({ error: 'Validation failed', details: Object.values(err.errors).map((e) => e.message) });
  }
  if (err?.code === 11000) return res.status(409).json({ error: 'That already exists' });

  console.error(`[${req.method} ${req.originalUrl}]`, err);
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
};
