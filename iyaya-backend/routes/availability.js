const express = require('express');
const router = express.Router();
const { authenticate } = require('../utils/auth');

// Mock availability data
let mockAvailability = {};

// Get caregiver availability
router.get('/', authenticate, async (req, res) => {
  try {
    const availability = mockAvailability[req.user.id] || {
      monday: { available: true, startTime: '08:00', endTime: '18:00' },
      tuesday: { available: true, startTime: '08:00', endTime: '18:00' },
      wednesday: { available: true, startTime: '08:00', endTime: '18:00' },
      thursday: { available: true, startTime: '08:00', endTime: '18:00' },
      friday: { available: true, startTime: '08:00', endTime: '18:00' },
      saturday: { available: false, startTime: '08:00', endTime: '18:00' },
      sunday: { available: false, startTime: '08:00', endTime: '18:00' }
    };
    
    res.json({
      success: true,
      data: availability
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get availability'
    });
  }
});

// Update caregiver availability
router.put('/', authenticate, async (req, res) => {
  try {
    mockAvailability[req.user.id] = req.body;
    
    res.json({
      success: true,
      message: 'Availability updated successfully',
      data: mockAvailability[req.user.id]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update availability'
    });
  }
});

module.exports = router;