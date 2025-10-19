// Optional Socket.IO realtime initializer
// This file is safe if socket.io is not installed. It will no-op.
let ioInstance = null;

function init(server) {
  try {
    const { Server } = require('socket.io');
    const cors = require('cors');
    ioInstance = new Server(server, {
      cors: {
        origin: (origin, cb) => {
          // Allow local Expo/web by default; tighten in production
          const allowed = [
            'http://localhost:8081',
            'http://localhost:3000',
            'http://localhost:5000',
          ];
          if (!origin || allowed.includes(origin)) return cb(null, true);
          cb(new Error('Not allowed by CORS'));
        },
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    ioInstance.on('connection', (socket) => {
      // Authenticate via token if provided (basic example)
      const { token, userId } = socket.handshake.auth || {};
      socket.data.userId = userId || null;

      socket.on('typing:start', (payload) => {
        const { conversationId } = payload || {};
        if (!conversationId) return;
        socket.to(conversationId).emit('typing:start', { userId: socket.data.userId, conversationId });
      });

      socket.on('typing:stop', (payload) => {
        const { conversationId } = payload || {};
        if (!conversationId) return;
        socket.to(conversationId).emit('typing:stop', { userId: socket.data.userId, conversationId });
      });

      socket.on('conversation:join', ({ conversationId }) => {
        if (!conversationId) return;
        socket.join(conversationId);
      });

      socket.on('conversation:leave', ({ conversationId }) => {
        if (!conversationId) return;
        socket.leave(conversationId);
      });

      socket.on('disconnect', () => {});
    });

    console.log('[Realtime] Socket.IO initialized');
    return ioInstance;
  } catch (err) {
    // socket.io not installed; skip
    console.warn('[Realtime] Socket.IO not available, skipping realtime layer');
    return null;
  }
}

function io() {
  return ioInstance;
}

// Helper to emit to a conversation room
function emitToConversation(conversationId, event, payload) {
  if (!ioInstance || !conversationId || !event) return;
  ioInstance.to(conversationId).emit(event, payload);
}

// Convenience: emit new message event
function emitNewMessage(conversationId, message) {
  emitToConversation(conversationId, 'message:new', { message });
}

module.exports = { init, io, emitToConversation, emitNewMessage };
