const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');

// Test endpoint to verify messaging system
router.get('/test', async (req, res) => {
  try {
    console.log('🧪 Testing messaging system...');

    // Check if models are working
    const userCount = await User.countDocuments();
    const conversationCount = await Conversation.countDocuments();
    const messageCount = await Message.countDocuments();

    // Test creating a simple conversation if none exist
    let testConversation = null;
    if (conversationCount === 0) {
      // Find or create test users
      let user1 = await User.findOne({ email: 'test1@example.com' });
      let user2 = await User.findOne({ email: 'test2@example.com' });

      if (!user1) {
        user1 = await User.create({
          name: 'Test User 1',
          email: 'test1@example.com',
          password: 'password123',
          role: 'parent'
        });
      }

      if (!user2) {
        user2 = await User.create({
          name: 'Test User 2',
          email: 'test2@example.com',
          password: 'password123',
          role: 'caregiver'
        });
      }

      // Create test conversation
      testConversation = await Conversation.create({
        participants: [user1._id, user2._id],
        type: 'direct'
      });

      // Create test message
      const testMessage = await Message.create({
        conversationId: testConversation._id,
        fromUserId: user1._id,
        text: 'Hello! This is a test message from the messaging system.',
        delivered: true,
        read: false
      });

      testConversation.lastMessage = testMessage._id;
      await testConversation.save();
    }

    res.json({
      success: true,
      message: 'Messaging system is working!',
      data: {
        users: userCount,
        conversations: conversationCount + (testConversation ? 1 : 0),
        messages: messageCount + (testConversation ? 1 : 0),
        testCreated: !!testConversation,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Messaging test error:', error);
    res.status(500).json({
      success: false,
      error: 'Messaging system test failed',
      details: error.message
    });
  }
});

// Simple endpoint to get messaging status
router.get('/status', (req, res) => {
  res.json({
    success: true,
    message: 'Messaging routes are active',
    endpoints: [
      'GET /api/messages/conversations',
      'GET /api/messages/conversation/:id',
      'POST /api/messages',
      'POST /api/messages/start',
      'POST /api/messages/conversation/:id/read',
      'DELETE /api/messages/:messageId'
    ],
    timestamp: new Date().toISOString()
  });
});

module.exports = router;