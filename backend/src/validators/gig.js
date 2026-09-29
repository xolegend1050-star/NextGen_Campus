const { body, query, param, validationResult } = require('express-validator');
const { optionalField } = require('../utils/validate');

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
  optionalField(body('requirements')).trim().notEmpty(),
  body('skills_required').isArray({ min: 1 }).withMessage('At least 1 skill required'),
  body('category').trim().notEmpty().withMessage('Category is required'),
  body('compensation').isFloat({ min: 100 }).withMessage('Minimum compensation is ₹100'),
  body('duration_days').isInt({ min: 1, max: 90 }).withMessage('Duration must be 1-90 days'),
  optionalField(body('max_students')).isInt({ min: 1, max: 50 }),
  body('application_deadline').isISO8601().withMessage('Valid deadline required'),
  optionalField(body('is_remote')).isBoolean(),
  optionalField(body('location')).trim().notEmpty(),
  handleValidationErrors
];

const updateGigValidation = [
  param('id').isUUID().withMessage('Invalid gig ID'),
  optionalField(body('title')).trim().isLength({ min: 10, max: 255 }),
  optionalField(body('description')).trim().isLength({ min: 50 }),
  optionalField(body('skills_required')).isArray({ min: 1 }),
  optionalField(body('compensation')).isFloat({ min: 100 }),
  handleValidationErrors
];

const applyGigValidation = [
  param('id').isUUID().withMessage('Invalid gig ID'),
  optionalField(body('cover_letter')).trim().isLength({ max: 2000 }),
  optionalField(body('resume_url')).isURL(),
  handleValidationErrors
];

const getGigsValidation = [
  optionalField(query('page')).isInt({ min: 1 }),
  optionalField(query('limit')).isInt({ min: 1, max: 50 }),
  optionalField(query('category')).trim().notEmpty(),
  optionalField(query('skills')).trim().notEmpty(),
  optionalField(query('is_remote')).isBoolean(),
  optionalField(query('min_compensation')).isFloat({ min: 0 }),
  optionalField(query('max_compensation')).isFloat({ min: 0 }),
  optionalField(query('status')).isIn(['open', 'in_progress', 'completed']),
  optionalField(query('sort')).isIn(['newest', 'oldest', 'highest_pay', 'most_applied']),
  handleValidationErrors
];

module.exports = {
  createGigValidation,
  updateGigValidation,
  applyGigValidation,
  getGigsValidation,
  handleValidationErrors
};
