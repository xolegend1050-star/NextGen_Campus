const express = require('express');
const router = express.Router();
const mentorshipController = require('../controllers/mentorship/mentorshipController');
const { authenticate } = require('../middleware/auth');
const {
  requestMentorshipValidation,
  scheduleSessionValidation,
  rateSessionValidation,
  getMentorsValidation
} = require('../validators/mentorship');

/**
 * @swagger
 * /api/mentorship/mentors:
 *   get:
 *     tags: [Mentorship]
 *     summary: Get available mentors
 *     parameters:
 *       - in: query
 *         name: skill
 *         schema:
 *           type: string
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *       - in: query
 *         name: min_rating
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: List of mentors
 */
router.get('/mentors', getMentorsValidation, mentorshipController.getMentors);

/**
 * @swagger
 * /api/mentorship/requests:
 *   get:
 *     tags: [Mentorship]
 *     summary: Get mentorship requests
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of requests
 */
router.get('/requests', authenticate, mentorshipController.getMentorshipRequests);

/**
 * @swagger
 * /api/mentorship/requests:
 *   post:
 *     tags: [Mentorship]
 *     summary: Request mentorship
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mentor_id]
 *             properties:
 *               mentor_id:
 *                 type: string
 *               message:
 *                 type: string
 *               student_goals:
 *                 type: string
 *               preferred_session_type:
 *                 type: string
 *                 enum: [chat, video, in_person]
 *     responses:
 *       201:
 *         description: Request created
 */
router.post('/requests', authenticate, requestMentorshipValidation, mentorshipController.requestMentorship);

/**
 * @swagger
 * /api/mentorship/requests/{requestId}:
 *   put:
 *     tags: [Mentorship]
 *     summary: Accept/Reject mentorship request
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [accepted, rejected]
 *     responses:
 *       200:
 *         description: Request updated
 */
router.put('/requests/:requestId', authenticate, mentorshipController.updateRequestStatus);
router.patch('/requests/:id/:action', authenticate, mentorshipController.updateRequestStatus);

/**
 * @swagger
 * /api/mentorship/sessions:
 *   get:
 *     tags: [Mentorship]
 *     summary: Get mentorship sessions
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of sessions
 */
router.get('/sessions', authenticate, mentorshipController.getSessions);

/**
 * @swagger
 * /api/mentorship/sessions/{sessionId}/rate:
 *   post:
 *     tags: [Mentorship]
 *     summary: Rate a completed session
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [overall_rating]
 *             properties:
 *               overall_rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               communication_rating:
 *                 type: integer
 *               knowledge_rating:
 *                 type: integer
 *               punctuality_rating:
 *                 type: integer
 *               helpfulness_rating:
 *                 type: integer
 *               review:
 *                 type: string
 *     responses:
 *       200:
 *         description: Session rated
 */
router.post('/sessions/:sessionId/rate', authenticate, rateSessionValidation, mentorshipController.rateSession);

module.exports = router;
