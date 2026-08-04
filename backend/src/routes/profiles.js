const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
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
router.get('/:userId', profileController.getPublicProfile);

// ==================== EXPERIENCE ====================

router.get('/me/experience', authenticate, profileController.getMyExperience);
router.post('/me/experience', authenticate, addExperienceValidation, profileController.addExperience);
router.put('/me/experience/:id', authenticate, updateExperienceValidation, profileController.updateExperience);
router.delete('/me/experience/:id', authenticate, profileController.deleteExperience);

// ==================== PROJECTS ====================

router.get('/me/projects', authenticate, profileController.getMyProjects);
router.post('/me/projects', authenticate, addProjectValidation, profileController.addProject);
router.put('/me/projects/:id', authenticate, updateProjectValidation, profileController.updateProject);
router.delete('/me/projects/:id', authenticate, profileController.deleteProject);

// ==================== SKILLS ====================

router.put('/me/skills', authenticate, updateSkillsValidation, profileController.updateSkills);
router.post('/me/skills', authenticate, addSkillsValidation, profileController.addSkills);
router.delete('/me/skills/:skill', authenticate, profileController.removeSkill);

module.exports = router;
