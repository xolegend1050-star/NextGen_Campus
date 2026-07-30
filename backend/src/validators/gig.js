const { body, query, param, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const createGigValidation = [
  body('title').trim().isLength({ min: 10, max: 255 }).withMessage('Title must be 10-255 characters'),
  body('description').trim().isLength({ min: 50 }).withMessage('Description must be at least 50 characters'),
  body('requirements').optional().trim().notEmpty(),
  body('skills_required').isArray({ min: 1 }).withMessage('At least 1 skill required'),
  body('category').trim().notEmpty().withMessage('Category is required'),
  body('compensation').isFloat({ min: 100 }).withMessage('Minimum compensation is ₹100'),
  body('duration_days').isInt({ min: 1, max: 90 }).withMessage('Duration must be 1-90 days'),
  body('max_students').optional().isInt({ min: 1, max: 50 }),
  body('application_deadline').isISO8601().withMessage('Valid deadline required'),
  body('is_remote').optional().isBoolean(),
  body('location').optional().trim().notEmpty(),
  handleValidationErrors
];

const updateGigValidation = [
  param('id').isUUID().withMessage('Invalid gig ID'),
  body('title').optional().trim().isLength({ min: 10, max: 255 }),
  body('description').optional().trim().isLength({ min: 50 }),
  body('skills_required').optional().isArray({ min: 1 }),
  body('compensation').optional().isFloat({ min: 100 }),
  handleValidationErrors
];

const applyGigValidation = [
  param('id').isUUID().withMessage('Invalid gig ID'),
  body('cover_letter').optional().trim().isLength({ max: 2000 }),
  body('resume_url').optional().isURL(),
  handleValidationErrors
];

const getGigsValidation = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('category').optional().trim().notEmpty(),
  query('skills').optional().trim().notEmpty(),
  query('is_remote').optional().isBoolean(),
  query('min_compensation').optional().isFloat({ min: 0 }),
  query('max_compensation').optional().isFloat({ min: 0 }),
  query('status').optional().isIn(['open', 'in_progress', 'completed']),
  query('sort').optional().isIn(['newest', 'oldest', 'highest_pay', 'most_applied']),
  handleValidationErrors
];

module.exports = {
  createGigValidation,
  updateGigValidation,
  applyGigValidation,
  getGigsValidation,
  handleValidationErrors
};
