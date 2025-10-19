const Child = require('../models/Child');
const User = require('../models/User');
const mongoose = require('mongoose');

const resolveMongoId = (user) => {
  const id = user?.mongoId || user?._id || user?.id;
  return mongoose.isValidObjectId(id) ? id : null;
};

// Get all children for current parent
exports.getMyChildren = async (req, res) => {
  try {
    const userMongoId = resolveMongoId(req.user);
    if (!userMongoId) {
      return res.status(401).json({ success: false, error: 'User mapping not found' });
    }

    const children = await Child.find({ parentId: userMongoId }).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: {
        children
      }
    });
  } catch (error) {
    console.error('Error fetching children:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch children'
    });
  }
};

// Create a new child
exports.createChild = async (req, res) => {
  try {
    const userMongoId = resolveMongoId(req.user);
    if (!userMongoId) {
      return res.status(401).json({ success: false, error: 'User mapping not found' });
    }

    const childData = {
      ...req.body,
      parentId: userMongoId
    };

    const newChild = new Child(childData);
    await newChild.save();
    
    res.status(201).json({
      success: true,
      data: {
        child: newChild
      }
    });
  } catch (error) {
    console.error('Error creating child:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create child'
    });
  }
};

// Update a child
exports.updateChild = async (req, res) => {
  try {
    const userMongoId = resolveMongoId(req.user);
    if (!userMongoId) {
      return res.status(401).json({ success: false, error: 'User mapping not found' });
    }

    const child = await Child.findOneAndUpdate(
      { _id: req.params.id, parentId: userMongoId },
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!child) {
      return res.status(404).json({
        success: false,
        error: 'Child not found or not authorized'
      });
    }
    
    res.json({
      success: true,
      data: {
        child
      }
    });
  } catch (error) {
    console.error('Error updating child:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update child'
    });
  }
};

// Delete a child
exports.deleteChild = async (req, res) => {
  try {
    const userMongoId = resolveMongoId(req.user);
    if (!userMongoId) {
      return res.status(401).json({ success: false, error: 'User mapping not found' });
    }

    const child = await Child.findOneAndDelete({
      _id: req.params.id,
      parentId: userMongoId
    });
    
    if (!child) {
      return res.status(404).json({
        success: false,
        error: 'Child not found or not authorized'
      });
    }
    
    res.json({
      success: true,
      message: 'Child deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting child:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete child'
    });
  }
};