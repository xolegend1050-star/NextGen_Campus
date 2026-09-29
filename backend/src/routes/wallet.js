const express = require('express');
const router = express.Router();
const walletController = require('../controllers/wallet/walletController');
const { authenticate, authorize } = require('../middleware/auth');
const { uuidParams, intQueries } = require('../utils/validate');

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
router.get('/transactions', authenticate, intQueries('page', 'limit'), walletController.getTransactions);

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
router.post('/escrow/:gigId', authenticate, uuidParams('gigId'), authorize('company'), walletController.fundEscrow);

/**
 * @swagger
 * /api/wallet/escrow:
 *   get:
 *     tags: [Wallet]
 *     summary: List escrow records for the caller
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Escrows
 */
router.get('/escrow', authenticate, walletController.listEscrows);

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
/**
 * Submit work for a gig.
 *
 * Without this there is no way for a student to submit a deliverable, and
 * releaseEscrow refuses to pay out until one exists. The check exists to stop a
 * company paying for work that was never handed over, so the student has to be
 * able to satisfy it honestly.
 */
router.post('/escrow/:gigId/deliverable', authenticate, uuidParams('gigId'), walletController.submitDeliverable);

/**
 * Release and refund are company actions, but an administrator must also be able
 * to call them: force-releasing without a deliverable is restricted to an admin,
 * and a company is refused that flag. Without admin on these two routes that
 * flag would be impossible to use.
 */
router.post('/escrow/:gigId/release', authenticate, uuidParams('gigId'), authorize('company', 'admin'), walletController.releaseEscrow);

/**
 * @swagger
 * /api/wallet/escrow/{gigId}/refund:
 *   post:
 *     tags: [Wallet]
 *     summary: Refund a locked escrow back to the company
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Refunded
 */
router.post('/escrow/:gigId/refund', authenticate, uuidParams('gigId'), authorize('company', 'admin'), walletController.refundEscrow);

/**
 * @swagger
 * /api/wallet/admin/withdrawals:
 *   get:
 *     tags: [Wallet]
 *     summary: List withdrawal requests (Admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Withdrawal requests
 */
router.get('/admin/withdrawals', authenticate, intQueries('page', 'limit'), authorize('admin'), walletController.listWithdrawals);

/**
 * @swagger
 * /api/wallet/admin/withdrawals/{id}:
 *   patch:
 *     tags: [Wallet]
 *     summary: Approve or reject a withdrawal (Admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Withdrawal processed
 */
router.patch('/admin/withdrawals/:id', authenticate, uuidParams('id'), authorize('admin'), walletController.processWithdrawal);

module.exports = router;
