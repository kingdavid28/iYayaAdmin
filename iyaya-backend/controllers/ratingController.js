const Rating = require('../models/Rating');
const Booking = require('../models/Booking');
const { authenticate } = require('../middleware/auth');

// Rate a caregiver
const rateCaregiver = async (req, res) => {
  try {
    const { caregiverId, bookingId, rating, review } = req.body;
    const userId = req.user.id;

    // Verify the booking exists and belongs to the user
    const booking = await Booking.findOne({
      _id: bookingId,
      parent: userId
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    // Check if rating already exists
    const existingRating = await Rating.findOne({
      booking: bookingId,
      rater: userId,
      ratee: caregiverId,
      type: 'caregiver'
    });

    if (existingRating) {
      return res.status(400).json({
        success: false,
        error: 'You have already rated this caregiver for this booking'
      });
    }

    const newRating = new Rating({
      booking: bookingId,
      rater: userId,
      ratee: caregiverId,
      rating,
      review,
      type: 'caregiver'
    });

    await newRating.save();

    res.status(201).json({
      success: true,
      data: newRating
    });
  } catch (error) {
    console.error('Rate caregiver error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to rate caregiver'
    });
  }
};

// Rate a parent
const rateParent = async (req, res) => {
  try {
    const { parentId, bookingId, rating, review } = req.body;
    const userId = req.user.id;

    // Verify the booking exists and belongs to the user
    const booking = await Booking.findOne({
      _id: bookingId,
      caregiver: userId
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    // Check if rating already exists
    const existingRating = await Rating.findOne({
      booking: bookingId,
      rater: userId,
      ratee: parentId,
      type: 'parent'
    });

    if (existingRating) {
      return res.status(400).json({
        success: false,
        error: 'You have already rated this parent for this booking'
      });
    }

    const newRating = new Rating({
      booking: bookingId,
      rater: userId,
      ratee: parentId,
      rating,
      review,
      type: 'parent'
    });

    await newRating.save();

    res.status(201).json({
      success: true,
      data: newRating
    });
  } catch (error) {
    console.error('Rate parent error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to rate parent'
    });
  }
};

// Get ratings for a specific caregiver
const getCaregiverRatings = async (req, res) => {
  try {
    const { caregiverId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const ratings = await Rating.find({
      ratee: caregiverId,
      type: 'caregiver'
    })
    .populate('rater', 'name email')
    .populate('booking', 'id')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    const total = await Rating.countDocuments({
      ratee: caregiverId,
      type: 'caregiver'
    });

    res.status(200).json({
      success: true,
      data: ratings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get caregiver ratings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch caregiver ratings'
    });
  }
};

// Get ratings for a specific parent
const getParentRatings = async (req, res) => {
  try {
    const { parentId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const ratings = await Rating.find({
      ratee: parentId,
      type: 'parent'
    })
    .populate('rater', 'name email')
    .populate('booking', 'id')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    const total = await Rating.countDocuments({
      ratee: parentId,
      type: 'parent'
    });

    res.status(200).json({
      success: true,
      data: ratings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get parent ratings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch parent ratings'
    });
  }
};

// Get rating summary for a user
const getRatingSummary = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role = 'caregiver' } = req.query;

    const type = role === 'caregiver' ? 'caregiver' : 'parent';

    const ratings = await Rating.find({
      ratee: userId,
      type
    });

    const totalRatings = ratings.length;
    const averageRating = totalRatings > 0
      ? ratings.reduce((sum, rating) => sum + rating.rating, 0) / totalRatings
      : 0;

    res.status(200).json({
      success: true,
      data: {
        userId,
        role,
        totalRatings,
        averageRating: Math.round(averageRating * 10) / 10,
        ratings: ratings.slice(0, 5) // Return last 5 ratings
      }
    });
  } catch (error) {
    console.error('Get rating summary error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rating summary'
    });
  }
};

module.exports = {
  rateCaregiver,
  rateParent,
  getCaregiverRatings,
  getParentRatings,
  getRatingSummary
};
