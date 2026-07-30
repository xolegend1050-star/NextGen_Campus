const express = require('express');
const router = express.Router();
const aiController = require('../controllers/ai/aiController');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * /api/ai/draft-answer:
 *   post:
 *     tags: [AI Features]
 *     summary: Generate AI draft answer for a doubt
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [doubt_id]
 *             properties:
 *               doubt_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: AI draft answer
 */
router.post('/draft-answer', authenticate, aiController.generateDraftAnswer);

/**
 * @swagger
 * /api/ai/moderate-content:
 *   post:
 *     tags: [AI Features]
 *     summary: Moderate content for toxicity
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Moderation result
 */
router.post('/moderate-content', authenticate, aiController.moderateContent);

/**
 * @swagger
 * /api/ai/recommend-mentors:
 *   get:
 *     tags: [AI Features]
 *     summary: Get AI mentor recommendations
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Mentor recommendations
 */
router.get('/recommend-mentors', authenticate, aiController.recommendMentors);

/**
 * @swagger
 * /api/ai/recommend-gigs:
 *   get:
 *     tags: [AI Features]
 *     summary: Get AI gig recommendations
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Gig recommendations
 */
router.get('/recommend-gigs', authenticate, aiController.recommendGigs);

/**
 * @swagger
 * /api/ai/predict-gig-success:
 *   post:
 *     tags: [AI Features]
 *     summary: Predict gig application success
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [gig_id]
 *             properties:
 *               gig_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success prediction
 */
router.post('/predict-gig-success', authenticate, aiController.predictGigSuccess);

/**
 * @swagger
 * /api/ai/analyze-resume:
 *   post:
 *     tags: [AI Features]
 *     summary: Analyze resume and skill gaps
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [resume_url]
 *             properties:
 *               resume_url:
 *                 type: string
 *     responses:
 *       200:
 *         description: Resume analysis
 */
router.post('/analyze-resume', authenticate, aiController.analyzeResume);

/**
 * @swagger
 * /api/ai/mock-interview:
 *   post:
 *     tags: [AI Features]
 *     summary: Start AI mock interview
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role, skills]
 *             properties:
 *               role:
 *                 type: string
 *               skills:
 *                 type: array
 *     responses:
 *       200:
 *         description: Mock interview questions
 */
router.post('/mock-interview', authenticate, aiController.mockInterview);

module.exports = router;
