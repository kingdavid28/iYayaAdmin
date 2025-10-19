const Child = require('../models/Child');
const mongoose = require('mongoose');

const getUserId = (req) => {
  // Use the user ID set by authentication middleware
  const userId = req.user?.mongoId || req.user?.id;
  console.log('🔍 getUserId:', { mongoId: req.user?.mongoId, id: req.user?.id, resolved: userId });
  return userId;
};

// Get all children for the authenticated user
exports.getMyChildren = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const children = await Child.find({ parentId: userId }).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      children
    });
  } catch (err) {
    console.error('Get children error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to get children'
    });
  }
};

// Create a new child
exports.createChild = async (req, res) => {
  try {
    console.log('👶 Creating child - Request:', {
      body: req.body,
      user: req.user?.id || req.user?.mongoId,
      headers: req.headers.authorization ? 'Present' : 'Missing'
    });
    
    const userId = getUserId(req);
    console.log('👶 User ID resolved:', userId);
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    // Option A: Remove ID from request body and let MongoDB generate it
    const { _id, id, childId, ...childData } = req.body;
    
    // Validate required fields
    if (!childData.name || childData.age === undefined || childData.age === null) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name and age are required' 
      });
    }

    const cleanChildData = {
      parentId: userId,
      name: String(childData.name).trim(),
      age: Number(childData.age),
      allergies: childData.allergies || '',
      preferences: childData.preferences || ''
    };
    
    console.log('👶 Creating child with data:', cleanChildData);
    
    // Option B: Check if ID exists first (if somehow an ID was passed)
    if (_id || id || childId) {
      const providedId = _id || id || childId;
      const existingChild = await Child.findById(providedId);
      if (existingChild) {
        return res.status(400).json({
          success: false,
          error: 'Child ID already exists',
          suggestion: 'Remove the ID field to generate a new one automatically'
        });
      }
    }
    
    const child = new Child(cleanChildData);
    const savedChild = await child.save();
    console.log('✅ Child created successfully:', savedChild._id);

    res.status(201).json({
      success: true,
      child: savedChild
    });
  } catch (err) {
    console.error('❌ Create child error:', {
      name: err.name,
      message: err.message,
      code: err.code,
      stack: err.stack?.split('\n').slice(0, 5),
      userId: getUserId(req),
      requestBody: req.body
    });
    
    if (err.code === 11000) { // MongoDB duplicate key error
      // Check which field caused the duplicate error
      if (err.message.includes('parentId_1_name_1')) {
        res.status(400).json({
          success: false,
          error: 'A child with this name already exists',
          message: 'Please choose a different name for this child'
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'Child ID already exists',
          message: 'Please remove the ID field or provide a unique ID'
        });
      }
    } else if (err.name === 'ValidationError') {
      const errorMessage = Object.values(err.errors).map(e => e.message).join(', ');
      res.status(400).json({
        success: false,
        error: errorMessage
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to create child',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  }
};

// Update a child
exports.updateChild = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const { id } = req.params;
    const { name, age, allergies, preferences } = req.body;

    const child = await Child.findOneAndUpdate(
      { _id: id, parentId: userId },
      {
        name: name?.trim(),
        age: age ? Number(age) : undefined,
        allergies,
        preferences
      },
      { new: true, runValidators: true }
    );

    if (!child) {
      return res.status(404).json({ success: false, error: 'Child not found' });
    }

    res.json({
      success: true,
      child
    });
  } catch (err) {
    console.error('Update child error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to update child'
    });
  }
};

// Delete a child
exports.deleteChild = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const { id } = req.params;

    const child = await Child.findOneAndDelete({ _id: id, parentId: userId });

    if (!child) {
      return res.status(404).json({ success: false, error: 'Child not found' });
    }

    res.json({
      success: true,
      message: 'Child deleted successfully'
    });
  } catch (err) {
    console.error('Delete child error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to delete child'
    });
  }
};