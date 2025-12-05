const {
  UserService,
  JobService,
  BookingService,
  PaymentService,
  PaymentProofService,
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

const computeTotalHours = (record) => {
  if (!record) return 0;

  const directHours =
    (typeof record.totalHours === "number" ? record.totalHours : undefined) ??
    (typeof record.total_hours === "number" ? record.total_hours : undefined);

  if (
    typeof directHours === "number" &&
    !Number.isNaN(directHours) &&
    directHours > 0
  ) {
    return directHours;
  }

  const startTime = record.start_time || record.startTime;
  const endTime = record.end_time || record.endTime;

  if (typeof startTime === "string" && typeof endTime === "string") {
    const [startHour = "0", startMinute = "0"] = startTime.split(":");
    const [endHour = "0", endMinute = "0"] = endTime.split(":");

    const startDate = new Date(0, 0, 0, Number(startHour), Number(startMinute));
    const endDate = new Date(0, 0, 0, Number(endHour), Number(endMinute));

    const diffMs = endDate.getTime() - startDate.getTime();
    if (diffMs > 0) {
      return Number((diffMs / (1000 * 60 * 60)).toFixed(2));
    }
  }

  return 0;
};

const normalizeBooking = (record) => {
  if (!record) return null;
  const totalHours = computeTotalHours(record);
  return {
    ...record,
    parent: record.parent || null,
    caregiver: record.caregiver || null,
    job: record.job || null,
    totalHours,
    total_hours: record.total_hours ?? totalHours,
  };
};

const normalizeJob = (record) => {
  if (!record) return null;

  // Debug: Log what we're getting from the database
  console.log("[normalizeJob] Raw record:", {
    id: record.id,
    title: record.title,
    parent: record.parent,
    parent_id: record.parent_id,
    caregiver: record.caregiver,
    caregiver_id: record.caregiver_id,
  });

  // Handle parent information from the join
  let parentInfo = null;
  if (record.parent) {
    // This comes from the parent:parent_id(id, name, email) join
    parentInfo = Array.isArray(record.parent)
      ? record.parent[0]
      : record.parent;
  }

  // Handle caregiver information from the join
  let caregiverInfo = null;
  if (record.caregiver) {
    // This comes from the caregiver:caregiver_id(id, name, email) join
    caregiverInfo = Array.isArray(record.caregiver)
      ? record.caregiver[0]
      : record.caregiver;
  }

  return {
    ...record,
    parent: parentInfo || null,
    caregiver: caregiverInfo || null,
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

const safeString = (str) => (typeof str === "string" ? str.trim() : undefined);

const trimToString = (value) => (typeof value === "string" ? value.trim() : "");

const PAYMENT_STATUS_VALUES = ["pending", "paid", "disputed", "refunded"];

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

  await AuditLogService.create({
    admin_id: adminId,
    action: auditAction,
    target_id: jobId,
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

  await AuditLogService.create({
    admin_id: adminId,
    action: auditAction,
    target_id: bookingId,
    metadata: {
      from: booking.status,
      to: targetStatus,
      reason: reason ?? null,
    },
  });

  return { booking: normalizeBooking(updatedBooking) };
};

const summarizeProofWarnings = (payment) => {
  if (!payment) return null;
  if (payment.proofStatus !== "needs_review") {
    return null;
  }
  const uniqueIssues = Array.from(new Set(payment.proofIssues || []));
  return uniqueIssues.length ? uniqueIssues : null;
};

const ensureNoteProvided = (note, label = "note") => {
  const trimmed = trimToString(note);
  if (!trimmed) {
    return {
      error: `${label} is required and cannot be empty`,
      statusCode: 400,
    };
  }
  return { value: trimmed };
};

// Payments management functions
exports.listPayments = async (req, res) => {
  try {
    const { page = 1, limit = 25, status, search } = req.query;
    const result = await PaymentService.list({
      page: Number(page),
      limit: Number(limit),
      status,
      search,
    });

    const suspiciousCount = result.payments.filter(
      (payment) => payment.proofStatus === "needs_review",
    ).length;

    res.status(200).json({
      success: true,
      data: result.payments,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.max(1, Math.ceil((result.total || 0) / result.limit)),
      },
      proofSummary: {
        suspiciousCount,
      },
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, "listPayments"));
  }
};

exports.getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await PaymentService.findById(id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: "Payment not found",
      });
    }

    const warnings = summarizeProofWarnings(payment);

    res.status(200).json({
      success: true,
      data: payment,
      warnings: warnings || undefined,
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, "getPaymentById"));
  }
};

exports.updatePaymentStatus = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const adminId = req.user.id;
    const { status, notes } = req.body || {};

    const normalizedStatus = trimToString(status).toLowerCase();
    if (!PAYMENT_STATUS_VALUES.includes(normalizedStatus)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status value. Must be one of: ${PAYMENT_STATUS_VALUES.join(", ")}`,
      });
    }

    const existing = await PaymentService.findById(paymentId);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: "Payment not found",
      });
    }

    if (existing.paymentStatus === normalizedStatus) {
      return res.status(200).json({
        success: true,
        data: existing,
        message: "Payment status unchanged",
      });
    }

    if (["paid"].includes(normalizedStatus)) {
      const validation = ensureNoteProvided(notes, "notes");
      if (validation.error) {
        return res.status(validation.statusCode).json({
          success: false,
          error: validation.error,
        });
      }
    }

    const updated = await PaymentService.updateStatus(
      paymentId,
      normalizedStatus,
      {
        notes: trimToString(notes) || null,
      },
    );

    await AuditLogService.create({
      admin_id: adminId,
      action: "UPDATE_PAYMENT_STATUS",
      target_id: paymentId,
      metadata: {
        from: existing.paymentStatus,
        to: normalizedStatus,
        notes: trimToString(notes) || null,
        proofStatus: updated.proofStatus,
        proofIssues: updated.proofIssues,
      },
    });

    const warnings = summarizeProofWarnings(updated);

    res.status(200).json({
      success: true,
      data: updated,
      message: `Payment status updated to ${normalizedStatus}`,
      warnings: warnings || undefined,
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, "updatePaymentStatus"));
  }
};

exports.refundPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const adminId = req.user.id;
    const { reason } = req.body || {};

    const existing = await PaymentService.findById(paymentId);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: "Payment not found",
      });
    }

    if (existing.paymentStatus === "refunded") {
      return res.status(400).json({
        success: false,
        error: "Payment is already refunded",
      });
    }

    const validation = ensureNoteProvided(reason, "reason");
    if (validation.error) {
      return res.status(validation.statusCode).json({
        success: false,
        error: validation.error,
      });
    }

    const updated = await PaymentService.refund(paymentId, validation.value);

    await AuditLogService.create({
      admin_id: adminId,
      action: "REFUND_PAYMENT",
      target_id: paymentId,
      metadata: {
        from: existing.paymentStatus,
        to: updated.paymentStatus,
        reason: validation.value,
        proofStatus: updated.proofStatus,
        proofIssues: updated.proofIssues,
      },
    });

    const warnings = summarizeProofWarnings(updated);

    res.status(200).json({
      success: true,
      data: updated,
      message: "Payment refunded successfully",
      warnings: warnings || undefined,
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, "refundPayment"));
  }
};

// Jobs management functions
exports.listJobs = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const result = await JobService.getJobs({
      page: Number(page),
      limit: Number(limit),
      status,
      search,
    });

    res.status(200).json({
      success: true,
      data: result.jobs.map(normalizeJob),
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        hasMore: result.page * result.limit < result.total,
      },
      stats: result.stats,
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, "listJobs"));
  }
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
    const { status, reason, durationDays } = req.body;
    const adminId = req.user.id;

    const validStatuses = ["active", "suspended", "banned", "inactive"];
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

    // Calculate suspension end date if suspending
    let suspensionEndDate = null;
    let updates = { reason, adminId };
    
    if (status === "suspended") {
      const days = durationDays || 7; // Default 7 days
      suspensionEndDate = new Date();
      suspensionEndDate.setDate(suspensionEndDate.getDate() + days);
      
      updates.suspension_end_date = suspensionEndDate.toISOString();
      updates.suspension_count = (user.suspension_count || 0) + 1;
      updates.last_suspension_at = new Date().toISOString();
    } else if (status === "active") {
      // Clear suspension data when reactivating
      updates.suspension_end_date = null;
    }

    const updatedUser = await UserService.updateStatus(userId, status, updates);

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
        durationDays: durationDays || null,
        suspensionEndDate: suspensionEndDate?.toISOString() || null,
        suspensionCount: updates.suspension_count || null,
      },
    });

    // Send email notification
    try {
      await sendStatusEmail({
        email: user.email,
        name: user.name,
        status: status,
        reason: reason,
        suspensionEndDate: suspensionEndDate,
        suspensionCount: updates.suspension_count,
      });
    } catch (emailError) {
      console.error("Failed to send status email:", emailError);
      // Don't fail the request if email fails
    }

    res.status(200).json({
      success: true,
      data: normalizeUser(updatedUser),
      message: `User status updated to ${status}`,
      suspensionEndDate: suspensionEndDate?.toISOString() || null,
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
      data: updatedProfile,
      message: `Documents ${verificationStatus} successfully`,
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, "verifyProviderDocuments"));
  }
};

// Jobs management functions
exports.listJobs = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const result = await JobService.getJobs({
      page: Number(page),
      limit: Number(limit),
      status,
      search,
    });

    res.status(200).json({
      success: true,
      data: result.jobs.map(normalizeJob),
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        hasMore: result.page * result.limit < result.total,
      },
      stats: result.stats,
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, "listJobs"));
  }
};

exports.createJob = async (req, res) => {
  try {
    const {
      title,
      description,
      location,
      budget,
      hourly_rate,
      parent_id,
      caregiver_id,
    } = req.body || {};
    const adminId = req.user.id;

    if (!title || !description || !location) {
      return res.status(400).json({
        success: false,
        error: "Title, description, and location are required",
      });
    }

    const jobData = {
      title,
      description,
      location,
      budget: budget || null,
      hourly_rate: hourly_rate || null,
      parent_id: parent_id || null,
      caregiver_id: caregiver_id || null,
      status: "open",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const createdJob = await JobService.create(jobData);

    await AuditLogService.create({
      admin_id: adminId,
      action: "CREATE_JOB",
      target_id: createdJob.id,
      metadata: {
        title,
        location,
      },
    });

    res.status(201).json({
      success: true,
      data: normalizeJob(createdJob),
      message: "Job created successfully",
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, "createJob"));
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

exports.updateJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const {
      title,
      description,
      location,
      budget,
      hourly_rate,
      parent_id,
      caregiver_id,
    } = req.body || {};
    const adminId = req.user.id;

    const job = await JobService.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Job not found",
      });
    }

    const updates = {
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      ...(location ? { location } : {}),
      ...(typeof budget === "number" ? { budget } : {}),
      ...(typeof hourly_rate === "number" ? { hourly_rate } : {}),
      ...(parent_id ? { parent_id } : {}),
      ...(caregiver_id ? { caregiver_id } : {}),
      updated_at: new Date().toISOString(),
    };

    const updatedJob = await JobService.update(jobId, updates);

    await AuditLogService.create({
      admin_id: adminId,
      action: "UPDATE_JOB",
      target_id: jobId,
      metadata: {
        changes: Object.keys(updates),
      },
    });

    res.status(200).json({
      success: true,
      data: normalizeJob(updatedJob),
      message: "Job updated successfully",
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, "updateJob"));
  }
};

exports.updateJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { status } = req.body;
    const adminId = req.user.id;

    const job = await JobService.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Job not found",
      });
    }

    // Constrained by DB enum: active, filled, cancelled, completed
    const validStatuses = ["active", "filled", "cancelled", "completed"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status value. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const updatedJob = await JobService.updateStatus(jobId, status);

    await AuditLogService.create({
      admin_id: adminId,
      action: "UPDATE_JOB_STATUS",
      target_id: jobId,
      metadata: {
        status,
      },
    });

    res.status(200).json({
      success: true,
      data: normalizeJob(updatedJob),
      message: "Job status updated successfully",
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, "updateJobStatus"));
  }
};

exports.approveJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const adminId = req.user.id;

    const job = await JobService.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Job not found",
      });
    }

    const updatedJob = await JobService.approve(jobId);

    await AuditLogService.create({
      admin_id: adminId,
      action: "APPROVE_JOB",
      target_id: jobId,
      metadata: {
        status: "approved",
      },
    });

    res.status(200).json({
      success: true,
      data: normalizeJob(updatedJob),
      message: "Job approved successfully",
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, "approveJob"));
  }
};

exports.rejectJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;

    const job = await JobService.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Job not found",
      });
    }

    const updatedJob = await JobService.reject(jobId, reason);

    await AuditLogService.create({
      admin_id: adminId,
      action: "REJECT_JOB",
      target_id: jobId,
      metadata: {
        status: "rejected",
        reason,
      },
    });

    res.status(200).json({
      success: true,
      data: normalizeJob(updatedJob),
      message: "Job rejected successfully",
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, "rejectJob"));
  }
};

exports.cancelJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;

    const job = await JobService.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Job not found",
      });
    }

    const updatedJob = await JobService.cancel(jobId, reason);

    await AuditLogService.create({
      admin_id: adminId,
      action: "CANCEL_JOB",
      target_id: jobId,
      metadata: {
        status: "cancelled",
        reason,
      },
    });

    res.status(200).json({
      success: true,
      data: normalizeJob(updatedJob),
      message: "Job cancelled successfully",
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, "cancelJob"));
  }
};

exports.completeJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const adminId = req.user.id;

    const job = await JobService.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Job not found",
      });
    }

    const updatedJob = await JobService.complete(jobId);

    await AuditLogService.create({
      admin_id: adminId,
      action: "COMPLETE_JOB",
      target_id: jobId,
      metadata: {
        status: "completed",
      },
    });

    res.status(200).json({
      success: true,
      data: normalizeJob(updatedJob),
      message: "Job completed successfully",
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, "completeJob"));
  }
};

exports.reopenJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const adminId = req.user.id;

    const job = await JobService.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Job not found",
      });
    }

    const updatedJob = await JobService.reopen(jobId);

    await AuditLogService.create({
      admin_id: adminId,
      action: "REOPEN_JOB",
      target_id: jobId,
      metadata: {
        status: "open",
      },
    });

    res.status(200).json({
      success: true,
      data: normalizeJob(updatedJob),
      message: "Job reopened successfully",
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, "reopenJob"));
  }
};

exports.deleteJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { reason } = req.query || {};
    const adminId = req.user.id;

    const job = await JobService.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Job not found",
      });
    }

    await JobService.delete(jobId);

    await AuditLogService.create({
      admin_id: adminId,
      action: "DELETE_JOB",
      target_id: jobId,
      metadata: {
        title: job.title,
        reason,
      },
    });

    res.status(200).json({
      success: true,
      message: "Job deleted successfully",
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, "deleteJob"));
  }
};

// Bookings management functions
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

// Delete User
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body || {};
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

    await UserService.delete(userId, { reason, deletedBy: adminId });

    await AuditLogService.create({
      admin_id: adminId,
      action: "DELETE_USER",
      target_id: userId,
      metadata: {
        email: user.email,
        role: user.role,
        reason,
      },
    });

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, "deleteUser"));
  }
};

// Audit logs
exports.listAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 20, action, search } = req.query;
    const result = await AuditLogService.getLogs({
      page: Number(page),
      limit: Number(limit),
      action,
      search,
    });

    res.status(200).json({
      success: true,
      data: result.logs,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        hasMore: result.page * result.limit < result.total,
      },
    });
  } catch (error) {
    res.status(500).json(handleSupabaseError(error, "listAuditLogs"));
  }
};

// Booking status change functions
exports.updateBookingStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status, reason } = req.body || {};
    const adminId = req.user.id;

    // Constrained by DB enum: pending, confirmed, completed, cancelled
    const validStatuses = ["pending", "confirmed", "completed", "cancelled"];
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

    // We no longer use a separate "in_progress" status at the DB level.
    // Treat "start" as a no-op for status (or keep as confirmed).
    const result = await applyBookingStatusChange({
      bookingId,
      adminId,
      targetStatus: "confirmed",
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
      // Only allow completing confirmed bookings
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
      // DB enum: pending, confirmed, completed, cancelled
      // Allow cancelling from pending or confirmed only
      allowedCurrentStatuses: ["pending", "confirmed"],
      errorHint: "Only pending or confirmed bookings can be cancelled",
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
  listPayments: typeof exports.listPayments,
  getPaymentById: typeof exports.getPaymentById,
  updatePaymentStatus: typeof exports.updatePaymentStatus,
  refundPayment: typeof exports.refundPayment,
  listJobs: typeof exports.listJobs,
  getJobById: typeof exports.getJobById,
  updateJobStatus: typeof exports.updateJobStatus,
  listAuditLogs: typeof exports.listAuditLogs,
};

module.exports = {
  // Dashboard
  dashboard: exports.dashboard,

  // Settings
  getSettings: exports.getSettings,
  updateSettings: exports.updateSettings,

  // Users
  listUsers: exports.listUsers,
  createUser: exports.createUser,
  getUserById: exports.getUserById,
  updateUser: exports.updateUser,
  updateUserStatus: exports.updateUserStatus,
  bulkUpdateUserStatus: exports.bulkUpdateUserStatus,
  deleteUser: exports.deleteUser,

  // Bookings
  listBookings: exports.listBookings,
  getBookingById: exports.getBookingById,
  updateBookingStatus: exports.updateBookingStatus,
  confirmBooking: exports.confirmBooking,
  startBooking: exports.startBooking,
  completeBooking: exports.completeBooking,
  cancelBooking: exports.cancelBooking,

  // Payments
  listPayments: exports.listPayments,
  getPaymentById: exports.getPaymentById,
  updatePaymentStatus: exports.updatePaymentStatus,
  refundPayment: exports.refundPayment,

  // Jobs
  listJobs: exports.listJobs,
  createJob: exports.createJob,
  getJobById: exports.getJobById,
  updateJob: exports.updateJob,
  updateJobStatus: exports.updateJobStatus,
  approveJob: exports.approveJob,
  rejectJob: exports.rejectJob,
  cancelJob: exports.cancelJob,
  completeJob: exports.completeJob,
  reopenJob: exports.reopenJob,
  deleteJob: exports.deleteJob,

  // Audit logs
  listAuditLogs: exports.listAuditLogs,
};
