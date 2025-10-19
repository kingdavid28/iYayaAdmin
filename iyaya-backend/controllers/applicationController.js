const Application = require('../models/Application');
const Job = require('../models/Job');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const { process: processError } = require('../utils/errorHandler');
const logger = require('../utils/logger');
let socketService = null;
try {
  socketService = require('../services/socketService');
} catch (error) {
  console.warn('⚠️ Socket service not available, continuing without realtime updates:', error.message);
}

// Helper function to calculate total cost
const calculateTotalCost = (startTime, endTime, hourlyRate) => {
  const start = new Date(`2024-01-01T${startTime}`);
  const end = new Date(`2024-01-01T${endTime}`);
  const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  return Math.max(0, hours * hourlyRate);
};



// Helper to get consistent user ID
const getUserId = (user) => {
  return user?.id || user?.uid || user?.mongoId || 'demo-caregiver-id';
};

// Ensure we always use a valid Mongo ObjectId for DB operations
const mongoose = require('mongoose');
const resolveMongoId = async (user) => {
  console.log('🔍 resolveMongoId called with user:', {
    id: user?.id,
    uid: user?.uid,
    mongoId: user?.mongoId,
    _id: user?._id
  });
  
  // First try direct MongoDB IDs, but prioritize caregiver profile lookup
  const directId = user?.mongoId || user?._id;
  if (directId && mongoose.isValidObjectId(directId)) {
    console.log('✅ Found direct MongoDB ID:', directId);
    
    // Check if this is a User ID and find corresponding Caregiver profile
    try {
      const caregiver = await require('../models/Caregiver').findOne({ 
        userId: directId 
      });
      
      if (caregiver) {
        console.log('✅ Found caregiver profile for user ID:', caregiver._id);
        return caregiver._id;
      }
    } catch (error) {
      console.error('❌ Error finding caregiver by user ID:', error);
    }
    
    return directId;
  }
  
  // If user has Firebase UID, find corresponding user in User collection
  if (user?.id || user?.uid) {
    try {
      const userId = user.id || user.uid;
      console.log('🔍 Looking for user with firebaseUid:', userId);
      
      // First find the user by Firebase UID
      const userDoc = await require('../models/User').findOne({ 
        firebaseUid: userId 
      });
      
      if (userDoc) {
        // Then find caregiver profile using the user's MongoDB ID
        const caregiver = await require('../models/Caregiver').findOne({ 
          userId: userDoc._id 
        });
        
        if (caregiver) {
          console.log('✅ Found caregiver profile ID:', caregiver._id);
          return caregiver._id;
        }
        
        console.log('✅ Found user MongoDB ID:', userDoc._id);
        return userDoc._id;
      }

    } catch (error) {
      console.error('❌ Error finding user:', error);
    }
  }
  
  console.log('❌ No MongoDB ID found for user');
  return null;
};

// Caregiver applies to a job
exports.applyToJob = async (req, res) => {
  try {
    const { jobId, coverLetter, proposedRate, message } = req.body;
    const caregiverMongoId = await resolveMongoId(req.user);
    
    if (!jobId) {
      return res.status(400).json({ 
        success: false,
        error: 'Job ID is required' 
      });
    }
    
    if (!caregiverMongoId) {
      return res.status(400).json({ 
        success: false,
        error: 'User not properly authenticated' 
      });
    }

    // Check for duplicate application
    const existingApp = await Application.findOne({
      jobId,
      caregiverId: caregiverMongoId
    });
    
    if (existingApp) {
      return res.status(400).json({ 
        success: false,
        error: 'You have already applied to this job' 
      });
    }

    // Create application in database
    const application = new Application({
      jobId,
      caregiverId: caregiverMongoId,
      coverLetter: coverLetter || '',
      proposedRate: proposedRate ? Number(proposedRate) : undefined,
      message: message || '',
      status: 'pending'
    });

    await application.save();
    
    // Get job and parent info for notification
    const job = await Job.findById(jobId).populate('clientId', 'name');
    const caregiver = await require('../models/Caregiver').findById(caregiverMongoId).select('name');
    
    if (job && caregiver) {
      // Send real-time notification to parent
      socketService.notifyNewApplication(job.clientId._id, {
        applicationId: application._id,
        jobTitle: job.title,
        caregiverName: caregiver.name,
        jobId: job._id
      });
    }

    res.status(201).json({ 
      success: true, 
      message: 'Application submitted successfully',
      data: application 
    });
  } catch (error) {
    console.error('Application submission error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to submit application' 
    });
  }
};

// Parent updates application status (accept/reject/shortlist)
exports.updateApplicationStatus = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const parentId = req.user?.mongoId || req.user?._id;
    const { id } = req.params;
    const { status, feedback } = req.body;
    
    const validStatuses = ['pending', 'accepted', 'rejected', 'shortlisted', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }

    const application = await Application.findById(id)
      .populate('caregiverId', 'name email avatar')
      .populate('jobId', 'title clientId');
      
    if (!application) {
      return res.status(404).json({ 
        success: false,
        error: 'Application not found' 
      });
    }

    // Verify parent owns the job
    if (!application.jobId || !application.jobId.clientId) {
      return res.status(404).json({ 
        success: false,
        error: 'Job or client information not found' 
      });
    }
    
    if (application.jobId.clientId.toString() !== parentId.toString()) {
      return res.status(403).json({ 
        success: false,
        error: 'Not authorized to modify this application' 
      });
    }

    const previousStatus = application.status;
    application.status = status;
    application.reviewedAt = new Date();
    application.reviewedBy = parentId;
    
    if (feedback) {
      application.feedback = feedback;
    }

    await application.save();
    
    // Update caregiver's hasCompletedJobs flag when application is completed
    if (status === 'completed' && previousStatus !== 'completed' && application.caregiverId) {
      try {
        const Caregiver = require('../models/Caregiver');
        await Caregiver.findByIdAndUpdate(
          application.caregiverId._id,
          { hasCompletedJobs: true },
          { new: true }
        );
        console.log(`✅ Updated hasCompletedJobs for caregiver: ${application.caregiverId._id}`);
      } catch (error) {
        console.error('❌ Error updating caregiver hasCompletedJobs:', error);
      }
    }
    
    // Send booking confirmation notification to parent if accepted
    if (status === 'accepted' && previousStatus !== 'accepted') {
      const caregiver = await require('../models/Caregiver').findById(application.caregiverId._id).select('name');
      if (caregiver) {
        socketService.notifyBookingConfirmed(parentId, {
          applicationId: application._id,
          caregiverName: caregiver.name,
          jobTitle: application.jobId.title
        });
      }
    }

    // Update job status based on applications
    if (application.jobId && application.jobId._id) {
      const job = await Job.findById(application.jobId._id);
      
      if (job) {
        // If this is the first application, change job status to pending
        const applicationCount = await Application.countDocuments({ 
          jobId: application.jobId._id,
          status: { $in: ['pending', 'shortlisted'] }
        });
        
        if (job.status === 'open' && applicationCount > 0) {
          job.status = 'pending';
          await job.save();
        }
      }
    }

    // Update job status if application is accepted
    if (status === 'accepted' && previousStatus !== 'accepted' && application.jobId && application.jobId._id) {
      const job = await Job.findById(application.jobId._id);
      if (job && application.caregiverId && application.caregiverId._id) {
        job.status = 'filled';
        job.assignedCaregiver = application.caregiverId._id;
        await job.save();

        // Create booking from accepted application
        const Booking = require('../models/Booking');
        const booking = new Booking({
          clientId: parentId,
          caregiverId: application.caregiverId._id,
          date: job.date,
          startTime: job.startTime,
          endTime: job.endTime,
          address: job.location,
          hourlyRate: job.hourlyRate,
          totalCost: calculateTotalCost(job.startTime, job.endTime, job.hourlyRate),
          status: 'confirmed',
          jobId: job._id,
          applicationId: application._id
        });
        
        await booking.save();
        console.log('✅ Booking created from accepted application:', booking._id);

        // Reject other pending applications for this job
        await Application.updateMany(
          { 
            jobId: application.jobId._id, 
            _id: { $ne: application._id },
            status: 'pending'
          },
          { 
            status: 'rejected',
            feedback: 'Position has been filled',
            reviewedAt: new Date(),
            reviewedBy: parentId
          }
        );
      }
    }

    logger.info(`Application ${id} status updated to ${status} by parent ${parentId}`);

    res.json({ 
      success: true, 
      message: `Application ${status} successfully`,
      data: application 
    });

  } catch (error) {
    logger.error('Update application status error:', error);
    const processedError = processError(error);
    res.status(500).json({
      success: false,
      error: processedError?.userMessage || error.message || 'An error occurred'
    });
  }
};

// Get my applications (caregiver)
exports.getMyApplications = async (req, res) => {
  try {
    console.log('🔍 getMyApplications - User role check:', {
      userId: req.user?.id,
      role: req.user?.role,
      role: req.user?.role
    });
    
    // Check if user is a caregiver
    if (req.user?.role !== 'caregiver') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Only caregivers can view applications.'
      });
    }
    
    const caregiverMongoId = await resolveMongoId(req.user);
    console.log('🔍 Resolved caregiver MongoDB ID:', caregiverMongoId);
    
    if (!caregiverMongoId) {
      return res.status(400).json({
        success: false,
        error: 'Caregiver profile not found. Please complete your caregiver registration.'
      });
    }
    
    // Check if any applications exist for this caregiver
    const applicationCount = await Application.countDocuments({ caregiverId: caregiverMongoId });
    console.log('🔍 Applications count in DB for caregiver ID:', applicationCount);

    const { 
      status,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    const filter = { caregiverId: caregiverMongoId };
    if (status) {
      filter.status = status;
    }

    // Pagination
    const skip = (Number(page) - 1) * Number(limit);
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    console.log('🔍 Query filter:', filter);
    
    const applications = await Application.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .lean();
    
    // Manually populate job data with parent information
    console.log('🔍 Starting job population for', applications.length, 'applications');
    for (let i = 0; i < applications.length; i++) {
      const app = applications[i];
      console.log('🔍 Processing application', i, 'with jobId:', app.jobId);
      if (app.jobId) {
        try {
          const job = await Job.findById(app.jobId).populate('clientId', 'name email').lean();
          if (job) {
            app.jobId = job;
            // Add parent ID directly to application for easy access
            app.parentId = job.clientId?._id || job.clientId;
            console.log('✅ Populated job with parent ID:', job.title, 'Parent ID:', app.parentId);
          } else {
            console.log('❌ Job not found for ID:', app.jobId);
          }
        } catch (error) {
          console.log('❌ Error populating job:', error.message);
        }
      }
    }
    console.log('🔍 Job population completed');
    
    const total = await Application.countDocuments(filter);
    
    console.log('🔍 Found applications:', applications.length, 'Total:', total);
    
    if (applications.length > 0) {
      console.log('🔍 First application data:', JSON.stringify(applications[0], null, 2));
    }

    res.json({ 
      success: true, 
      data: {
        applications,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });

  } catch (error) {
    logger.error('Get my applications error:', error);
    const processedError = processError(error);
    res.status(500).json({
      success: false,
      error: processedError?.userMessage || error.message || 'An error occurred'
    });
  }
};

// Get applications for a specific job (parent)
exports.getJobApplications = async (req, res) => {
  try {
    const parentId = req.user?.mongoId || req.user?._id;
    const { jobId } = req.params;
    const { status, page = 1, limit = 10 } = req.query;

    // Verify parent owns the job
    const job = await Job.findOne({ _id: jobId, clientId: parentId });
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found or not authorized'
      });
    }

    // Build filter
    const filter = { jobId };
    if (status) {
      filter.status = status;
    }

    // Pagination
    const skip = (Number(page) - 1) * Number(limit);

    const [applications, total] = await Promise.all([
      Application.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate({
          path: 'caregiverId',
          model: 'Caregiver',
          select: 'name profileImage rating experience hourlyRate bio location'
        })
        .lean(),
      Application.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        applications,
        job: {
          id: job._id,
          title: job.title,
          status: job.status
        },
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });

  } catch (error) {
    logger.error('Get job applications error:', error);
    const processedError = processError(error);
    res.status(500).json({
      success: false,
      error: processedError?.userMessage || error.message || 'An error occurred'
    });
  }
};

// Get single application details
exports.getApplicationById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.mongoId || req.user?._id;

    const application = await Application.findById(id)
      .populate('caregiverId', 'name avatar rating reviewCount experience hourlyRate bio location')
      .populate({
        path: 'jobId',
        select: 'title description location hourlyRate date startTime endTime clientId status',
        populate: {
          path: 'clientId',
          select: 'name avatar'
        }
      });

    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Application not found'
      });
    }

    // Check authorization - either the caregiver who applied or the parent who owns the job
    const isCaregiver = application.caregiverId?._id?.toString() === userId?.toString();
    const isParent = application.jobId?.clientId?._id?.toString() === userId?.toString();

    if (!isCaregiver && !isParent) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view this application'
      });
    }

    res.json({
      success: true,
      data: application
    });

  } catch (error) {
    logger.error('Get application by ID error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'An error occurred'
    });
  }
};

// Withdraw application (caregiver)
exports.withdrawApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const caregiverMongoId = await resolveMongoId(req.user);

    const application = await Application.findOne({
      _id: id,
      caregiverId: caregiverMongoId
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Application not found'
      });
    }

    if (application.status === 'accepted') {
      return res.status(400).json({
        success: false,
        error: 'Cannot withdraw an accepted application'
      });
    }

    await Application.findByIdAndDelete(id);

    logger.info(`Application ${id} withdrawn by caregiver ${caregiverMongoId}`);

    res.json({
      success: true,
      message: 'Application withdrawn successfully'
    });

  } catch (error) {
    logger.error('Withdraw application error:', error);
    const processedError = processError(error);
    res.status(500).json({
      success: false,
      error: processedError?.userMessage || error.message || 'An error occurred'
    });
  }
};

// Debug endpoint to check caregiver ID resolution
exports.debugCaregiverInfo = async (req, res) => {
  try {
    const caregiverMongoId = await resolveMongoId(req.user);
    const applicationCount = await Application.countDocuments({ caregiverId: caregiverMongoId });
    
    res.json({
      success: true,
      debug: {
        userInfo: {
          id: req.user?.id,
          role: req.user?.role,
          mongoId: req.user?.mongoId
        },
        resolvedCaregiverMongoId: caregiverMongoId,
        applicationsInDB: applicationCount
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      debug: {
        userInfo: {
          id: req.user?.id,
          role: req.user?.role
        }
      }
    });
  }
};

// Legacy alias for backward compatibility
exports.updateStatus = exports.updateApplicationStatus;
