const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
// const adminChildrenController = require("../controllers/adminChildrenController"); // Temporarily disabled
const { authenticate, authorize } = require("../middleware/auth");

// Helper function to check if we're in development bypass mode
const isDevBypass = (req) => {
  return (
    process.env.ALLOW_DEV_BYPASS === "true" &&
    req.header("X-Dev-Bypass") === "1"
  );
};

// Admin routes with conditional authorization for development
router.use((req, res, next) => {
  // In development bypass mode, skip strict authorization
  if (isDevBypass(req)) {
    // Set admin role for development bypass
    req.user = req.user || {};
    req.user.role = "admin";
    return next();
  }

  // In production, use full authentication and authorization
  authenticate(req, res, (err) => {
    if (err) return next(err);
    authorize(["admin", "superadmin"])(req, res, next);
  });
});

// Dashboard route
router.get("/dashboard", adminController.dashboard);

// System settings
router.get("/settings", adminController.getSettings);
router.patch("/settings", adminController.updateSettings);

// Users management
router.get("/users", adminController.listUsers);
router.post("/users", adminController.createUser);
router.get("/users/:id", adminController.getUserById);
router.put("/users/:userId", adminController.updateUser);
router.patch("/users/:userId/status", adminController.updateUserStatus);
router.post("/users/bulk/status", adminController.bulkUpdateUserStatus);
router.delete("/users/:userId", adminController.deleteUser);

// Bookings management
router.get("/bookings", adminController.listBookings);
router.get("/bookings/:id", adminController.getBookingById);
router.patch(
  "/bookings/:bookingId/status",
  adminController.updateBookingStatus,
);
router.post("/bookings/:bookingId/confirm", adminController.confirmBooking);
router.post("/bookings/:bookingId/start", adminController.startBooking);
router.post("/bookings/:bookingId/complete", adminController.completeBooking);
router.post("/bookings/:bookingId/cancel", adminController.cancelBooking);

// Payments management
router.get("/payments", adminController.listPayments);
router.get("/payments/:id", adminController.getPaymentById);
router.patch(
  "/payments/:paymentId/status",
  adminController.updatePaymentStatus,
);
router.post(
  "/payments/:paymentId/refund",
  adminController.refundPayment,
);

// Jobs management
router.get("/jobs", adminController.listJobs);
router.post("/jobs", adminController.createJob);
router.get("/jobs/:id", adminController.getJobById);
router.put("/jobs/:jobId", adminController.updateJob);
router.patch("/jobs/:jobId/status", adminController.updateJobStatus);
router.post("/jobs/:jobId/approve", adminController.approveJob);
router.post("/jobs/:jobId/reject", adminController.rejectJob);
router.post("/jobs/:jobId/cancel", adminController.cancelJob);
router.post("/jobs/:jobId/complete", adminController.completeJob);
router.post("/jobs/:jobId/reopen", adminController.reopenJob);
router.delete("/jobs/:jobId", adminController.deleteJob);

// Audit logs
router.get("/audit", adminController.listAuditLogs);

// Children management (temporarily disabled)
// router.get("/children", adminChildrenController.listChildren);
// router.get("/children/:id", adminChildrenController.getChildById);
// router.patch("/children/:id", adminChildrenController.updateChild);
// router.delete("/children/:id", adminChildrenController.deleteChild);

module.exports = router;
