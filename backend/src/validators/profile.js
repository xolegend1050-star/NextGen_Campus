const { body, validationResult } = require('express-validator');
const { optionalField } = require('../utils/validate');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const updateProfileValidation = [
  optionalField(body('full_name')).trim().isLength({ min: 2, max: 255 }).withMessage('Name must be 2-255 characters'),
  optionalField(body('bio')).trim().isLength({ max: 1000 }).withMessage('Bio max 1000 characters'),
  optionalField(body('phone')).matches(/^[+]?[0-9]{10,15}$/).withMessage('Invalid phone number'),
  optionalField(body('city')).trim().notEmpty(),
  optionalField(body('state')).trim().notEmpty(),
  optionalField(body('college_name')).trim().notEmpty(),
  optionalField(body('course')).trim().notEmpty(),
  optionalField(body('year_of_study')).isInt({ min: 1, max: 6 }),
  optionalField(body('graduation_year')).isInt({ min: 2020, max: 2030 }),
  optionalField(body('skills')).isArray({ max: 20 }),
  optionalField(body('interests')).isArray({ max: 10 }),
  optionalField(body('linkedin_url')).isURL().withMessage('Invalid LinkedIn URL'),
  optionalField(body('github_url')).isURL().withMessage('Invalid GitHub URL'),
  optionalField(body('portfolio_url')).isURL().withMessage('Invalid portfolio URL'),
  handleValidationErrors
];

const addExperienceValidation = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  optionalField(body('company_name')).trim(),
  optionalField(body('description')).trim().isLength({ max: 2000 }),
  body('start_date').isISO8601().withMessage('Valid start date required'),
  body('end_date').optional({ nullable: true }).isISO8601().withMessage('Invalid end date'),
  optionalField(body('is_current')).isBoolean(),
  handleValidationErrors
];

const updateExperienceValidation = [
  optionalField(body('title')).trim().notEmpty().withMessage('Title cannot be empty'),
  optionalField(body('company_name')).trim(),
  optionalField(body('description')).trim().isLength({ max: 2000 }),
  optionalField(body('start_date')).isISO8601().withMessage('Invalid start date'),
  body('end_date').optional({ nullable: true }).isISO8601().withMessage('Invalid end date'),
  optionalField(body('is_current')).isBoolean(),
  handleValidationErrors
];

const addProjectValidation = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  optionalField(body('description')).trim().isLength({ max: 2000 }),
  optionalField(body('project_url')).isURL().withMessage('Invalid project URL'),
  optionalField(body('github_url')).isURL().withMessage('Invalid GitHub URL'),
  optionalField(body('technologies')).isArray({ max: 15 }),
  optionalField(body('technologies.*')).trim().notEmpty(),
  optionalField(body('image_url')).isURL().withMessage('Invalid image URL'),
  handleValidationErrors
];

const updateProjectValidation = [
  optionalField(body('title')).trim().notEmpty().withMessage('Title cannot be empty'),
  optionalField(body('description')).trim().isLength({ max: 2000 }),
  optionalField(body('project_url')).isURL().withMessage('Invalid project URL'),
  optionalField(body('github_url')).isURL().withMessage('Invalid GitHub URL'),
  optionalField(body('technologies')).isArray({ max: 15 }),
  optionalField(body('technologies.*')).trim().notEmpty(),
  optionalField(body('image_url')).isURL().withMessage('Invalid image URL'),
  handleValidationErrors
];

const updateSkillsValidation = [
  body('skills').isArray({ min: 0, max: 30 }).withMessage('Skills must be an array with max 30 items'),
  optionalField(body('skills.*')).trim().notEmpty().withMessage('Skill name cannot be empty'),
  handleValidationErrors
];

const addSkillsValidation = [
  body('skills').isArray({ min: 1, max: 10 }).withMessage('Provide 1-10 skills to add'),
  body('skills.*').trim().notEmpty().withMessage('Skill name cannot be empty'),
  handleValidationErrors
];

const updateAlumniValidation = [
  body('graduation_year').isInt({ min: 1990, max: 2024 }).withMessage('Invalid graduation year'),
  optionalField(body('current_company')).trim().notEmpty(),
  optionalField(body('current_designation')).trim().notEmpty(),
  optionalField(body('years_of_experience')).isInt({ min: 0, max: 50 }),
  optionalField(body('mentoring_available')).isBoolean(),
  optionalField(body('max_mentees')).isInt({ min: 1, max: 20 }),
  optionalField(body('mentorship_areas')).isArray({ max: 10 }),
  handleValidationErrors
];

const updateCompanyValidation = [
  body('company_name').trim().notEmpty().withMessage('Company name is required'),
  optionalField(body('description')).trim().isLength({ max: 2000 }),
  optionalField(body('website_url')).isURL().withMessage('Invalid website URL'),
  optionalField(body('industry')).trim().notEmpty(),
  optionalField(body('company_size')).isIn(['1-10', '11-50', '51-200', '201-500', '500+']),
  optionalField(body('headquarters_city')).trim().notEmpty(),
  optionalField(body('headquarters_state')).trim().notEmpty(),
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
