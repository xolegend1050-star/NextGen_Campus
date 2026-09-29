const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin/adminController');
const { authenticate, authorize } = require('../middleware/auth');
const { uuidParams, intQueries } = require('../utils/validate');

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
router.get('/verifications', intQueries('page', 'limit'), adminController.getPendingVerifications);

// User management routes
// intQueries was imported here but never applied, so page and limit went
// straight into LIMIT/OFFSET. ?page=abc, ?limit=xyz, ?page=0 and ?page=-5 all
// returned 500 from Postgres rather than 400.
router.get('/users', intQueries('page', 'limit'), adminController.getUsers);
router.patch('/users/:id/ban', uuidParams('id'), adminController.banUser);
router.patch('/users/:id/unban', uuidParams('id'), adminController.unbanUser);
router.patch('/users/:id/role', uuidParams('id'), adminController.updateUserRole);

// Verification routes
router.patch('/verifications/:id', uuidParams('id'), adminController.reviewVerification);
router.put('/verifications/:id', uuidParams('id'), adminController.reviewVerification);

// Flagged content routes
router.get('/flagged-content', intQueries('page', 'limit'), adminController.getFlaggedContent);
router.patch('/flagged-content/:id', uuidParams('id'), adminController.reviewFlaggedContent);
router.put('/flagged-content/:id', uuidParams('id'), adminController.reviewFlaggedContent);

// Disputes routes
router.get('/disputes', intQueries('page', 'limit'), adminController.getDisputes);
router.patch('/disputes/:id/resolve', uuidParams('id'), adminController.resolveDispute);
router.put('/disputes/:id', uuidParams('id'), adminController.resolveDispute);

// Audit log
router.get('/audit-log', intQueries('page', 'limit'), adminController.getAuditLog);

module.exports = router;
