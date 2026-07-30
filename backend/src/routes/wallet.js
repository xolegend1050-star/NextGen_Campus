const express = require('express');
const router = express.Router();
const walletController = require('../controllers/wallet/walletController');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * /api/wallet:
 *   get:
 *     tags: [Wallet]
 *     summary: Get wallet balance
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wallet details
 */
router.get('/', authenticate, walletController.getWallet);

/**
 * @swagger
 * /api/wallet/transactions:
 *   get:
 *     tags: [Wallet]
 *     summary: Get wallet transactions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of transactions
 */
router.get('/transactions', authenticate, walletController.getTransactions);

/**
 * @swagger
 * /api/wallet/withdraw:
 *   post:
 *     tags: [Wallet]
 *     summary: Request withdrawal
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, payment_method]
 *             properties:
 *               amount:
 *                 type: number
 *               payment_method:
 *                 type: string
 *               payment_details:
 *                 type: object
 *     responses:
 *       200:
 *         description: Withdrawal requested
 */
router.post('/withdraw', authenticate, walletController.requestWithdrawal);

/**
 * @swagger
 * /api/wallet/escrow/{gigId}:
 *   post:
 *     tags: [Wallet]
 *     summary: Fund escrow for a gig (Company only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gigId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Escrow funded
 */
router.post('/escrow/:gigId', authenticate, walletController.fundEscrow);

/**
 * @swagger
 * /api/wallet/escrow/{gigId}/release:
 *   post:
 *     tags: [Wallet]
 *     summary: Release escrow payment (Company only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: gigId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Escrow released
 */
router.post('/escrow/:gigId/release', authenticate, walletController.releaseEscrow);

module.exports = router;
