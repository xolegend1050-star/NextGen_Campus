const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { uuidParams, intQueries, skillNameParam } = require('../utils/validate');
const {
  updateProfileValidation,
  addExperienceValidation,
  updateExperienceValidation,
  addProjectValidation,
  updateProjectValidation,
  updateSkillsValidation,
  addSkillsValidation
} = require('../validators/profile');
const profileController = require('../controllers/profile/profileController');

// ==================== PROFILE ====================

router.get('/me', authenticate, profileController.getMyProfile);
router.put('/me', authenticate, updateProfileValidation, profileController.updateProfile);
router.get('/me/completion', authenticate, profileController.getCompletionStatus);
router.get('/:userId', uuidParams('userId'), profileController.getPublicProfile);

// ==================== EXPERIENCE ====================

router.get('/me/experience', authenticate, profileController.getMyExperience);
router.post('/me/experience', authenticate, addExperienceValidation, profileController.addExperience);
router.put('/me/experience/:id', authenticate, updateExperienceValidation, uuidParams('id'), profileController.updateExperience);
router.delete('/me/experience/:id', authenticate, uuidParams('id'), profileController.deleteExperience);

// ==================== PROJECTS ====================

router.get('/me/projects', authenticate, profileController.getMyProjects);
router.post('/me/projects', authenticate, addProjectValidation, profileController.addProject);
router.put('/me/projects/:id', authenticate, updateProjectValidation, uuidParams('id'), profileController.updateProject);
router.delete('/me/projects/:id', authenticate, uuidParams('id'), profileController.deleteProject);

// ==================== SKILLS ====================

router.put('/me/skills', authenticate, updateSkillsValidation, profileController.updateSkills);
router.post('/me/skills', authenticate, addSkillsValidation, profileController.addSkills);
// :skill is the skill NAME, not an id - profiles.skills is a text[] and the
// controller removes by value with array_remove(). It must not be UUID-checked.
router.delete('/me/skills/:skill', authenticate, skillNameParam, profileController.removeSkill);

module.exports = router;
