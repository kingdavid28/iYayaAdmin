const Contract = require('../models/Contract');
const User = require('../models/User');
const { validationResult } = require('express-validator');

exports.createContract = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false,
      errors: errors.array() 
    });
  }

  try {
    const { caregiverId, serviceType, startDate, endDate, hours, rate, address, specialInstructions } = req.body;
    
    // Validate caregiver exists
    const caregiver = await User.findById(caregiverId);
    if (!caregiver || caregiver.role !== 'caregiver') {
      return res.status(404).json({ 
        success: false,
        error: 'Caregiver not found' 
      });
    }
    
    const totalAmount = hours * rate;
    
    const contract = new Contract({
      clientId: req.user.id,
      caregiverId,
      serviceType,
      startDate,
      endDate,
      hours,
      rate,
      totalAmount,
      address,
      specialInstructions,
      status: 'pending'
    });
    
    await contract.save();
    
    // Populate caregiver details in response
    const populatedContract = await Contract.populate(contract, {
      path: 'caregiverId',
      select: 'name profileImage'
    });
    
    res.status(201).json({
      success: true,
      contract: populatedContract
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create contract',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Other contract methods with similar improvements

// Get parent contracts
exports.getParentContracts = async (req, res) => {
  try {
    const contracts = await Contract.find({ clientId: req.params.parentId })
      .populate('caregiverId', 'name profileImage')
      .sort({ createdAt: -1 });
      
    res.json(contracts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Legacy method for backward compatibility
exports.getClientContracts = exports.getParentContracts;

// Get caregiver contracts
exports.getCaregiverContracts = async (req, res) => {
  try {
    const contracts = await Contract.find({ caregiverId: req.user.id })
      .populate('clientId', 'name profileImage')
      .sort({ createdAt: -1 });
      
    res.json(contracts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update contract status
exports.updateContractStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    const contract = await Contract.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    
    res.json(contract);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};