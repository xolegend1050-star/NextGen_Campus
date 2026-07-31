const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin/adminController');
const { authenticate, authorize } = require('../middleware/auth');

// All admin routes require admin role
router.use(authenticate, authorize('admin'));

/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     tags: [Admin]
 *     summary: Get admin dashboard stats
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics
 */
router.get('/dashboard', adminController.getDashboardStats);

/**
 * @swagger
 * /api/admin/verifications:
 *   get:
 *     tags: [Admin]
 *     summary: Get pending verifications
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of pending verifications
 */
router.get('/verifications', adminController.getPendingVerifications);

// User management routes
router.get('/users', adminController.getUsers);
router.patch('/users/:id/ban', adminController.banUser);
router.patch('/users/:id/unban', adminController.unbanUser);
router.patch('/users/:id/role', adminController.updateUserRole);

// Verification routes
router.patch('/verifications/:id', adminController.reviewVerification);
router.put('/verifications/:id', adminController.reviewVerification);

// Flagged content routes
router.get('/flagged-content', adminController.getFlaggedContent);
router.patch('/flagged-content/:id', adminController.reviewFlaggedContent);
router.put('/flagged-content/:id', adminController.reviewFlaggedContent);

// Disputes routes
router.get('/disputes', adminController.getDisputes);
router.patch('/disputes/:id/resolve', adminController.resolveDispute);
router.put('/disputes/:id', adminController.resolveDispute);

// Audit log
router.get('/audit-log', adminController.getAuditLog);

module.exports = router;
