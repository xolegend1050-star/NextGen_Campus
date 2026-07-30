const express = require('express');
const router = express.Router();
const resourceController = require('../controllers/resources/resourceController');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @swagger
 * /api/resources:
 *   get:
 *     tags: [Resources]
 *     summary: Get all resources
 *     parameters:
 *       - in: query
 *         name: subject
 *         schema:
 *           type: string
 *       - in: query
 *         name: difficulty
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of resources
 */
router.get('/', resourceController.getResources);

/**
 * @swagger
 * /api/resources:
 *   post:
 *     tags: [Resources]
 *     summary: Upload a resource
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, resource_type]
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               resource_type:
 *                 type: string
 *                 enum: [document, video, link, code]
 *               file_url:
 *                 type: string
 *               external_url:
 *                 type: string
 *               tags:
 *                 type: array
 *               subject:
 *                 type: string
 *               difficulty_level:
 *                 type: string
 *     responses:
 *       201:
 *         description: Resource uploaded
 */
router.post('/', authenticate, resourceController.uploadResource);

/**
 * @swagger
 * /api/resources/{id}/download:
 *   post:
 *     tags: [Resources]
 *     summary: Record a download
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Download recorded
 */
router.post('/:id/download', resourceController.recordDownload);

/**
 * @swagger
 * /api/resources/interview-questions:
 *   get:
 *     tags: [Resources]
 *     summary: Get interview questions
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: difficulty
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of interview questions
 */
router.get('/interview-questions', resourceController.getInterviewQuestions);

/**
 * @swagger
 * /api/resources/interview-practice:
 *   post:
 *     tags: [Resources]
 *     summary: Practice an interview question
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [question_id, student_answer]
 *             properties:
 *               question_id:
 *                 type: string
 *               student_answer:
 *                 type: string
 *     responses:
 *       201:
 *         description: Practice recorded with AI feedback
 */
router.post('/interview-practice', authenticate, resourceController.practiceInterview);

module.exports = router;
