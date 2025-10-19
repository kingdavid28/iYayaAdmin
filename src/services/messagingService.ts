import { supabase } from '../config/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  message_type: 'text' | 'image' | 'file';
  read_at?: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  participant_1: string;
  participant_2: string;
  last_message_at?: string;
  created_at: string;
  type?: 'admin_user' | 'admin_caregiver' | 'support';
}

class MessagingService {
  private listeners: Map<string, () => void> = new Map();
  private channels: Map<string, RealtimeChannel> = new Map();

  // Conversation Management
  async createConversation(participant1: string, participant2: string, type: Conversation['type'] = 'admin_user'): Promise<string> {
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        participant_1: participant1,
        participant_2: participant2,
        type,
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create conversation: ${error.message}`);
    }

    return data.id;
  }

  async getConversations(userId: string): Promise<Conversation[]> {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
      .order('last_message_at', { ascending: false })
      .limit(50);

    if (error) {
      throw new Error(`Failed to get conversations: ${error.message}`);
    }

    return data || [];
  }

  // Message Management
  async sendMessage(conversationId: string, senderId: string, content: string, messageType: Message['message_type'] = 'text'): Promise<string> {
    // Get conversation to find recipient
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    const recipientId = conversation.participant_1 === senderId
      ? conversation.participant_2
      : conversation.participant_1;

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        recipient_id: recipientId,
        content,
        message_type: messageType,
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to send message: ${error.message}`);
    }

    // Update conversation last message timestamp
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId);

    return data.id;
  }

  async getMessages(conversationId: string, limit = 50): Promise<Message[]> {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get messages: ${error.message}`);
    }

    return (data || []).reverse(); // Reverse to show oldest first
  }

  async markMessageAsRead(messageId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('id', messageId)
      .eq('recipient_id', userId);

    if (error) {
      throw new Error(`Failed to mark message as read: ${error.message}`);
    }
  }

  // Real-time Listeners
  subscribeToConversation(conversationId: string, callback: (messages: Message[]) => void): () => void {
    const channel = supabase
      .channel(`conversation_${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          // Fetch updated messages
          const messages = await this.getMessages(conversationId);
          callback(messages);
        }
      )
      .subscribe();

    this.channels.set(`conversation_${conversationId}`, channel);

    // Initial load
    this.getMessages(conversationId).then(callback);

    return () => {
      supabase.removeChannel(channel);
      this.channels.delete(`conversation_${conversationId}`);
    };
  }

  subscribeToConversations(userId: string, callback: (conversations: Conversation[]) => void): () => void {
    const channel = supabase
      .channel(`user_conversations_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `participant_1=eq.${userId}`,
        },
        async () => {
          const conversations = await this.getConversations(userId);
          callback(conversations);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `participant_2=eq.${userId}`,
        },
        async () => {
          const conversations = await this.getConversations(userId);
          callback(conversations);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          if (payload.new && typeof payload.new === 'object' && 'conversation_id' in payload.new) {
            // Check if this conversation involves the user
            const { data: conv } = await supabase
              .from('conversations')
              .select('*')
              .eq('id', payload.new.conversation_id)
              .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
              .single();

            if (conv) {
              const conversations = await this.getConversations(userId);
              callback(conversations);
            }
          }
        }
      )
      .subscribe();

    this.channels.set(`conversations_${userId}`, channel);

    // Initial load
    this.getConversations(userId).then(callback);

    return () => {
      supabase.removeChannel(channel);
      this.channels.delete(`conversations_${userId}`);
    };
  }

  // Presence Management (simplified for Supabase)
  async setUserPresence(userId: string, status: 'online' | 'away' | 'offline'): Promise<void> {
    // For now, we'll use a simple approach with user metadata or a presence table
    // In a full implementation, you'd want a dedicated presence table
    console.log(`User ${userId} presence set to ${status}`);
  }

  subscribeToPresence(userId: string, callback: (status: any) => void): () => void {
    // Simplified presence - in a full implementation, you'd use Supabase realtime for this
    callback({ status: 'online', lastSeen: new Date().toISOString() });

    return () => {
      // No cleanup needed for this simplified implementation
    };
  }

  // Typing Indicators (simplified)
  async setTypingStatus(conversationId: string, userId: string, isTyping: boolean): Promise<void> {
    // Simplified typing indicator - in a full implementation, you'd use Supabase realtime channels
    console.log(`User ${userId} typing status in ${conversationId}: ${isTyping}`);
  }

  subscribeToTyping(conversationId: string, callback: (typingUsers: Record<string, any>) => void): () => void {
    // Simplified typing - in a full implementation, you'd use Supabase realtime channels
    callback({});

    return () => {
      // No cleanup needed for this simplified implementation
    };
  }

  // Cleanup
  unsubscribeAll(): void {
    this.channels.forEach((channel) => {
      supabase.removeChannel(channel);
    });
    this.channels.clear();
    this.listeners.clear();
  }

  unsubscribe(listenerKey: string): void {
    const channel = this.channels.get(listenerKey);
    if (channel) {
      supabase.removeChannel(channel);
      this.channels.delete(listenerKey);
    }
  }
}

export const messagingService = new MessagingService();
