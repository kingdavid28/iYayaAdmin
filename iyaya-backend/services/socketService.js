const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

class SocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map();
  }

  initialize(server) {
    try {
      this.io = socketIo(server, {
        cors: {
          origin: process.env.FRONTEND_URL || "http://localhost:8081",
          methods: ["GET", "POST"]
        },
        transports: ['websocket', 'polling']
      });

      this.io.use(this.authenticateSocket.bind(this));
      this.io.on('connection', this.handleConnection.bind(this));
      
      console.log('Socket.IO service initialized successfully');
    } catch (error) {
      console.error('Socket.IO initialization failed:', error);
      // Continue without socket functionality
    }
  }

  async authenticateSocket(socket, next) {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from database
      const user = await User.findById(decoded.id || decoded.mongoId);
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication failed'));
    }
  }

  handleConnection(socket) {
    try {
      console.log(`User connected: ${socket.userId}`);
      
      // Store connected user
      this.connectedUsers.set(socket.userId, {
        socketId: socket.id,
        user: socket.user,
        connectedAt: new Date()
      });

      // Join user to their personal room
      socket.join(`user_${socket.userId}`);

      // Handle joining conversation rooms
      socket.on('join_conversation', (conversationId) => {
        socket.join(`conversation_${conversationId}`);
        console.log(`User ${socket.userId} joined conversation ${conversationId}`);
      });

      // Handle leaving conversation rooms
      socket.on('leave_conversation', (conversationId) => {
        socket.leave(`conversation_${conversationId}`);
        console.log(`User ${socket.userId} left conversation ${conversationId}`);
      });

      // Handle typing indicators
      socket.on('typing_start', (conversationId) => {
        socket.to(`conversation_${conversationId}`).emit('user_typing', {
          userId: socket.userId,
          userName: socket.user.name,
          conversationId
        });
      });

      socket.on('typing_stop', (conversationId) => {
        socket.to(`conversation_${conversationId}`).emit('user_stopped_typing', {
          userId: socket.userId,
          conversationId
        });
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.userId}`);
        this.connectedUsers.delete(socket.userId);
      });

    } catch (error) {
      console.error('Socket connection handling error:', error);
    }
  }

  // Emit new message to conversation participants
  emitNewMessage(conversationId, message) {
    // Temporarily disabled to isolate notification error
    return;
  }

  notifyNewJob(jobData) {
    if (!this.io) {
      console.warn('⚠️ notifyNewJob called without active socket server');
      return;
    }

    try {
      console.log('📣 Broadcasting new job to caregivers:', {
        jobId: jobData?.jobId,
        title: jobData?.title,
        location: jobData?.location,
      });

      this.io.emit('job:new', {
        ...jobData,
        notifiedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('❌ Failed to broadcast new job notification:', error);
    }
  }

  // Emit message deleted event
  emitMessageDeleted(conversationId, messageId) {
    if (!this.io) return;
    
    try {
      this.io.to(`conversation_${conversationId}`).emit('message_deleted', {
        conversationId,
        messageId
      });
    } catch (error) {
      console.error('Error emitting message deleted:', error);
    }
  }

  // Emit notification to specific user
  emitNotification(userId, notification) {
    if (!this.io) return;
    
    try {
      this.io.to(`user_${userId}`).emit('notification', notification);
    } catch (error) {
      console.error('Error emitting notification:', error);
    }
  }

  // Check if user is online
  isUserOnline(userId) {
    return this.connectedUsers.has(userId.toString());
  }

  // Get connected users count
  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }

  // Get online status for multiple users
  getUsersOnlineStatus(userIds) {
    const status = {};
    userIds.forEach(userId => {
      status[userId] = this.isUserOnline(userId);
    });
    return status;
  }
}

module.exports = new SocketService();