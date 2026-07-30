const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat/chatController');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * /api/chat/conversations:
 *   get:
 *     tags: [Chat]
 *     summary: Get user conversations
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of conversations
 */
router.get('/conversations', authenticate, chatController.getConversations);

/**
 * @swagger
 * /api/chat/conversations:
 *   post:
 *     tags: [Chat]
 *     summary: Create a new conversation
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [participant_id, type]
 *             properties:
 *               participant_id:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [mentorship, gig, dispute, general]
 *     responses:
 *       201:
 *         description: Conversation created
 */
router.post('/conversations', authenticate, chatController.createConversation);

/**
 * @swagger
 * /api/chat/conversations/{conversationId}/messages:
 *   get:
 *     tags: [Chat]
 *     summary: Get messages in a conversation
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of messages
 */
router.get('/conversations/:conversationId/messages', authenticate, chatController.getMessages);

/**
 * @swagger
 * /api/chat/conversations/{conversationId}/messages:
 *   post:
 *     tags: [Chat]
 *     summary: Send a message
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *               message_type:
 *                 type: string
 *                 enum: [text, image, file]
 *               file_url:
 *                 type: string
 *     responses:
 *       201:
 *         description: Message sent
 */
router.post('/conversations/:conversationId/messages', authenticate, chatController.sendMessage);

/**
 * @swagger
 * /api/chat/messages/{messageId}/read:
 *   put:
 *     tags: [Chat]
 *     summary: Mark message as read
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Message marked as read
 */
router.put('/messages/:messageId/read', authenticate, chatController.markAsRead);

module.exports = router;
