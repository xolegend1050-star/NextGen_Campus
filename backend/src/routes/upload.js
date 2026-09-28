const express = require('express');
const router = express.Router();
const { uploader, CATEGORIES } = require('../middleware/upload');
const { authenticate } = require('../middleware/auth');
const uploadController = require('../controllers/upload/uploadController');
const rateLimit = require('express-rate-limit');

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many upload requests. Please try again later.' }
});

/**
 * @swagger
 * /api/upload/avatar:
 *   post:
 *     summary: Upload a profile picture
 *     tags: [Upload]
 *     responses:
 *       200: { description: Uploaded }
 */
router.post(
  '/avatar',
  authenticate,
  uploadLimiter,
  uploader('avatar').single('file'),
  uploadController.uploadAvatar
);

/**
 * @swagger
 * /api/upload/resume:
 *   post:
 *     summary: Upload a PDF resume
 *     tags: [Upload]
 *     responses:
 *       200: { description: Uploaded }
 */
router.post(
  '/resume',
  authenticate,
  uploadLimiter,
  uploader('resume').single('file'),
  uploadController.uploadResume
);

/**
 * @swagger
 * /api/upload/document:
 *   post:
 *     summary: Upload a verification document (image or PDF)
 *     tags: [Upload]
 *     responses:
 *       200: { description: Uploaded }
 */
router.post(
  '/document',
  authenticate,
  uploadLimiter,
  uploader('document').single('document'),
  uploadController.uploadDocument
);

/**
 * @swagger
 * /api/upload/doubt-image:
 *   post:
 *     summary: Attach an image to a doubt
 *     tags: [Upload]
 *     responses:
 *       200: { description: Uploaded }
 */
router.post(
  '/doubt-image',
  authenticate,
  uploadLimiter,
  uploader('doubt').single('file'),
  uploadController.uploadDoubtImage
);

/** Persist an uploaded avatar onto the caller's profile. */
router.post('/avatar/apply', authenticate, uploadController.setAvatar);

/** Persist an uploaded resume onto the caller's profile. */
router.post('/resume/apply', authenticate, uploadController.setResume);

/** Remove a previously uploaded file. */
router.delete('/:category/:filename', authenticate, uploadController.deleteUpload);

module.exports = router;
module.exports.CATEGORIES = CATEGORIES;
