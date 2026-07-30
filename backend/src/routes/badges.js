const express = require('express');
const router = express.Router();
const badgeController = require('../controllers/badges/badgeController');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * /api/badges:
 *   get:
 *     tags: [Badges]
 *     summary: Get all available badges
 *     responses:
 *       200:
 *         description: List of badges
 */
router.get('/', badgeController.getAllBadges);

/**
 * @swagger
 * /api/badges/my-badges:
 *   get:
 *     tags: [Badges]
 *     summary: Get user's earned badges
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User's badges
 */
router.get('/my-badges', authenticate, badgeController.getMyBadges);

/**
 * @swagger
 * /api/badges/points:
 *   get:
 *     tags: [Badges]
 *     summary: Get user's points
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User's points
 */
router.get('/points', authenticate, badgeController.getMyPoints);

module.exports = router;
