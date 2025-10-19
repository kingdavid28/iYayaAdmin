const {
  UserService,
  JobService,
  BookingService,
  AuditLogService,
  AuthAdminService,
  CaregiverProfileService,
  CaregiverDocumentService,
  BackgroundCheckService,
  UserStatusHistoryService,
  SystemSettingsService,
} = require("../services/supabaseService");
const auditService = require("../services/auditService");
const { sendStatusEmail } = require("../services/emailService");

const normalizeUser = (record) => {
  if (!record) return null;

  return {
    id: record.id,
    email: record.email,
    name: record.name,
    role: record.role,
    status: record.status,
    statusReason: record.status_reason,
    statusUpdatedAt: record.status_updated_at,
    statusUpdatedBy: record.status_updated_by,
    deletedAt: record.deleted_at,
    profileImage: record.profile_image,
    createdAt: record.created_at,
    caregiverProfile: record.caregiver_profiles || null,
  };
};

const normalizeBooking = (record) => {
  if (!record) return null;
  return {
    ...record,
    parent: record.parent || null,
    caregiver: record.caregiver || null,
    job: record.job || null,
  };
};

const normalizeJob = (record) => {
  if (!record) return null;
  return {
    ...record,
    parent: record.parent || null,
  };
};

const handleSupabaseError = (error, context = "Supabase operation") => {
  console.error(`${context} error:`, error);
  return {
    success: false,
    error: error?.message || "Unexpected Supabase error",
  };
};

const sanitizeEmail = (email) =>
  typeof email === "string" ? email.trim().toLowerCase() : undefined;

const safeString = (value) =>
  typeof value === "string" ? value.trim() : undefined;

exports.getSettings = async (_req, res) => {
  try {
    const settings = await SystemSettingsService.getSettings();
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, "getSettings"));
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const updated = await SystemSettingsService.updateSettings(req.body || {});
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, "updateSettings"));
  }
};

// Admin Dashboard - Show Statistics
exports.dashboard = async (req, res) => {
  try {
    const [userCount, caregiverCount, recentUsers] = await Promise.all([
      UserService.countByRole("parent"),
      UserService.countByRole("caregiver"),
      UserService.getRecentUsers(5),
    ]);

    res.status(200).json({
      success: true,
      data: {
        userCount,
        caregiverCount,
        recentUsers: (recentUsers || []).map(normalizeUser),
      },
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, "dashboard"));
  }
};

const applyJobStatusChange = async ({
  jobId,
  adminId,
  targetStatus,
  auditAction,
  reason,
  allowedCurrentStatuses,
  errorHint,
}) => {
  const job = await JobService.findById(jobId);
  if (!job) {
    return { error: "Job not found", statusCode: 404 };
  }

  if (allowedCurrentStatuses && !allowedCurrentStatuses.includes(job.status)) {
    return {
      error:
        errorHint ||
        `Cannot transition job from ${job.status} to ${targetStatus}`,
      statusCode: 400,
    };
  }

  const updatedJob = await JobService.updateStatus(jobId, targetStatus);

  await auditService.logAction({
    userId: adminId,
    action: auditAction,
    entity: "JOB",
    entityId: jobId,
    metadata: {
      from: job.status,
      to: targetStatus,
      reason: reason ?? null,
    },
  });

  return { job: normalizeJob(updatedJob) };
};

const applyBookingStatusChange = async ({
  bookingId,
  adminId,
  targetStatus,
  auditAction,
  reason,
  allowedCurrentStatuses,
  errorHint,
}) => {
  const booking = await BookingService.findById(bookingId);
  if (!booking) {
    return { error: "Booking not found", statusCode: 404 };
  }

  if (
    allowedCurrentStatuses &&
    !allowedCurrentStatuses.includes(booking.status)
  ) {
    return {
      error:
        errorHint ||
        `Cannot transition booking from ${booking.status} to ${targetStatus}`,
      statusCode: 400,
    };
  }

  const updatedBooking = await BookingService.updateStatus(
    bookingId,
    targetStatus,
  );

  await auditService.logAction({
    userId: adminId,
    action: auditAction,
    entity: "BOOKING",
    entityId: bookingId,
    metadata: {
      from: booking.status,
      to: targetStatus,
      reason: reason ?? null,
    },
  });

  return { booking: normalizeBooking(updatedBooking) };
};

exports.approveJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { reason } = req.body || {};
    const adminId = req.user.id;

    const result = await applyJobStatusChange({
      jobId,
      adminId,
      targetStatus: "confirmed",
      auditAction: "APPROVE_JOB",
      reason,
      allowedCurrentStatuses: ["pending", "open", "active"],
      errorHint: "Only pending or open jobs can be approved",
    });

    if (result.error) {
      return res
        .status(result.statusCode)
        .json({ success: false, error: result.error });
    }

    return res.status(200).json({
      success: true,
      data: result.job,
      message: "Job approved successfully",
    });
  } catch (error) {
    return res.status(500).json(handleSupabaseError(error, "approveJob"));
  }
};

exports.rejectJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { reason } = req.body || {};
    const adminId = req.user.id;

    const result = await applyJobStatusChange({
      jobId,
      adminId,
      targetStatus: "cancelled",
      auditAction: "REJECT_JOB",
      reason,
      allowedCurrentStatuses: ["pending", "open", "active"],
      errorHint: "Only pending or open jobs can be rejected",
    });

    if (result.error) {
      return res
        .status(result.statusCode)
        .json({ success: false, error: result.error });
    }

    return res.status(200).json({
      success: true,
      data: result.job,
      message: "Job rejected successfully",
    });
  } catch (error) {
    return res.status(500).json(handleSupabaseError(error, "rejectJob"));
  }
};

exports.cancelJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { reason } = req.body || {};
    const adminId = req.user.id;

    const result = await applyJobStatusChange({
      jobId,
      adminId,
      targetStatus: "cancelled",
      auditAction: "CANCEL_JOB",
      reason,
      allowedCurrentStatuses: ["open", "confirmed", "pending", "active"],
      errorHint: "Only active jobs can be cancelled",
    });

    if (result.error) {
      return res
        .status(result.statusCode)
        .json({ success: false, error: result.error });
    }

    return res.status(200).json({
      success: true,
      data: result.job,
      message: "Job cancelled successfully",
    });
  } catch (error) {
    return res.status(500).json(handleSupabaseError(error, "cancelJob"));
  }
};

exports.completeJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const adminId = req.user.id;

    const result = await applyJobStatusChange({
      jobId,
      adminId,
      targetStatus: "completed",
      auditAction: "COMPLETE_JOB",
      allowedCurrentStatuses: ["confirmed", "open", "active"],
    });

    if (result.error) {
      return res
        .status(result.statusCode)
        .json({ success: false, error: result.error });
    }

    return res.status(200).json({
      success: true,
      data: result.job,
      message: "Job marked as completed",
    });
  } catch (error) {
    return res.status(500).json(handleSupabaseError(error, "completeJob"));
  }
};

exports.reopenJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const adminId = req.user.id;

    const result = await applyJobStatusChange({
      jobId,
      adminId,
      targetStatus: "open",
      auditAction: "REOPEN_JOB",
      allowedCurrentStatuses: ["cancelled", "completed", "inactive"],
    });

    if (result.error) {
      return res
        .status(result.statusCode)
        .json({ success: false, error: result.error });
    }

    return res.status(200).json({
      success: true,
      data: result.job,
      message: "Job reopened successfully",
    });
  } catch (error) {
    return res.status(500).json(handleSupabaseError(error, "reopenJob"));
  }
};

// List All Users (with pagination and search)
exports.listUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, userType, search } = req.query;
    const [listResult, counts] = await Promise.all([
      UserService.getUsers({
        page: Number(page),
        limit: Number(limit),
        role: userType,
        search,
        includeProfile: true,
      }),
      UserService.getUserCounts({ role: userType, search }),
    ]);

    const { users, total } = listResult;

    res.status(200).json({
      success: true,
      count: total,
      totalPages: Math.ceil((total || 0) / Number(limit) || 1),
      currentPage: Number(page),
      data: (users || []).map(normalizeUser),
      stats: counts,
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, "listUsers"));
  }
};

// Create User
exports.createUser = async (req, res) => {
  try {
    const adminId = req.user.id;
    const {
      email,
      password,
      role = "parent",
      name,
      phone,
      status = "active",
    } = req.body || {};

    if (!email) {
      return res
        .status(400)
        .json({ success: false, error: "Email is required" });
    }

    const normalizedEmail = sanitizeEmail(email);
    const normalizedName = safeString(name);

    const authUser = await AuthAdminService.createUser({
      email: normalizedEmail,
      password,
      role,
      name: normalizedName,
      phone: safeString(phone),
      userMetadata: {
        createdBy: adminId,
      },
    });

    const dbUser = await UserService.create({
      id: authUser.id,
      email: normalizedEmail,
      name: normalizedName,
      role,
      phone: safeString(phone),
      status,
      created_by: adminId,
    });

    await AuditLogService.create({
      admin_id: adminId,
      action: "CREATE_USER",
      target_id: dbUser.id,
      metadata: {
        role,
        status,
      },
    });

    res.status(201).json({
      success: true,
      data: normalizeUser(dbUser),
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, "createUser"));
  }
};

// Get Single User by ID
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await UserService.findDetailedById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: normalizeUser(user),
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, "getUserById"));
  }
};

// Update User Status
exports.updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, reason } = req.body;
    const adminId = req.user.id;

    const validStatuses = ["active", "suspended", "banned"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status value. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const user = await UserService.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    if (user.role === "admin" && req.user.role !== "superadmin") {
      return res.status(403).json({
        success: false,
        error: "Cannot modify admin accounts",
      });
    }

    const updatedUser = await UserService.updateStatus(userId, status, {
      reason,
      adminId,
    });

    await UserStatusHistoryService.logChange({
      userId,
      status,
      reason,
      changedBy: adminId,
    });

    await AuditLogService.create({
      admin_id: adminId,
      action: "UPDATE_USER_STATUS",
      target_id: userId,
      metadata: {
        from: user.status,
        to: status,
        reason,
      },
    });

    // Send email notification
    try {
      await sendStatusEmail({
        email: user.email,
        name: user.name,
        status: status,
        reason: reason,
      });
    } catch (emailError) {
      console.error("Failed to send status email:", emailError);
      // Don't fail the request if email fails
    }

    res.status(200).json({
      success: true,
      data: normalizeUser(updatedUser),
      message: `User status updated to ${status}`,
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, "updateUserStatus"));
  }
};

// Bulk update user statuses
exports.bulkUpdateUserStatus = async (req, res) => {
  try {
    const { userIds, status, reason } = req.body || {};
    const adminId = req.user.id;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "userIds array is required" });
    }

    const validStatuses = ["active", "suspended", "banned"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status value. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const results = [];
    for (const id of userIds) {
      try {
        const user = await UserService.findById(id);
        if (!user) continue;

        if (user.role === "admin" && req.user.role !== "superadmin") {
          continue;
        }

        const updated = await UserService.updateStatus(id, status, {
          reason,
          adminId,
        });
        await UserStatusHistoryService.logChange({
          userId: id,
          status,
          reason,
          changedBy: adminId,
        });

        await AuditLogService.create({
          admin_id: adminId,
          action: "BULK_UPDATE_USER_STATUS",
          target_id: id,
          metadata: {
            to: status,
            reason,
          },
        });

        results.push(normalizeUser(updated));
      } catch (itemError) {
        console.error("Bulk status update error for user", id, itemError);
      }
    }

    res.status(200).json({
      success: true,
      data: results,
      message: `Bulk status update processed for ${results.length} users`,
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, "bulkUpdateUserStatus"));
  }
};

// Update User profile details
exports.updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.user.id;
    const { email, password, role, name, phone, status } = req.body || {};

    const user = await UserService.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    if (user.role === "admin" && req.user.role !== "superadmin") {
      return res
        .status(403)
        .json({ success: false, error: "Cannot modify admin accounts" });
    }

    if (email || password || role || phone || name) {
      await AuthAdminService.updateUser(userId, {
        email: sanitizeEmail(email) ?? undefined,
        password,
        role,
        phone: safeString(phone),
        name: safeString(name),
      });
    }

    const updates = {
      ...(email ? { email: sanitizeEmail(email) } : {}),
      ...(name ? { name: safeString(name) } : {}),
      ...(role ? { role } : {}),
      ...(phone ? { phone: safeString(phone) } : {}),
      ...(typeof status === "string" ? { status } : {}),
    };

    let updatedUser = user;
    if (Object.keys(updates).length > 0) {
      updatedUser = await UserService.update(userId, updates);
    }

    if (status && status !== user.status) {
      await UserStatusHistoryService.logChange({
        userId,
        status,
        reason: req.body?.reason,
        changedBy: adminId,
      });
    }

    await AuditLogService.create({
      admin_id: adminId,
      action: "UPDATE_USER",
      target_id: userId,
      metadata: {
        changes: Object.keys(updates),
      },
    });

    res.status(200).json({
      success: true,
      data: normalizeUser(updatedUser),
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, "updateUser"));
  }
};

// Verify Caregiver Documents
exports.verifyProviderDocuments = async (req, res) => {
  try {
    const { userId } = req.params;
    const { verificationStatus, notes } = req.body;
    const adminId = req.user.id;

    const validStatuses = ["pending", "verified", "rejected"];
    if (!validStatuses.includes(verificationStatus)) {
      return res.status(400).json({
        success: false,
        error: `Invalid verification status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const profile = await CaregiverProfileService.getByUserId(userId);
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: "Caregiver not found",
      });
    }

    const updatedProfile = await CaregiverProfileService.updateVerification(
      userId,
      {
        status: verificationStatus,
        verifiedBy: adminId,
        verifiedAt: new Date().toISOString(),
        notes,
      },
    );

    if (verificationStatus === "verified") {
      await CaregiverProfileService.update(userId, { is_active: true });
    }

    await AuditLogService.create({
      admin_id: adminId,
      action: "VERIFY_PROVIDER_DOCUMENTS",
      target_id: userId,
      metadata: {
        status: verificationStatus,
        notes,
      },
    });

    res.status(200).json({
      success: true,
      data: updatedProfile,
      message: `Documents ${verificationStatus} successfully`,
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, "verifyProviderDocuments"));
  }
};

// Delete User (Soft Delete)
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.user.id;

    const user = await UserService.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    if (user.role === "admin" && req.user.role !== "superadmin") {
      return res.status(403).json({
        success: false,
        error: "Cannot delete admin accounts",
      });
    }

    const deletedUser = await UserService.softDelete(userId, {
      deletedBy: adminId,
      reason: "Account deleted by administrator",
    });

    try {
      await AuthAdminService.deleteUser(userId);
    } catch (authError) {
      console.error(
        "Auth user delete failed, proceeding with soft delete",
        authError,
      );
    }

    await UserStatusHistoryService.logChange({
      userId,
      status: "inactive",
      reason: "Account deleted by administrator",
      changedBy: adminId,
    });

    await AuditLogService.create({
      admin_id: adminId,
      action: "DELETE_USER",
      target_id: userId,
      metadata: {
        email: user.email,
        role: user.role,
      },
    });

    res.status(200).json({
      success: true,
      data: normalizeUser(deletedUser),
      message: "User deleted successfully",
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, "deleteUser"));
  }
};

// Function verification (for development/testing)
const functionChecks = {
  dashboard: typeof exports.dashboard,
  listUsers: typeof exports.listUsers,
  getUserById: typeof exports.getUserById,
  updateUserStatus: typeof exports.updateUserStatus,
  verifyProviderDocuments: typeof exports.verifyProviderDocuments,
  deleteUser: typeof exports.deleteUser,
  listBookings: typeof exports.listBookings,
  getBookingById: typeof exports.getBookingById,
  updateBookingStatus: typeof exports.updateBookingStatus,
  confirmBooking: typeof exports.confirmBooking,
  startBooking: typeof exports.startBooking,
  completeBooking: typeof exports.completeBooking,
  cancelBooking: typeof exports.cancelBooking,
  listJobs: typeof exports.listJobs,
  getJobById: typeof exports.getJobById,
  updateJobStatus: typeof exports.updateJobStatus,
  listAuditLogs: typeof exports.listAuditLogs,
};

exports.listBookings = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const { bookings, total } = await BookingService.getBookings({
      page: Number(page),
      limit: Number(limit),
      status,
      search,
    });

    res.status(200).json({
      success: true,
      count: total,
      totalPages: Math.ceil((total || 0) / Number(limit) || 1),
      currentPage: Number(page),
      data: (bookings || []).map(normalizeBooking),
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, "listBookings"));
  }
};

exports.getBookingById = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await BookingService.findById(id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: "Booking not found",
      });
    }

    res.status(200).json({
      success: true,
      data: normalizeBooking(booking),
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, "getBookingById"));
  }
};

exports.updateBookingStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status, reason } = req.body || {};
    const adminId = req.user.id;

    const validStatuses = [
      "pending",
      "confirmed",
      "in_progress",
      "completed",
      "cancelled",
      "no_show",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status value. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const result = await applyBookingStatusChange({
      bookingId,
      adminId,
      targetStatus: status,
      auditAction: "UPDATE_BOOKING_STATUS",
      reason,
    });

    if (result.error) {
      return res
        .status(result.statusCode)
        .json({ success: false, error: result.error });
    }

    res.status(200).json({
      success: true,
      data: result.booking,
      message: `Booking status updated to ${status}`,
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, "updateBookingStatus"));
  }
};

exports.confirmBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { reason } = req.body || {};
    const adminId = req.user.id;

    const result = await applyBookingStatusChange({
      bookingId,
      adminId,
      targetStatus: "confirmed",
      auditAction: "CONFIRM_BOOKING",
      reason,
      allowedCurrentStatuses: ["pending"],
      errorHint: "Only pending bookings can be confirmed",
    });

    if (result.error) {
      return res
        .status(result.statusCode)
        .json({ success: false, error: result.error });
    }

    return res.status(200).json({
      success: true,
      data: result.booking,
      message: "Booking confirmed successfully",
    });
  } catch (error) {
    return res.status(500).json(handleSupabaseError(error, "confirmBooking"));
  }
};

exports.startBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const adminId = req.user.id;

    const result = await applyBookingStatusChange({
      bookingId,
      adminId,
      targetStatus: "in_progress",
      auditAction: "START_BOOKING",
      allowedCurrentStatuses: ["confirmed"],
    });

    if (result.error) {
      return res
        .status(result.statusCode)
        .json({ success: false, error: result.error });
    }

    return res.status(200).json({
      success: true,
      data: result.booking,
      message: "Booking marked as in progress",
    });
  } catch (error) {
    return res.status(500).json(handleSupabaseError(error, "startBooking"));
  }
};

exports.completeBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const adminId = req.user.id;

    const result = await applyBookingStatusChange({
      bookingId,
      adminId,
      targetStatus: "completed",
      auditAction: "COMPLETE_BOOKING",
      allowedCurrentStatuses: ["in_progress", "confirmed"],
    });

    if (result.error) {
      return res
        .status(result.statusCode)
        .json({ success: false, error: result.error });
    }

    return res.status(200).json({
      success: true,
      data: result.booking,
      message: "Booking marked as completed",
    });
  } catch (error) {
    return res.status(500).json(handleSupabaseError(error, "completeBooking"));
  }
};

exports.cancelBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { reason } = req.body || {};
    const adminId = req.user.id;

    const result = await applyBookingStatusChange({
      bookingId,
      adminId,
      targetStatus: "cancelled",
      auditAction: "CANCEL_BOOKING",
      reason,
      allowedCurrentStatuses: [
        "pending",
        "confirmed",
        "in_progress",
      ],
      errorHint: "Only active bookings can be cancelled",
    });

    if (result.error) {
      return res
        .status(result.statusCode)
        .json({ success: false, error: result.error });
    }

    return res.status(200).json({
      success: true,
      data: result.booking,
      message: "Booking cancelled successfully",
    });
  } catch (error) {
    return res.status(500).json(handleSupabaseError(error, "cancelBooking"));
  }
};

exports.listJobs = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const { jobs, total } = await JobService.getJobs({
      page: Number(page),
      limit: Number(limit),
      status,
      search,
    });

    res.status(200).json({
      success: true,
      count: total,
      totalPages: Math.ceil((total || 0) / Number(limit) || 1),
      currentPage: Number(page),
      data: (jobs || []).map(normalizeJob),
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, "listJobs"));
  }
};

exports.getJobById = async (req, res) => {
  try {
    const { id } = req.params;
    const job = await JobService.findById(id);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Job not found",
      });
    }

    res.status(200).json({
      success: true,
      data: normalizeJob(job),
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, "getJobById"));
  }
};

exports.updateJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { status } = req.body;
    const adminId = req.user.id;

    const validStatuses = [
      "open",
      "pending",
      "confirmed",
      "completed",
      "cancelled",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status value. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const job = await JobService.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Job not found",
      });
    }

    const updatedJob = await JobService.updateStatus(jobId, status);

    await AuditLogService.create({
      admin_id: adminId,
      action: "UPDATE_JOB_STATUS",
      target_id: jobId,
      metadata: {
        from: job.status,
        to: status,
      },
    });

    res.status(200).json({
      success: true,
      data: normalizeJob(updatedJob),
      message: `Job status updated to ${status}`,
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, "updateJobStatus"));
  }
};

exports.listAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 20, action, targetId, adminId } = req.query;
    const { logs, total } = await AuditLogService.getLogs({
      page: Number(page),
      limit: Number(limit),
      action,
      targetId,
      adminId,
    });

    res.status(200).json({
      success: true,
      count: total,
      totalPages: Math.ceil((total || 0) / Number(limit) || 1),
      currentPage: Number(page),
      data: logs || [],
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, "listAuditLogs"));
  }
};
