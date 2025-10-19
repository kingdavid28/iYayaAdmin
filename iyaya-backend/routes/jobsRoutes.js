const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');
const { authenticate } = require('../middleware/auth');

// GET /api/jobs - Get all jobs (public for caregivers to browse)
router.get('/', jobController.getAllJobs);

// Protected routes (require authentication)
router.use(authenticate);

// GET /api/jobs/my - Get current user's jobs (must be before /:id)
router.get('/my', jobController.getMyJobs);

// POST /api/jobs - Create new job (parents only)
router.post('/', jobController.createJob);

// GET /api/jobs/:id - Get job by ID
router.get('/:id', jobController.getJobById);

// PUT /api/jobs/:id - Update job
router.put('/:id', jobController.updateJob);

// DELETE /api/jobs/:id - Delete job
router.delete('/:id', jobController.deleteJob);

// GET /api/jobs/:id/applications - Get applications for a job
router.get('/:id/applications', jobController.getApplicationsForJob);

module.exports = router;