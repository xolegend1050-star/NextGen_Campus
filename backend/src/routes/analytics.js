const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics/analyticsController');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @swagger
 * /api/analytics/track:
 *   post:
 *     tags: [Analytics]
 *     summary: Track an event
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [event_type]
 *             properties:
 *               event_type:
 *                 type: string
 *               event_data:
 *                 type: object
 *     responses:
 *       201:
 *         description: Event tracked
 */
router.post('/track', authenticate, analyticsController.trackEvent);

/**
 * @swagger
 * /api/analytics/student/{studentId}:
 *   get:
 *     tags: [Analytics]
 *     summary: Get student analytics (Admin or self)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Student analytics
 */
router.get('/student/:studentId', authenticate, analyticsController.getStudentAnalytics);

/**
 * @swagger
 * /api/analytics/leaderboard:
 *   get:
 *     tags: [Analytics]
 *     summary: Get leaderboard
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [doubts, mentorship, gigs, overall]
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [weekly, monthly, all_time]
 *     responses:
 *       200:
 *         description: Leaderboard
 */
router.get('/leaderboard', authenticate, analyticsController.getLeaderboard);

/**
 * @swagger
 * /api/analytics/admin:
 *   get:
 *     tags: [Analytics]
 *     summary: Get platform analytics (Admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Platform analytics
 */
router.get('/admin', authenticate, authorize('admin'), analyticsController.getPlatformAnalytics);
router.get('/platform', authenticate, authorize('admin'), analyticsController.getPlatformAnalytics);

module.exports = router;
