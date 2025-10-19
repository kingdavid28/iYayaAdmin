const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const { authenticate } = require('../middleware/auth');
const { errorHandler } = require('../utils/errorHandler');

// Get all conversations for the current user
const getConversations = async (req, res) => {
  try {
    const userId = req.user.id;

    const conversations = await Conversation.find({
      participants: userId
    })
    .populate('participants', 'name email')
    .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      data: conversations
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversations'
    });
  }
};

// Get messages for a specific conversation
const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user.id;

    // Verify user is part of the conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    const messages = await Message.find({ conversationId })
      .populate('sender', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    res.status(200).json({
      success: true,
      data: {
        messages: messages.reverse(),
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch messages'
    });
  }
};

// Send a message
const sendMessage = async (req, res) => {
  try {
    const { recipientId, content, messageType = 'text' } = req.body;
    const senderId = req.user.id;

    // Find or create conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, recipientId] }
    });

    if (!conversation) {
      conversation = new Conversation({
        participants: [senderId, recipientId],
        lastMessage: {
          content,
          sender: senderId,
          timestamp: new Date()
        }
      });
      await conversation.save();
    }

    // Create message
    const message = new Message({
      conversationId: conversation._id,
      sender: senderId,
      recipient: recipientId,
      content,
      messageType
    });

    await message.save();

    // Update conversation's last message
    conversation.lastMessage = {
      content,
      sender: senderId,
      timestamp: new Date()
    };
    conversation.updatedAt = new Date();
    await conversation.save();

    // Populate sender info for response
    await message.populate('sender', 'name email');

    res.status(201).json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message'
    });
  }
};

// Start a new conversation
const startConversation = async (req, res) => {
  try {
    const { recipientId, initialMessage } = req.body;
    const senderId = req.user.id;

    // Check if conversation already exists
    const existingConversation = await Conversation.findOne({
      participants: { $all: [senderId, recipientId] }
    });

    if (existingConversation) {
      return res.status(400).json({
        success: false,
        error: 'Conversation already exists'
      });
    }

    // Create new conversation
    const conversation = new Conversation({
      participants: [senderId, recipientId],
      lastMessage: {
        content: initialMessage,
        sender: senderId,
        timestamp: new Date()
      }
    });

    await conversation.save();

    // Create initial message
    const message = new Message({
      conversationId: conversation._id,
      sender: senderId,
      recipient: recipientId,
      content: initialMessage,
      messageType: 'text'
    });

    await message.save();

    res.status(201).json({
      success: true,
      data: {
        conversation,
        message
      }
    });
  } catch (error) {
    console.error('Start conversation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start conversation'
    });
  }
};

// Mark messages as read
const markAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    await Message.updateMany(
      {
        conversationId,
        recipient: userId,
        read: false
      },
      {
        read: true,
        readAt: new Date()
      }
    );

    res.status(200).json({
      success: true,
      message: 'Messages marked as read'
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark messages as read'
    });
  }
};

module.exports = {
  getConversations,
  getMessages,
  sendMessage,
  startConversation,
  markAsRead
};
