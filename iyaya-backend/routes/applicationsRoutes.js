const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { body, param } = require('express-validator');
const applications = require('../controllers/applicationController');

// Enable authentication for all routes
router.use(authenticate);

// Validation middleware (disabled for demo)
// const validateApplication = [
//   body('jobId').notEmpty().withMessage('Job ID is required'),
//   body('coverLetter').optional().isLength({ max: 1000 }).withMessage('Cover letter must be less than 1000 characters'),
//   body('proposedRate').optional().isNumeric().withMessage('Proposed rate must be a number'),
//   body('message').optional().isLength({ max: 500 }).withMessage('Message must be less than 500 characters')
// ];

const validateStatusUpdate = [
  param('id').isMongoId().withMessage('Valid application ID is required'),
  body('status').isIn(['pending', 'accepted', 'rejected', 'shortlisted']).withMessage('Invalid status'),
  body('feedback').optional().isLength({ max: 500 }).withMessage('Feedback must be less than 500 characters')
];

// Routes
// POST /api/applications - caregiver applies to a job (simplified for demo)
router.post('/', applications.applyToJob);

// GET /api/applications/my-applications - caregiver's applications
router.get('/my-applications', applications.getMyApplications);

// GET /api/applications/my - caregiver's applications (legacy)
router.get('/my', applications.getMyApplications);

// GET /api/applications/debug - debug caregiver info
router.get('/debug', applications.debugCaregiverInfo);

// GET /api/applications/:id - get single application
router.get('/:id', applications.getApplicationById);

// PATCH /api/applications/:id/status - parent updates status
router.patch('/:id/status', validateStatusUpdate, applications.updateApplicationStatus);

// DELETE /api/applications/:id - caregiver withdraws application
router.delete('/:id', applications.withdrawApplication);

// GET /api/applications/job/:jobId - get applications for a job (parent)
router.get('/job/:jobId', applications.getJobApplications);

// Legacy route for backward compatibility
router.patch('/:id', validateStatusUpdate, applications.updateStatus);

module.exports = router;
