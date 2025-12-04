const { ReportService } = require("../services/reportService");
const { AuditLogService } = require("../services/supabaseService");
const ErrorResponse = require("../utils/errorResponse");

// Create a new report
exports.createReport = async (req, res, next) => {
  try {
    const {
      reported_user_id,
      report_type,
      category,
      title,
      description,
      severity = "medium",
      evidence_urls = [],
      booking_id,
      job_id,
    } = req.body;

    if (!reported_user_id || !report_type || !title || !description) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: reported_user_id, report_type, title, description",
      });
    }

    const reportData = {
      reporter_id: req.user.id,
      reported_user_id,
      report_type,
      category,
      title,
      description,
      severity,
      evidence_urls,
      booking_id,
      job_id,
      status: "pending",
    };

    const report = await ReportService.create(reportData);

    // Log the action
    await AuditLogService.create({
      admin_id: req.user.id,
      action: "report_created",
      target_type: "report",
      target_id: report.id,
      metadata: { report_type, severity, reported_user_id },
    });

    res.status(201).json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error("Create report error:", error);
    next(new ErrorResponse("Failed to create report", 500));
  }
};

// Get all reports (admin only)
exports.getReports = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      reportType,
      severity,
      search,
    } = req.query;

    const result = await ReportService.getReports({
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      reportType,
      severity,
      search,
    });

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Get reports error:", error);
    next(new ErrorResponse("Failed to fetch reports", 500));
  }
};

// Get single report details
exports.getReportById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const report = await ReportService.findById(id);

    if (!report) {
      return next(new ErrorResponse("Report not found", 404));
    }

    // Check if user has permission to view
    if (
      req.user.role !== "admin" &&
      req.user.role !== "superadmin" &&
      report.reporter_id !== req.user.id
    ) {
      return next(new ErrorResponse("Not authorized to view this report", 403));
    }

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error("Get report error:", error);
    next(new ErrorResponse("Failed to fetch report", 500));
  }
};

// Update report status (admin only)
exports.updateReportStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, adminNotes, resolution } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: "Status is required",
      });
    }

    const validStatuses = ["pending", "under_review", "resolved", "dismissed"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const report = await ReportService.updateStatus(id, status, {
      adminNotes,
      reviewedBy: req.user.id,
      resolution,
    });

    // Log the action
    await AuditLogService.create({
      admin_id: req.user.id,
      action: "report_status_updated",
      target_type: "report",
      target_id: id,
      metadata: { from: report.status, to: status, resolution },
    });

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error("Update report status error:", error);
    next(new ErrorResponse("Failed to update report status", 500));
  }
};

// Get report statistics (admin only)
exports.getReportStats = async (req, res, next) => {
  try {
    const stats = await ReportService.getReportStats();

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Get report stats error:", error);
    next(new ErrorResponse("Failed to fetch report statistics", 500));
  }
};

// Get user's own reports
exports.getMyReports = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const result = await ReportService.getReports({
      page: parseInt(page),
      limit: parseInt(limit),
      reporterId: req.user.id,
    });

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Get my reports error:", error);
    next(new ErrorResponse("Failed to fetch your reports", 500));
  }
};
