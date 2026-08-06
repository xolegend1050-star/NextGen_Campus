const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error(err.message, { stack: err.stack, url: req.url, method: req.method });

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.details || err.message
    });
  }

  if (err.code === '23505') {
    return res.status(409).json({
      error: 'Duplicate entry',
      detail: err.detail
    });
  }

  if (err.code === '23503') {
    return res.status(400).json({
      error: 'Foreign key violation',
      detail: err.detail
    });
  }

  if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expired' });
  }

  if (err.statusCode) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  const isProduction = process.env.NODE_ENV === 'production';
  res.status(500).json({
    error: isProduction ? 'Internal server error' : (err.message || 'Internal server error'),
    ...(isProduction ? {} : { code: err.code || null })
  });
};

module.exports = errorHandler;
