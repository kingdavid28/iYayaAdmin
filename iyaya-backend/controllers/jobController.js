const Job = require("../models/Job");
const Application = require("../models/Application");
const User = require("../models/User");
const mongoose = require("mongoose");
const { validationResult } = require("express-validator");
const errorHandler = require("../utils/errorHandler");
const { logger } = require("../utils/logger");
let socketService = null;
try {
  socketService = require("../services/socketService");
} catch (error) {
  console.warn(
    "⚠️ Socket service not available, continuing without realtime updates:",
    error.message,
  );
}

// Get all jobs (public listing for caregivers)
exports.getAllJobs = async (req, res) => {
  try {
    const jobs = await Job.find({ status: "active" }).sort({ createdAt: -1 });

    console.log(
      `Returning ${jobs.length} available jobs for caregiver browsing`,
    );

    res.json({
      success: true,
      data: {
        jobs: jobs,
      },
    });
  } catch (error) {
    console.error("Error fetching jobs:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch jobs",
    });
  }
};

// Create a new job (parent)
exports.createJob = async (req, res) => {
  try {
    console.log("📋 Job creation request:", req.body);
    console.log("👤 User:", req.user);

    let user = null;
    let clientName = "Parent User";

    // Handle mock users vs real users
    if (req.user.mock) {
      console.log("🔧 Using mock user for job creation");
      clientName = "Mock Parent User";
    } else {
      user = await User.findById(req.user.id);
      if (!user) {
        console.log("❌ User not found in database:", req.user.id);
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }
      clientName = user.name || "Parent User";
    }

    // Parse working hours with fallback
    let startTime = "09:00";
    let endTime = "17:00";

    if (req.body.workingHours && typeof req.body.workingHours === "string") {
      const workingHours = req.body.workingHours.toLowerCase();

      // Try to extract time from common patterns
      if (workingHours.includes(" to ")) {
        const parts = workingHours.split(" to ");
        if (parts.length === 2) {
          // Try to parse time format (e.g., "9:00 AM to 5:00 PM")
          const start = parts[0].trim();
          const end = parts[1].trim();

          // Simple time parsing - look for time patterns
          const timeRegex = /\b(\d{1,2}):?(\d{2})?\s*(am|pm)?\b/i;
          const startMatch = start.match(timeRegex);
          const endMatch = end.match(timeRegex);

          if (startMatch) {
            let hour = parseInt(startMatch[1]);
            const minute = startMatch[2] || "00";
            const period = startMatch[3];

            if (period && period.toLowerCase() === "pm" && hour !== 12)
              hour += 12;
            if (period && period.toLowerCase() === "am" && hour === 12)
              hour = 0;

            startTime = `${hour.toString().padStart(2, "0")}:${minute}`;
          }

          if (endMatch) {
            let hour = parseInt(endMatch[1]);
            const minute = endMatch[2] || "00";
            const period = endMatch[3];

            if (period && period.toLowerCase() === "pm" && hour !== 12)
              hour += 12;
            if (period && period.toLowerCase() === "am" && hour === 12)
              hour = 0;

            endTime = `${hour.toString().padStart(2, "0")}:${minute}`;
          }
        }
      }
    }

    // Handle mock user ID conversion to ObjectId
    let clientId = req.user.id;
    if (req.user.mock && typeof clientId === "string") {
      // Convert mock string ID to a valid ObjectId
      clientId = new mongoose.Types.ObjectId();
      console.log("🔧 Converted mock user ID to ObjectId:", clientId);
    }

    // Transform frontend data to backend format
    const jobData = {
      clientId: clientId,
      clientName: clientName,
      title: req.body.title || "Untitled Job",
      description: req.body.description || "No description provided",
      location: req.body.location || "Location not specified",
      date: req.body.startDate || new Date().toISOString().split("T")[0],
      startTime: startTime,
      endTime: endTime,
      hourlyRate: req.body.rate || req.body.salary || 300,
      numberOfChildren: req.body.children?.length || 1,
      childrenAges:
        req.body.children?.map((c) => `${c.name} (${c.age})`).join(", ") ||
        "Not specified",
      requirements: Array.isArray(req.body.requirements)
        ? req.body.requirements
        : [],
      urgent: req.body.urgency === "urgent" || false,
      status: "active",
    };

    console.log("📝 Working hours parsing:");
    console.log("  Original:", req.body.workingHours);
    console.log("  Parsed start time:", startTime);
    console.log("  Parsed end time:", endTime);

    console.log("🔄 Transformed job data:", jobData);

    const newJob = new Job(jobData);
    await newJob.save();

    console.log(`✅ Job created by user: ${req.user.id}`);
    console.log("📝 New job saved:", newJob._id);

    // Send real-time notification to all caregivers
    socketService.notifyNewJob({
      jobId: newJob._id,
      title: newJob.title,
      clientName: clientName,
      location: newJob.location,
      hourlyRate: newJob.hourlyRate,
      date: newJob.date,
    });

    res.status(201).json({
      success: true,
      data: {
        job: newJob,
      },
    });
  } catch (error) {
    console.error("❌ Job creation error:", error);
    console.error("📋 Request body was:", req.body);

    // Handle validation errors specifically
    if (error.name === "ValidationError") {
      const validationErrors = Object.keys(error.errors).map((key) => {
        return `${key}: ${error.errors[key].message}`;
      });

      console.error("❌ Validation errors:", validationErrors);

      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validationErrors,
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || "Failed to create job",
    });
  }
};

// Get current parent's jobs
exports.getMyJobs = async (req, res) => {
  try {
    const userJobs = await Job.find({ clientId: req.user.id }).sort({
      createdAt: -1,
    });

    console.log(`Fetching jobs for user: ${req.user.id}`);
    console.log(`Found ${userJobs.length} jobs for this user`);

    res.json({
      success: true,
      data: {
        jobs: userJobs,
      },
    });
  } catch (error) {
    console.error("Error fetching user jobs:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch jobs",
    });
  }
};

// Get a job by id (with applications count)
exports.getJobById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate ID parameter - comprehensive check
    if (
      !id ||
      id === "undefined" ||
      id === "null" ||
      id.trim() === "" ||
      id === undefined ||
      id === null
    ) {
      console.log("❌ Invalid job ID detected:", id, typeof id);
      return res.status(400).json({
        success: false,
        error: "Invalid job ID provided",
      });
    }

    console.log("🔍 Looking for job with ID:", id);
    const job = await Job.findById(id);
    if (!job) {
      console.log("❌ Job not found for ID:", id);
      return res.status(404).json({ message: "Job not found" });
    }

    console.log("✅ Job found:", job.title);
    const applicationsCount = await Application.countDocuments({
      jobId: job._id,
    });
    res.json({ success: true, job, applicationsCount });
  } catch (err) {
    console.error("❌ Get job error for ID:", req.params.id, err);
    next(err);
  }
};

// Update job (only parent owner)
exports.updateJob = async (req, res) => {
  try {
    const job = await Job.findOneAndUpdate(
      { _id: req.params.id, clientId: req.user.id },
      req.body,
      { new: true, runValidators: true },
    );

    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Job not found or not authorized",
      });
    }

    res.json({
      success: true,
      data: {
        job: job,
      },
    });
  } catch (error) {
    console.error("Error updating job:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update job",
    });
  }
};

// Delete job (only parent owner)
exports.deleteJob = async (req, res) => {
  try {
    const job = await Job.findOneAndDelete({
      _id: req.params.id,
      clientId: req.user.id,
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Job not found or not authorized",
      });
    }

    console.log(`Job ${req.params.id} deleted by user: ${req.user.id}`);

    res.json({
      success: true,
      message: "Job deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting job:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete job",
    });
  }
};

// List applications for a job (parent owner)
exports.getApplicationsForJob = async (req, res) => {
  try {
    const job = await Job.findOne({
      _id: req.params.id,
      clientId: req.user.id,
    });
    if (!job) {
      return res.status(404).json({ success: false, error: "Job not found" });
    }

    // Mock applications for now
    const applications = [];
    res.json({ success: true, applications });
  } catch (error) {
    console.error("Error fetching applications:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch applications",
    });
  }
};
