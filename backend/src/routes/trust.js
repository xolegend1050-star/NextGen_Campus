const express = require('express');
const router = express.Router();
const trustController = require('../controllers/trust/trustController');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * /api/trust/score/{userId}:
 *   get:
 *     tags: [Trust Score]
 *     summary: Get user trust score
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Trust score details
 */
router.get('/score/:userId', authenticate, trustController.getTrustScore);

router.get('/my-score', authenticate, async (req, res, next) => {
  req.params.userId = req.user.id;
  trustController.getTrustScore(req, res, next);
});

/**
 * @swagger
 * /api/trust/history/{userId}:
 *   get:
 *     tags: [Trust Score]
 *     summary: Get trust score history
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Trust score history
 */
router.get('/history/:userId', authenticate, trustController.getTrustScoreHistory);

/**
 * @swagger
 * /api/trust/report-company/{companyId}:
 *   post:
 *     tags: [Trust Score]
 *     summary: Report a company
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: companyId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Company reported
 */
router.post('/report-company/:companyId', authenticate, trustController.reportCompany);

module.exports = router;
