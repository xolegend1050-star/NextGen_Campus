const { body, query, param, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const createDoubtValidation = [
  body('title').trim().isLength({ min: 10, max: 500 }).withMessage('Title must be 10-500 characters'),
  body('content').trim().isLength({ min: 20 }).withMessage('Content must be at least 20 characters'),
  body('tags').isArray({ min: 1, max: 5 }).withMessage('1-5 tags required'),
  body('subject').optional().trim().notEmpty(),
  body('topic').optional().trim().notEmpty(),
  handleValidationErrors
];

const updateDoubtValidation = [
  param('id').isUUID().withMessage('Invalid doubt ID'),
  body('title').optional().trim().isLength({ min: 10, max: 500 }),
  body('content').optional().trim().isLength({ min: 20 }),
  body('tags').optional().isArray({ min: 1, max: 5 }),
  handleValidationErrors
];

const answerDoubtValidation = [
  param('id').isUUID().withMessage('Invalid doubt ID'),
  body('content').trim().isLength({ min: 10 }).withMessage('Answer must be at least 10 characters'),
  handleValidationErrors
];

const getDoubtsValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be 1-50'),
  query('status').optional().isIn(['open', 'answered', 'closed', 'flagged']),
  query('subject').optional().trim().notEmpty(),
  query('sort').optional().isIn(['newest', 'oldest', 'popular', 'unanswered']),
  handleValidationErrors
];

// doubt_votes.vote_type is an integer column with CHECK (vote_type IN (-1, 1)).
// Without this the raw body value went straight to Postgres, so a string vote
// came back as "invalid input syntax for type integer" and an out-of-range
// number as a constraint violation - both 500s instead of 400s.
const voteValidation = [
  body('vote_type')
    .isInt({ min: -1, max: 1 })
    .withMessage('vote_type must be 1 (upvote) or -1 (downvote)')
    .toInt(),
  handleValidationErrors
];

module.exports = {
  createDoubtValidation,
  updateDoubtValidation,
  answerDoubtValidation,
  getDoubtsValidation,
  voteValidation,
  handleValidationErrors
};
