const { body, query, param, validationResult } = require('express-validator');
const { optionalField } = require('../utils/validate');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const requestMentorshipValidation = [
  body('mentor_id').isUUID().withMessage('Invalid mentor ID'),
  optionalField(body('message')).trim().isLength({ max: 2000 }),
  optionalField(body('student_goals')).trim().isLength({ max: 1000 }),
  optionalField(body('preferred_session_type')).isIn(['chat', 'video', 'in_person']),
  handleValidationErrors
];

const scheduleSessionValidation = [
  param('requestId').isUUID().withMessage('Invalid request ID'),
  body('scheduled_at').isISO8601().withMessage('Valid date/time required'),
  body('session_type').isIn(['chat', 'video', 'in_person']).withMessage('Invalid session type'),
  handleValidationErrors
];

const rateSessionValidation = [
  param('sessionId').isUUID().withMessage('Invalid session ID'),
  body('overall_rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5'),
  optionalField(body('communication_rating')).isInt({ min: 1, max: 5 }),
  optionalField(body('knowledge_rating')).isInt({ min: 1, max: 5 }),
  optionalField(body('punctuality_rating')).isInt({ min: 1, max: 5 }),
  optionalField(body('helpfulness_rating')).isInt({ min: 1, max: 5 }),
  optionalField(body('review')).trim().isLength({ max: 1000 }),
  handleValidationErrors
];

const getMentorsValidation = [
  optionalField(query('page')).isInt({ min: 1 }),
  optionalField(query('limit')).isInt({ min: 1, max: 50 }),
  optionalField(query('skill')).trim().notEmpty(),
  optionalField(query('city')).trim().notEmpty(),
  optionalField(query('min_rating')).isFloat({ min: 1, max: 5 }),
  optionalField(query('available')).isBoolean(),
  handleValidationErrors
];

module.exports = {
  requestMentorshipValidation,
  scheduleSessionValidation,
  rateSessionValidation,
  getMentorsValidation,
  handleValidationErrors
};
