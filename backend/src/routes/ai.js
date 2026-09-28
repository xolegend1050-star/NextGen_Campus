const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const aiController = require('../controllers/ai/aiController');
const { authenticate } = require('../middleware/auth');

// Every endpoint here proxies a metered upstream (Gemini / scikit-learn).
// Without a cap a single client can burn the quota with a tight loop.
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.AI_RATE_LIMIT_MAX) || 30,
  message: { error: 'Too many AI requests. Please wait a few minutes.', code: 'AI_RATE_LIMITED' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false }
});

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
router.post('/draft-answer', authenticate, aiLimiter, aiController.generateDraftAnswer);

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
router.post('/moderate-content', authenticate, aiLimiter, aiController.moderateContent);

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
router.get('/recommend-mentors', authenticate, aiLimiter, aiController.recommendMentors);

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
router.get('/recommend-gigs', authenticate, aiLimiter, aiController.recommendGigs);

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
router.post('/predict-gig-success', authenticate, aiLimiter, aiController.predictGigSuccess);

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
router.post('/analyze-resume', authenticate, aiLimiter, aiController.analyzeResume);

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
router.post('/mock-interview', authenticate, aiLimiter, aiController.mockInterview);

/**
 * @swagger
 * /api/ai/health:
 *   get:
 *     tags: [AI Features]
 *     summary: Check whether the AI service is reachable
 *     responses:
 *       200: { description: AI service reachable }
 *       503: { description: AI service unreachable }
 */
router.get('/health', aiController.aiHealth);

module.exports = router;

