/**
 * Supabase Messaging Controller
 * Replaces MongoDB/Mongoose operations with Supabase
 */

const {
  ConversationService,
  MessageService,
} = require("../services/supabaseService");

// Get all conversations for the current user
const getConversations = async (req, res) => {
  try {
    const userId = req.user.id;

    const conversations =
      await ConversationService.getUserConversations(userId);

    // Transform conversations to match expected format
    const transformedConversations = await Promise.all(
      conversations.map(async (conv) => {
        // Get the other participant
        const otherParticipantId =
          conv.participant_1 === userId
            ? conv.participant_2
            : conv.participant_1;

        // Get other participant details
        const { UserService } = require("../services/supabaseService");
        const otherUser = await UserService.findById(otherParticipantId);

        // Get last message
        const messages = await MessageService.getByConversation(conv.id);
        const lastMessage = messages[messages.length - 1];

        return {
          id: conv.id,
          participants: [
            { id: userId, name: "You" },
            { id: otherParticipantId, name: otherUser?.name || "Unknown User" },
          ],
          lastMessage: lastMessage
            ? {
                content: lastMessage.content,
                sender: lastMessage.sender_id,
                timestamp: lastMessage.created_at,
              }
            : null,
          updatedAt: conv.updated_at,
          createdAt: conv.created_at,
        };
      }),
    );

    res.status(200).json({
      success: true,
      data: transformedConversations,
    });
  } catch (error) {
    console.error("Get conversations error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch conversations",
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
    const conversation = await ConversationService.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: "Conversation not found",
      });
    }

    // Check if user is participant
    if (
      conversation.participant_1 !== userId &&
      conversation.participant_2 !== userId
    ) {
      return res.status(403).json({
        success: false,
        error: "Access denied to this conversation",
      });
    }

    const messages = await MessageService.getByConversation(conversationId);

    // Transform messages to match expected format
    const transformedMessages = messages.map((msg) => ({
      id: msg.id,
      conversationId: msg.conversation_id,
      sender: {
        id: msg.sender_id,
        name: "User", // TODO: Get actual user name
      },
      recipient: msg.recipient_id,
      content: msg.content,
      messageType: msg.message_type,
      read: !!msg.read_at,
      readAt: msg.read_at,
      createdAt: msg.created_at,
      updatedAt: msg.updated_at,
    }));

    res.status(200).json({
      success: true,
      data: {
        messages: transformedMessages.reverse(),
        page: parseInt(page),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch messages",
    });
  }
};

// Send a message
const sendMessage = async (req, res) => {
  try {
    const { recipientId, content, messageType = "text" } = req.body;
    const senderId = req.user.id;

    if (!recipientId || !content) {
      return res.status(400).json({
        success: false,
        error: "Recipient ID and content are required",
      });
    }

    // Find or create conversation
    let conversation = await ConversationService.findByParticipants(
      senderId,
      recipientId,
    );

    if (!conversation) {
      conversation = await ConversationService.create(
        senderId,
        recipientId,
        "admin_user",
      );
    }

    // Create message
    const messageData = {
      conversation_id: conversation.id,
      sender_id: senderId,
      recipient_id: recipientId,
      content,
      message_type: messageType,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const message = await MessageService.create(messageData);

    // Update conversation's last message timestamp
    await ConversationService.updateLastMessage(
      conversation.id,
      new Date().toISOString(),
    );

    // Transform message for response
    const transformedMessage = {
      id: message.id,
      conversationId: message.conversation_id,
      sender: {
        id: message.sender_id,
        name: "You",
      },
      recipient: message.recipient_id,
      content: message.content,
      messageType: message.message_type,
      read: false,
      createdAt: message.created_at,
      updatedAt: message.updated_at,
    };

    res.status(201).json({
      success: true,
      data: transformedMessage,
    });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to send message",
    });
  }
};

// Start a new conversation
const startConversation = async (req, res) => {
  try {
    const { recipientId, initialMessage } = req.body;
    const senderId = req.user.id;

    if (!recipientId || !initialMessage) {
      return res.status(400).json({
        success: false,
        error: "Recipient ID and initial message are required",
      });
    }

    // Check if conversation already exists
    const existingConversation = await ConversationService.findByParticipants(
      senderId,
      recipientId,
    );

    if (existingConversation) {
      return res.status(400).json({
        success: false,
        error: "Conversation already exists",
      });
    }

    // Create new conversation
    const conversation = await ConversationService.create(
      senderId,
      recipientId,
      "admin_user",
    );

    // Create initial message
    const messageData = {
      conversation_id: conversation.id,
      sender_id: senderId,
      recipient_id: recipientId,
      content: initialMessage,
      message_type: "text",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const message = await MessageService.create(messageData);

    // Update conversation's last message timestamp
    await ConversationService.updateLastMessage(
      conversation.id,
      new Date().toISOString(),
    );

    res.status(201).json({
      success: true,
      data: {
        conversation: {
          id: conversation.id,
          participants: [senderId, recipientId],
          createdAt: conversation.created_at,
          updatedAt: conversation.updated_at,
        },
        message: {
          id: message.id,
          conversationId: message.conversation_id,
          sender: { id: message.sender_id, name: "You" },
          recipient: message.recipient_id,
          content: message.content,
          messageType: message.message_type,
          createdAt: message.created_at,
        },
      },
    });
  } catch (error) {
    console.error("Start conversation error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to start conversation",
    });
  }
};

// Mark messages as read
const markAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // Verify user is part of the conversation
    const conversation = await ConversationService.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: "Conversation not found",
      });
    }

    // Check if user is participant
    if (
      conversation.participant_1 !== userId &&
      conversation.participant_2 !== userId
    ) {
      return res.status(403).json({
        success: false,
        error: "Access denied to this conversation",
      });
    }

    // Get unread messages for this user in this conversation
    const messages = await MessageService.getByConversation(conversationId);
    const unreadMessages = messages.filter(
      (msg) => msg.recipient_id === userId && !msg.read_at,
    );

    // Mark each unread message as read
    const now = new Date().toISOString();
    for (const message of unreadMessages) {
      await MessageService.markAsRead(message.id, now);
    }

    res.status(200).json({
      success: true,
      message: "Messages marked as read",
      markedCount: unreadMessages.length,
    });
  } catch (error) {
    console.error("Mark as read error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to mark messages as read",
    });
  }
};

// Get unread message count for current user
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const unreadCount = await MessageService.getUnreadCount(userId);

    res.status(200).json({
      success: true,
      data: {
        unreadCount,
      },
    });
  } catch (error) {
    console.error("Get unread count error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get unread count",
    });
  }
};

module.exports = {
  getConversations,
  getMessages,
  sendMessage,
  startConversation,
  markAsRead,
  getUnreadCount,
};
