const express = require('express');
const router = express.Router();
const doubtController = require('../controllers/doubts/doubtController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const {
  createDoubtValidation,
  updateDoubtValidation,
  answerDoubtValidation,
  getDoubtsValidation
} = require('../validators/doubt');

/**
 * @swagger
 * /api/doubts:
 *   get:
 *     tags: [Doubts Forum]
 *     summary: Get all doubts
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, answered, closed, flagged]
 *       - in: query
 *         name: subject
 *         schema:
 *           type: string
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [newest, oldest, popular, unanswered]
 *     responses:
 *       200:
 *         description: List of doubts
 */
router.get('/', getDoubtsValidation, doubtController.getAllDoubts);

/**
 * @swagger
 * /api/doubts/{id}:
 *   get:
 *     tags: [Doubts Forum]
 *     summary: Get doubt by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Doubt details
 *       404:
 *         description: Doubt not found
 */
router.get('/:id', doubtController.getDoubtById);

/**
 * @swagger
 * /api/doubts:
 *   post:
 *     tags: [Doubts Forum]
 *     summary: Create a new doubt
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, content, tags]
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               tags:
 *                 type: array
 *               subject:
 *                 type: string
 *               topic:
 *                 type: string
 *     responses:
 *       201:
 *         description: Doubt created
 */
router.post('/', authenticate, createDoubtValidation, doubtController.createDoubt);

/**
 * @swagger
 * /api/doubts/{id}:
 *   put:
 *     tags: [Doubts Forum]
 *     summary: Update doubt
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Doubt updated
 */
router.put('/:id', authenticate, updateDoubtValidation, doubtController.updateDoubt);

/**
 * @swagger
 * /api/doubts/{id}:
 *   delete:
 *     tags: [Doubts Forum]
 *     summary: Delete doubt
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Doubt deleted
 */
router.delete('/:id', authenticate, doubtController.deleteDoubt);

/**
 * @swagger
 * /api/doubts/{id}/answers:
 *   post:
 *     tags: [Doubts Forum]
 *     summary: Answer a doubt
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
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
 *       201:
 *         description: Answer created
 */
router.post('/:id/answers', authenticate, answerDoubtValidation, doubtController.answerDoubt);

/**
 * @swagger
 * /api/doubts/{id}/answers:
 *   get:
 *     tags: [Doubts Forum]
 *     summary: Get answers for a doubt
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of answers
 */
router.get('/:id/answers', doubtController.getDoubtAnswers);

/**
 * @swagger
 * /api/doubts/{id}/vote:
 *   post:
 *     tags: [Doubts Forum]
 *     summary: Vote on a doubt
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [vote_type]
 *             properties:
 *               vote_type:
 *                 type: integer
 *                 enum: [-1, 1]
 *     responses:
 *       200:
 *         description: Vote recorded
 */
router.post('/:id/vote', authenticate, doubtController.voteDoubt);

/**
 * @swagger
 /api/doubts/answers/{answerId}/vote:
 *   post:
 *     tags: [Doubts Forum]
 *     summary: Vote on an answer
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: answerId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [vote_type]
 *             properties:
 *               vote_type:
 *                 type: integer
 *                 enum: [-1, 1]
 *     responses:
 *       200:
 *         description: Vote recorded
 */
router.post('/answers/:answerId/vote', authenticate, doubtController.voteAnswer);

/**
 * @swagger
 * /api/doubts/{id}/accept/{answerId}:
 *   post:
 *     tags: [Doubts Forum]
 *     summary: Accept an answer
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: answerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Answer accepted
 */
router.post('/:id/accept/:answerId', authenticate, doubtController.acceptAnswer);

module.exports = router;
