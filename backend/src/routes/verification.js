const express = require('express');
const router = express.Router();
const verificationController = require('../controllers/verification/verificationController');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * /api/verification/status:
 *   get:
 *     tags: [Verification]
 *     summary: Get verification status
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Verification status
 */
router.get('/status', authenticate, verificationController.getVerificationStatus);

/**
 * @swagger
 * /api/verification/submit:
 *   post:
 *     tags: [Verification]
 *     summary: Submit verification document
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [verification_type]
 *             properties:
 *               verification_type:
 *                 type: string
 *                 enum: [student_college_email, student_id_card, alumni_linkedin, alumni_college_id, company_domain, company_gst]
 *               document_url:
 *                 type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Verification submitted
 */
router.post('/submit', authenticate, verificationController.submitVerification);

/**
 * @swagger
 * /api/verification/verify-email:
 *   post:
 *     tags: [Verification]
 *     summary: Verify email with token
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email verified
 */
router.post('/verify-email', authenticate, verificationController.verifyEmail);

module.exports = router;
