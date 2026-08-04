const { body, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const updateProfileValidation = [
  body('full_name').optional().trim().isLength({ min: 2, max: 255 }).withMessage('Name must be 2-255 characters'),
  body('bio').optional().trim().isLength({ max: 1000 }).withMessage('Bio max 1000 characters'),
  body('phone').optional().matches(/^[+]?[0-9]{10,15}$/).withMessage('Invalid phone number'),
  body('city').optional().trim().notEmpty(),
  body('state').optional().trim().notEmpty(),
  body('college_name').optional().trim().notEmpty(),
  body('course').optional().trim().notEmpty(),
  body('year_of_study').optional().isInt({ min: 1, max: 6 }),
  body('graduation_year').optional().isInt({ min: 2020, max: 2030 }),
  body('skills').optional().isArray({ max: 20 }),
  body('interests').optional().isArray({ max: 10 }),
  body('linkedin_url').optional().isURL().withMessage('Invalid LinkedIn URL'),
  body('github_url').optional().isURL().withMessage('Invalid GitHub URL'),
  body('portfolio_url').optional().isURL().withMessage('Invalid portfolio URL'),
  handleValidationErrors
];

const addExperienceValidation = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('company_name').optional().trim(),
  body('description').optional().trim().isLength({ max: 2000 }),
  body('start_date').isISO8601().withMessage('Valid start date required'),
  body('end_date').optional({ nullable: true }).isISO8601().withMessage('Invalid end date'),
  body('is_current').optional().isBoolean(),
  handleValidationErrors
];

const updateExperienceValidation = [
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  body('company_name').optional().trim(),
  body('description').optional().trim().isLength({ max: 2000 }),
  body('start_date').optional().isISO8601().withMessage('Invalid start date'),
  body('end_date').optional({ nullable: true }).isISO8601().withMessage('Invalid end date'),
  body('is_current').optional().isBoolean(),
  handleValidationErrors
];

const addProjectValidation = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').optional().trim().isLength({ max: 2000 }),
  body('project_url').optional().isURL().withMessage('Invalid project URL'),
  body('github_url').optional().isURL().withMessage('Invalid GitHub URL'),
  body('technologies').optional().isArray({ max: 15 }),
  body('technologies.*').optional().trim().notEmpty(),
  body('image_url').optional().isURL().withMessage('Invalid image URL'),
  handleValidationErrors
];

const updateProjectValidation = [
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  body('description').optional().trim().isLength({ max: 2000 }),
  body('project_url').optional().isURL().withMessage('Invalid project URL'),
  body('github_url').optional().isURL().withMessage('Invalid GitHub URL'),
  body('technologies').optional().isArray({ max: 15 }),
  body('technologies.*').optional().trim().notEmpty(),
  body('image_url').optional().isURL().withMessage('Invalid image URL'),
  handleValidationErrors
];

const updateSkillsValidation = [
  body('skills').isArray({ min: 0, max: 30 }).withMessage('Skills must be an array with max 30 items'),
  body('skills.*').optional().trim().notEmpty().withMessage('Skill name cannot be empty'),
  handleValidationErrors
];

const addSkillsValidation = [
  body('skills').isArray({ min: 1, max: 10 }).withMessage('Provide 1-10 skills to add'),
  body('skills.*').trim().notEmpty().withMessage('Skill name cannot be empty'),
  handleValidationErrors
];

const updateAlumniValidation = [
  body('graduation_year').isInt({ min: 1990, max: 2024 }).withMessage('Invalid graduation year'),
  body('current_company').optional().trim().notEmpty(),
  body('current_designation').optional().trim().notEmpty(),
  body('years_of_experience').optional().isInt({ min: 0, max: 50 }),
  body('mentoring_available').optional().isBoolean(),
  body('max_mentees').optional().isInt({ min: 1, max: 20 }),
  body('mentorship_areas').optional().isArray({ max: 10 }),
  handleValidationErrors
];

const updateCompanyValidation = [
  body('company_name').trim().notEmpty().withMessage('Company name is required'),
  body('description').optional().trim().isLength({ max: 2000 }),
  body('website_url').optional().isURL().withMessage('Invalid website URL'),
  body('industry').optional().trim().notEmpty(),
  body('company_size').optional().isIn(['1-10', '11-50', '51-200', '201-500', '500+']),
  body('headquarters_city').optional().trim().notEmpty(),
  body('headquarters_state').optional().trim().notEmpty(),
  handleValidationErrors
];

module.exports = {
  updateProfileValidation,
  updateAlumniValidation,
  updateCompanyValidation,
  addExperienceValidation,
  updateExperienceValidation,
  addProjectValidation,
  updateProjectValidation,
  updateSkillsValidation,
  addSkillsValidation
};
