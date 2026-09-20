export const errorMiddleware = (err, req, res, _next) => {
  const statusCode = err.statusCode || 500;

  const payload = {
    success: false,
    message: err.message || 'Something went wrong',
    errors: [],
    requestId: req.requestId,
  };

  if (process.env.NODE_ENV !== 'production') {
    payload.errors = [err.stack || err.message];
  }

  if (err.name === 'ValidationError') {
    payload.message = 'Validation failed';
    payload.errors = Object.values(err.errors).map((item) => item.message);
    return res.status(400).json(payload);
  }

  if (err.name === 'MongoServerError' && err.code === 11000) {
    payload.message = 'Duplicate value detected';
    payload.errors = [`Duplicate field: ${Object.keys(err.keyValue)[0]}`];
    return res.status(409).json(payload);
  }

  if (err.name === 'JsonWebTokenError') {
    payload.message = 'Invalid token';
    return res.status(401).json(payload);
  }

  if (err.name === 'TokenExpiredError') {
    payload.message = 'Session expired';
    return res.status(401).json(payload);
  }

  return res.status(statusCode).json(payload);
};
