const { Types } = require('mongoose');
const Notification = require('../models/Notification');

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

const parsePaginationParams = (query) => {
  const rawPage = Number.parseInt(query.page, 10);
  const rawLimit = Number.parseInt(query.limit, 10);

  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT;

  return { page, limit };
};

const mapNotification = (notification) => {
  if (!notification) {
    return null;
  }

  const sender = notification.sender || {};
  const relatedBooking = notification.relatedBooking || {};

  return {
    id: notification._id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    read: notification.read,
    createdAt: notification.createdAt,
    readAt: notification.readAt,
    actor: sender && sender._id
      ? {
          id: sender._id,
          displayName: sender.name || sender.displayName || sender.email || '',
          avatarUrl: sender.avatar || sender.avatarUrl || sender.profileImage
        }
      : undefined,
    relatedBooking: relatedBooking._id || relatedBooking,
    data: notification.data || {},
    metadata: notification.metadata || {}
  };
};

// Get all notifications for the current user
const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page, limit } = parsePaginationParams(req.query);

    if (!Types.ObjectId.isValid(userId)) {
      return res.status(200).json({
        success: true,
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          pages: 0
        }
      });
    }

    const notifications = await Notification.find({ recipient: userId })
      .populate('sender', 'name email avatar profileImage')
      .populate('relatedBooking', '_id bookingCode status')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .lean();

    const total = await Notification.countDocuments({ recipient: userId });

    res.status(200).json({
      success: true,
      data: notifications.map(mapNotification).filter(Boolean),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 0
      }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications'
    });
  }
};

// Mark a specific notification as read
const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;

    if (!Types.ObjectId.isValid(userId)) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: userId },
      { read: true, readAt: new Date() },
      { new: true }
    )
      .populate('sender', 'name email avatar profileImage')
      .populate('relatedBooking', '_id bookingCode status')
      .lean();

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    res.status(200).json({
      success: true,
      data: mapNotification(notification)
    });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read'
    });
  }
};

// Mark all notifications as read
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!Types.ObjectId.isValid(userId)) {
      return res.status(200).json({
        success: true,
        message: 'All notifications marked as read'
      });
    }

    await Notification.updateMany(
      { recipient: userId, read: false },
      { read: true, readAt: new Date() }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark notifications as read'
    });
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead
};
