const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { authenticate } = require('../middleware/auth');
const uploadController = require('../controllers/upload/uploadController');
const rateLimit = require('express-rate-limit');

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many upload requests. Please try again later.' }
});

router.post(
  '/document',
  authenticate,
  uploadLimiter,
  upload.single('document'),
  uploadController.uploadDocument
);

module.exports = router;
