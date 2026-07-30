const { body, query, param, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const requestMentorshipValidation = [
  body('mentor_id').isUUID().withMessage('Invalid mentor ID'),
  body('message').optional().trim().isLength({ max: 2000 }),
  body('student_goals').optional().trim().isLength({ max: 1000 }),
  body('preferred_session_type').optional().isIn(['chat', 'video', 'in_person']),
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
  body('communication_rating').optional().isInt({ min: 1, max: 5 }),
  body('knowledge_rating').optional().isInt({ min: 1, max: 5 }),
  body('punctuality_rating').optional().isInt({ min: 1, max: 5 }),
  body('helpfulness_rating').optional().isInt({ min: 1, max: 5 }),
  body('review').optional().trim().isLength({ max: 1000 }),
  handleValidationErrors
];

const getMentorsValidation = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('skill').optional().trim().notEmpty(),
  query('city').optional().trim().notEmpty(),
  query('min_rating').optional().isFloat({ min: 1, max: 5 }),
  query('available').optional().isBoolean(),
  handleValidationErrors
];

module.exports = {
  requestMentorshipValidation,
  scheduleSessionValidation,
  rateSessionValidation,
  getMentorsValidation,
  handleValidationErrors
};
