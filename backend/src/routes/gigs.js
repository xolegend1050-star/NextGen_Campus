const express = require('express');
const router = express.Router();
const gigController = require('../controllers/gigs/gigController');
const { authenticate, authorize } = require('../middleware/auth');
const {
  createGigValidation,
  updateGigValidation,
  applyGigValidation,
  getGigsValidation
} = require('../validators/gig');

/**
 * @swagger
 * /api/gigs:
 *   get:
 *     tags: [Gigs]
 *     summary: Get all gigs
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: skills
 *         schema:
 *           type: string
 *       - in: query
 *         name: is_remote
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: min_compensation
 *         schema:
 *           type: number
 *       - in: query
 *         name: max_compensation
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: List of gigs
 */
router.get('/', getGigsValidation, gigController.getAllGigs);

/**
 * @swagger
 * /api/gigs/my-applications:
 *   get:
 *     tags: [Gigs]
 *     summary: Get student's applications
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of student's applications
 */
router.get('/my-applications', authenticate, gigController.getMyApplications);

/**
 * @swagger
 * /api/gigs/{id}:
 *   get:
 *     tags: [Gigs]
 *     summary: Get gig by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Gig details
 *       404:
 *         description: Gig not found
 */
router.get('/:id', gigController.getGigById);

/**
 * @swagger
 * /api/gigs:
 *   post:
 *     tags: [Gigs]
 *     summary: Create a new gig (Company only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, description, skills_required, category, compensation, duration_days]
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               requirements:
 *                 type: string
 *               skills_required:
 *                 type: array
 *               category:
 *                 type: string
 *               compensation:
 *                 type: number
 *               duration_days:
 *                 type: integer
 *               max_students:
 *                 type: integer
 *               is_remote:
 *                 type: boolean
 *               location:
 *                 type: string
 *               application_deadline:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Gig created
 */
router.post('/', authenticate, authorize('company'), createGigValidation, gigController.createGig);

/**
 * @swagger
 * /api/gigs/{id}:
 *   put:
 *     tags: [Gigs]
 *     summary: Update gig (Company only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Gig updated
 */
router.put('/:id', authenticate, authorize('company'), updateGigValidation, gigController.updateGig);

/**
 * @swagger
 * /api/gigs/{id}:
 *   delete:
 *     tags: [Gigs]
 *     summary: Delete gig (Company only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Gig deleted
 */
router.delete('/:id', authenticate, authorize('company'), gigController.deleteGig);

/**
 * @swagger
 * /api/gigs/{id}/apply:
 *   post:
 *     tags: [Gigs]
 *     summary: Apply for a gig (Student only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cover_letter:
 *                 type: string
 *               resume_url:
 *                 type: string
 *     responses:
 *       201:
 *         description: Application submitted
 */
router.post('/:id/apply', authenticate, authorize('student'), applyGigValidation, gigController.applyForGig);

/**
 * @swagger
 * /api/gigs/{id}/applications:
 *   get:
 *     tags: [Gigs]
 *     summary: Get applications for a gig (Company only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of applications
 */
router.get('/:id/applications', authenticate, authorize('company'), gigController.getGigApplications);

/**
 * @swagger
 * /api/gigs/applications/{applicationId}/status:
 *   put:
 *     tags: [Gigs]
 *     summary: Update application status (Company only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [shortlisted, accepted, rejected]
 *     responses:
 *       200:
 *         description: Application status updated
 */
router.put('/applications/:applicationId/status', authenticate, authorize('company'), gigController.updateApplicationStatus);
router.patch('/applications/:applicationId', authenticate, authorize('company'), gigController.updateApplicationStatus);

module.exports = router;
