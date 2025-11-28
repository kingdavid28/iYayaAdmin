const Booking = require("../models/Booking");
const User = require("../models/User");
const Caregiver = require("../models/Caregiver");

const normalizeChildField = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry.trim() : entry))
      .filter(Boolean)
      .join(", ");
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return value ?? "";
};

const sanitizeChildren = (children) => {
  if (!Array.isArray(children)) {
    return undefined;
  }

  return children.map((child) => {
    if (!child || typeof child !== "object") {
      return child;
    }

    return {
      ...child,
      preferences: normalizeChildField(child.preferences),
      allergies: normalizeChildField(child.allergies),
      specialInstructions: normalizeChildField(
        child.specialInstructions ?? child.instructions,
      ),
      notes: normalizeChildField(child.notes),
    };
  });
};

const buildCaregiverProfile = async (caregiverIdValue) => {
  if (!caregiverIdValue) {
    return null;
  }

  const caregiverFromId = await Caregiver.findById(caregiverIdValue)
    .populate("userId", "name email profileImage")
    .lean();

  if (caregiverFromId) {
    const caregiverUser =
      caregiverFromId.userId && typeof caregiverFromId.userId === "object"
        ? caregiverFromId.userId
        : null;

    return {
      _id: caregiverFromId._id,
      id: caregiverFromId._id,
      userId: caregiverUser?._id || caregiverFromId.userId || caregiverIdValue,
      name: caregiverFromId.name || caregiverUser?.name || "Caregiver",
      email: caregiverUser?.email || "no-email@example.com",
      profileImage: caregiverFromId.profileImage || caregiverUser?.profileImage,
      avatar: caregiverFromId.profileImage || caregiverUser?.profileImage,
      hourlyRate: caregiverFromId.hourlyRate,
      rating: caregiverFromId.rating,
      reviewCount: Array.isArray(caregiverFromId.reviews)
        ? caregiverFromId.reviews.length
        : 0,
    };
  }

  const caregiverFromUserId = await Caregiver.findOne({
    userId: caregiverIdValue,
  })
    .populate("userId", "name email profileImage")
    .lean();

  if (caregiverFromUserId) {
    const caregiverUser =
      caregiverFromUserId.userId &&
      typeof caregiverFromUserId.userId === "object"
        ? caregiverFromUserId.userId
        : null;

    return {
      _id: caregiverFromUserId._id,
      id: caregiverFromUserId._id,
      userId:
        caregiverUser?._id || caregiverFromUserId.userId || caregiverIdValue,
      name: caregiverFromUserId.name || caregiverUser?.name || "Caregiver",
      email: caregiverUser?.email || "no-email@example.com",
      profileImage:
        caregiverFromUserId.profileImage || caregiverUser?.profileImage,
      avatar: caregiverFromUserId.profileImage || caregiverUser?.profileImage,
      hourlyRate: caregiverFromUserId.hourlyRate,
      rating: caregiverFromUserId.rating,
      reviewCount: Array.isArray(caregiverFromUserId.reviews)
        ? caregiverFromUserId.reviews.length
        : 0,
    };
  }

  const userDoc = await User.findById(caregiverIdValue).lean();

  if (userDoc) {
    return {
      _id: userDoc._id,
      id: userDoc._id,
      userId: userDoc._id,
      name: userDoc.name || userDoc.displayName || "Caregiver",
      email: userDoc.email || "no-email@example.com",
      profileImage: userDoc.profileImage,
      avatar: userDoc.profileImage,
      hourlyRate: undefined,
      rating: undefined,
      reviewCount: 0,
    };
  }

  return null;
};

const hydrateSingleBooking = async (bookingRecord) => {
  if (!bookingRecord) {
    return null;
  }

  const bookingObj = bookingRecord.toObject
    ? bookingRecord.toObject()
    : { ...bookingRecord };

  if (bookingObj.clientId) {
    bookingObj.parentId = bookingObj.clientId._id || bookingObj.clientId;
  }

  const caregiverRef = bookingObj.caregiverId;
  const caregiverIdValue =
    caregiverRef && typeof caregiverRef === "object"
      ? caregiverRef._id || caregiverRef.id || caregiverRef.toString?.()
      : caregiverRef;

  if (caregiverIdValue) {
    bookingObj.caregiverId = caregiverIdValue;

    const caregiverProfile = await buildCaregiverProfile(caregiverIdValue);

    if (caregiverProfile) {
      bookingObj.caregiverProfile = caregiverProfile;
      if (!bookingObj.caregiver || typeof bookingObj.caregiver !== "object") {
        bookingObj.caregiver = caregiverProfile;
      }
    }
  }

  const sanitizedChildren = sanitizeChildren(bookingObj.children);
  if (sanitizedChildren !== undefined) {
    bookingObj.children = sanitizedChildren;
  }

  return bookingObj;
};

// Get user's bookings
exports.getMyBookings = async (req, res) => {
  try {
    console.log(
      `getMyBookings called for user: ${req.user.id}, role: ${req.user.role}`,
    );

    const searchCriteria = {
      $or: [{ clientId: req.user.id }, { caregiverId: req.user.id }],
    };
    const bookings = await Booking.find(searchCriteria)
      .populate("clientId", "name email profileImage")
      .sort({ createdAt: -1 })
      .lean();

    const hydratedBookings = await Promise.all(
      bookings.map(hydrateSingleBooking),
    );

    res.json({
      success: true,
      data: {
        bookings: hydratedBookings,
      },
    });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch bookings",
    });
  }
};

// Create new booking
exports.createBooking = async (req, res) => {
  try {
    const sanitizedChildren = sanitizeChildren(req.body.children);

    const bookingPayload = {
      ...req.body,
      clientId: req.user.id,
      status: req.body.status || "pending",
    };

    if (sanitizedChildren !== undefined) {
      bookingPayload.children = sanitizedChildren;
    }

    const newBooking = new Booking(bookingPayload);
    await newBooking.save();

    const bookingRecord = newBooking.toObject();
    const hydratedBooking = await hydrateSingleBooking(bookingRecord);

    res.status(201).json({
      success: true,
      data: {
        booking: hydratedBooking,
      },
    });
  } catch (error) {
    console.error("Error creating booking:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create booking",
    });
  }
};

// Update booking
exports.updateBooking = async (req, res) => {
  try {
    const sanitizedChildren = sanitizeChildren(req.body.children);

    const updatePayload = {
      ...req.body,
    };

    if (sanitizedChildren !== undefined) {
      updatePayload.children = sanitizedChildren;
    }

    const booking = await Booking.findOneAndUpdate(
      {
        _id: req.params.id,
        $or: [{ clientId: req.user.id }, { caregiverId: req.user.id }],
      },
      updatePayload,
      { new: true, runValidators: true },
    ).lean();

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: "Booking not found or not authorized",
      });
    }

    const hydratedBooking = await hydrateSingleBooking(booking);

    res.json({
      success: true,
      data: {
        booking: hydratedBooking,
      },
    });
  } catch (error) {
    console.error("Error updating booking:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update booking",
    });
  }
};

// Upload payment proof
exports.uploadPaymentProof = async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;

    const booking = await Booking.findOneAndUpdate(
      {
        _id: req.params.id,
        clientId: req.user.id,
      },
      { paymentProof: imageBase64, paymentProofMimeType: mimeType },
      { new: true, lean: true },
    );

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: "Booking not found or not authorized",
      });
    }

    res.json({
      success: true,
      message: "Payment proof uploaded successfully",
    });
  } catch (error) {
    console.error("Error uploading payment proof:", error);
    res.status(500).json({
      success: false,
      error: "Failed to upload payment proof",
    });
  }
};

// Get booking by ID
exports.getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      $or: [{ clientId: req.user.id }, { caregiverId: req.user.id }],
    })
      .populate("clientId", "name email profileImage")
      .lean();

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: "Booking not found or not authorized",
      });
    }

    const hydratedBooking = await hydrateSingleBooking(booking);

    res.json({
      success: true,
      data: {
        booking: hydratedBooking,
      },
    });
  } catch (error) {
    console.error("Error fetching booking:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch booking",
    });
  }
};

// Update booking status
exports.updateBookingStatus = async (req, res) => {
  try {
    const { status, feedback } = req.body;

    let caregiverProfileId = null;

    if (req.user.role === "caregiver") {
      const caregiverProfile = await Caregiver.findOne({
        userId: req.user.id,
      }).lean();
      caregiverProfileId = caregiverProfile ? caregiverProfile._id : null;
    }

    const searchCriteria = {
      _id: req.params.id,
      $or: [{ clientId: req.user.id }, { caregiverId: req.user.id }],
    };

    if (caregiverProfileId) {
      searchCriteria.$or.push({ caregiverId: caregiverProfileId });
    }

    const booking = await Booking.findOneAndUpdate(
      searchCriteria,
      { status, feedback },
      { new: true, runValidators: true },
    ).lean();

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: "Booking not found or not authorized",
      });
    }

    if (status === "completed" && booking.caregiverId) {
      try {
        await Caregiver.findByIdAndUpdate(booking.caregiverId, {
          hasCompletedJobs: true,
        });
      } catch (error) {
        console.error("Error updating caregiver hasCompletedJobs:", error);
      }
    }

    const hydratedBooking = await hydrateSingleBooking(booking);

    res.json({
      success: true,
      data: {
        booking: hydratedBooking,
      },
    });
  } catch (error) {
    console.error("Error updating booking status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update booking status",
    });
  }
};

// Cancel booking
exports.cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findOneAndUpdate(
      {
        _id: req.params.id,
        clientId: req.user.id,
      },
      { status: "cancelled" },
      { new: true },
    );

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: "Booking not found or not authorized",
      });
    }

    res.json({
      success: true,
      message: "Booking cancelled successfully",
    });
  } catch (error) {
    console.error("Error cancelling booking:", error);
    res.status(500).json({
      success: false,
      error: "Failed to cancel booking",
    });
  }
};

module.exports = {
  getMyBookings: exports.getMyBookings,
  createBooking: exports.createBooking,
  updateBooking: exports.updateBooking,
  uploadPaymentProof: exports.uploadPaymentProof,
  getBookingById: exports.getBookingById,
  updateBookingStatus: exports.updateBookingStatus,
  cancelBooking: exports.cancelBooking,
};
