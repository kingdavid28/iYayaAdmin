const DeviceToken = require("../models/DeviceToken");

const resolveUserId = (req) => req.user?.mongoId || req.user?.id;

// Helper function to check if userId is a mock/development user
const isMockUserId = (userId) => {
  return (
    typeof userId === "string" &&
    (userId.startsWith("dev-mock-") ||
      userId === "dev-mock-user" ||
      !/^[0-9a-fA-F]{24}$/.test(userId)) // Not a valid ObjectId format
  );
};

exports.upsertDeviceToken = async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const { token, platform = "unknown" } = req.body || {};

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    if (!token || typeof token !== "string") {
      return res.status(400).json({
        success: false,
        error: "Device token is required",
      });
    }

    const sanitizedPlatform = ["ios", "android", "web", "unknown"].includes(
      platform,
    )
      ? platform
      : "unknown";

    // Skip database operations for mock users in development
    if (isMockUserId(userId)) {
      console.log(
        "🔧 Mock user detected, skipping device token upsert for:",
        userId,
      );
      return res.status(200).json({
        success: true,
        data: { userId, token, platform: sanitizedPlatform, mock: true },
        message: "Mock user - device token registered in memory only",
      });
    }

    const record = await DeviceToken.findOneAndUpdate(
      { token },
      { userId, token, platform: sanitizedPlatform },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();

    return res.status(200).json({
      success: true,
      data: record,
    });
  } catch (error) {
    console.error("Device token upsert error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to register device token",
    });
  }
};

exports.removeDeviceToken = async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const { token } = req.body || {};

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    // Skip database operations for mock users in development
    if (isMockUserId(userId)) {
      console.log(
        "🔧 Mock user detected, skipping device token removal for:",
        userId,
      );
      return res.status(200).json({
        success: true,
        message: "Mock user - device token removed from memory only",
      });
    }

    if (token) {
      await DeviceToken.deleteOne({ userId, token });
    } else {
      await DeviceToken.deleteMany({ userId });
    }

    return res.status(200).json({
      success: true,
      message: "Device token removed",
    });
  } catch (error) {
    console.error("Device token removal error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to remove device token",
    });
  }
};
