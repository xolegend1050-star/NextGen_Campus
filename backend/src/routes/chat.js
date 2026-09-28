const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const chatController = require('../controllers/chat/chatController');
const { authenticate } = require('../middleware/auth');

const CHAT_UPLOAD_DIR = path.join(__dirname, '../../uploads/chat');
fs.mkdirSync(CHAT_UPLOAD_DIR, { recursive: true });

const CHAT_ALLOWED = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
  'text/plain': ['.txt'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
};

const chatUploader = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      fs.mkdirSync(CHAT_UPLOAD_DIR, { recursive: true });
      cb(null, CHAT_UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const allowed = CHAT_ALLOWED[file.mimetype] || [];
      // Never trust the client extension: derive it from the declared type
      const safeExt = allowed.includes(ext) ? ext : '.bin';
      cb(null, `${uuidv4()}${safeExt}`);
    }
  }),
  fileFilter: (req, file, cb) => {
    if (CHAT_ALLOWED[file.mimetype]) return cb(null, true);
    cb(new Error('Only images, PDF and documents can be attached'), false);
  },
  limits: { fileSize: 10 * 1024 * 1024, files: 1 }
});

const chatUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many uploads. Please wait a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false }
});

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
 * /api/chat/unread-count:
 *   get:
 *     tags: [Chat]
 *     summary: Total unread messages across all conversations
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread message count
 */
router.get('/unread-count', authenticate, chatController.getUnreadCount);

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

/**
 * @swagger
 * /api/chat/conversations/{conversationId}/read:
 *   put:
 *     tags: [Chat]
 *     summary: Mark a whole conversation as read
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Marked as read
 */
router.put('/conversations/:conversationId/read', authenticate, chatController.markAsRead);

/**
 * @swagger
 * /api/chat/messages/{messageId}:
 *   patch:
 *     tags: [Chat]
 *     summary: Edit your own message
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Edited }
 *   delete:
 *     tags: [Chat]
 *     summary: Delete your own message
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Deleted }
 */
router.patch('/messages/:messageId', authenticate, chatController.editMessage);
router.delete('/messages/:messageId', authenticate, chatController.deleteMessage);

/**
 * @swagger
 * /api/chat/conversations/{conversationId}/participants:
 *   post:
 *     tags: [Chat]
 *     summary: Add a member to a group conversation
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Added }
 */
router.post('/conversations/:conversationId/participants', authenticate, chatController.addParticipant);

/**
 * @swagger
 * /api/chat/attachment:
 *   post:
 *     tags: [Chat]
 *     summary: Upload a file to attach to a message
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Uploaded }
 */
router.post(
  '/attachment',
  authenticate,
  chatUploadLimiter,
  chatUploader.single('file'),
  chatController.uploadAttachment
);

module.exports = router;
