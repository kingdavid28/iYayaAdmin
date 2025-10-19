// controllers/userController.js
const {
  UserService,
  CaregiverProfileService,
  CaregiverDocumentService,
  BackgroundCheckService,
  UserStatusHistoryService
} = require('../services/supabaseService');

const normalizeUser = (record) => {
  if (!record) return null;

  return {
    id: record.id,
    email: record.email,
    name: record.name,
    phone: record.phone,
    role: record.role,
    status: record.status,
    statusReason: record.status_reason,
    profileImage: record.profile_image,
    address: record.address,
    children: record.children,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    caregiverProfile: record.caregiver_profiles || null,
    caregiverBackgroundCheck: record.caregiver_background_checks || null
  };
};

const normalizeCaregiver = (record) => {
  if (!record) return null;

  const profile = record.caregiver_profiles || {};
  return {
    id: record.id,
    name: record.name,
    role: record.role,
    rating: profile.rating,
    reviewCount: profile.review_count,
    profileImage: profile.profile_image || record.profile_image,
    bio: profile.bio,
    experience: profile.experience,
    availability: profile.availability,
    trustScore: profile.trust_score,
    hasCompletedJobs: profile.has_completed_jobs,
    emergencyContacts: profile.emergency_contacts,
    certifications: profile.certifications,
    skills: record.skills,
    languages: profile.languages,
    ageCareRanges: profile.age_care_ranges,
    createdAt: record.created_at
  };
};

const handleSupabaseError = (error, context = 'Supabase operation') => {
  console.error(`${context} error:`, error);
  return {
    success: false,
    error: error?.message || 'Unexpected Supabase error'
  };
};

// Get current user profile
exports.getCurrentUserProfile = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const record = await UserService.findDetailedById(userId);

    if (!record) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const profile = normalizeUser(record);

    res.json({
      success: true,
      data: profile,
      ...profile
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, 'getCurrentUserProfile'));
  }
};

// Get user profile by ID
exports.getUserProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await UserService.findDetailedById(id);

    if (!record) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const profile = normalizeUser(record);

    res.json({
      success: true,
      data: profile,
      ...profile
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, 'getUserProfile'));
  }
};

// Update current user profile
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    const updateData = { ...req.body };

    delete updateData.password;
    delete updateData.email;
    delete updateData.role;
    delete updateData.id;
    delete updateData.created_at;
    delete updateData.updated_at;

    const allowedUserFields = {
      name: updateData.name,
      phone: updateData.phone,
      address: updateData.address,
      profile_image: updateData.profileImage || updateData.profile_image,
      children: updateData.children
    };

    Object.keys(allowedUserFields).forEach((key) => allowedUserFields[key] === undefined && delete allowedUserFields[key]);

    const profileFields = {
      bio: updateData.bio,
      experience: updateData.experience,
      availability: updateData.availability,
      hourly_rate: updateData.hourlyRate,
      portfolio: updateData.portfolio,
      emergency_contacts: updateData.emergencyContacts,
      languages: updateData.languages,
      age_care_ranges: updateData.ageCareRanges,
      certifications: updateData.certifications
    };

    Object.keys(profileFields).forEach((key) => profileFields[key] === undefined && delete profileFields[key]);

    let updatedUser = null;
    if (Object.keys(allowedUserFields).length > 0) {
      updatedUser = await UserService.update(userId, allowedUserFields);
    }

    let updatedProfile = null;
    if (Object.keys(profileFields).length > 0) {
      updatedProfile = await CaregiverProfileService.upsert(userId, profileFields);
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: normalizeUser({ ...(updatedUser || {}), caregiver_profiles: updatedProfile })
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, 'updateProfile'));
  }
};

// Get users list
exports.getUsers = async (req, res) => {
  try {
    const { search, role, page = 1, limit = 20 } = req.query;
    const { users, total } = await UserService.getUsers({
      search,
      role,
      limit: Number(limit),
      page: Number(page),
      includeProfile: true
    });

    const normalized = (users || []).map(normalizeUser);

    res.json({
      success: true,
      data: {
        users: normalized,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil((total || 0) / Number(limit) || 1)
        }
      }
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, 'getUsers'));
  }
};

// Get caregivers list
exports.getCaregivers = async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const { users, total } = await UserService.getUsers({
      search,
      role: 'caregiver',
      limit: Number(limit),
      page: Number(page),
      includeProfile: true
    });

    const caregivers = (users || []).map(normalizeCaregiver);

    res.json({
      success: true,
      data: {
        caregivers,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil((total || 0) / Number(limit) || 1)
        }
      }
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, 'getCaregivers'));
  }
};

// Get families list
exports.getFamilies = async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const { users, total } = await UserService.getUsers({
      search,
      role: 'parent',
      limit: Number(limit),
      page: Number(page)
    });

    const normalized = (users || []).map(normalizeUser);

    res.json({
      success: true,
      data: {
        families: normalized,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil((total || 0) / Number(limit) || 1)
        }
      }
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, 'getFamilies'));
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await UserService.findDetailedById(id);

    if (!record) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: normalizeUser(record)
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, 'getUserById'));
  }
};

// List caregiver documents
exports.listCaregiverDocuments = async (req, res) => {
  try {
    const { userId } = req.params;
    const documents = await CaregiverDocumentService.listByUser(userId);

    res.json({
      success: true,
      data: documents
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, 'listCaregiverDocuments'));
  }
};

// Create caregiver document
exports.createCaregiverDocument = async (req, res) => {
  try {
    const { userId } = req.params;
    const document = await CaregiverDocumentService.create(userId, req.body);

    res.status(201).json({
      success: true,
      data: document
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, 'createCaregiverDocument'));
  }
};

// Update caregiver document
exports.updateCaregiverDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const updated = await CaregiverDocumentService.update(documentId, req.body);

    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, 'updateCaregiverDocument'));
  }
};

// Delete caregiver document
exports.deleteCaregiverDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    await CaregiverDocumentService.delete(documentId);

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, 'deleteCaregiverDocument'));
  }
};

// Verify caregiver document
exports.verifyCaregiverDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const adminId = req.user?.id;
    const { verified = true } = req.body;

    const updated = await CaregiverDocumentService.markVerified(documentId, {
      adminId,
      verified
    });

    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, 'verifyCaregiverDocument'));
  }
};

// Update background check status
exports.updateBackgroundCheckStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.user?.id;
    const payload = { ...req.body };

    if (adminId) payload.verifiedBy = adminId;

    const record = await BackgroundCheckService.updateStatus(userId, payload);

    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, 'updateBackgroundCheckStatus'));
  }
};

// Get user status history
exports.getUserStatusHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const history = await UserStatusHistoryService.listByUser(userId);

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, 'getUserStatusHistory'));
  }
};