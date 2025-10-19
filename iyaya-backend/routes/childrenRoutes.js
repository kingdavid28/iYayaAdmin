const express = require('express');
const router = express.Router();
const childrenController = require('../controllers/childrenController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// GET /api/children - Get all children for authenticated user
router.get('/', childrenController.getMyChildren);

// POST /api/children - Create a new child
router.post('/', childrenController.createChild);

// PUT /api/children/:id - Update a child
router.put('/:id', childrenController.updateChild);

// DELETE /api/children/:id - Delete a child
router.delete('/:id', childrenController.deleteChild);

module.exports = router;