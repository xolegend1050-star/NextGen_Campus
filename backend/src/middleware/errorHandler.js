const multer = require('multer');
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

  // Multer / file-upload failures are caused by the client's request, so they
  // must surface as 4xx rather than being reported as a server fault.
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File is too large' });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Unexpected file field or too many files' });
    }
    return res.status(400).json({ error: err.message });
  }

  // Raised by our multer fileFilters for disallowed types
  if (err.message && /^(invalid file type|only images)/i.test(err.message.trim())) {
    return res.status(400).json({ error: err.message });
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
