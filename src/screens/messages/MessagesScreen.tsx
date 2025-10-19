import React, {useEffect, useState, useRef} from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  Text,
  Card,
  FAB,
  ActivityIndicator,
  useTheme,
  Chip,
  Avatar,
} from 'react-native-paper';
import {Icon} from 'react-native-elements';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import {messagingService, Message, Conversation} from '../services/messagingService';
import {useAuth} from '../contexts/AuthContext';

export default function MessagesScreen() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showNewMessageDialog, setShowNewMessageDialog] = useState(false);

  const navigation = useNavigation();
  const theme = useTheme();
  const {user} = useAuth();
  const flatListRef = useRef<FlatList>(null);

  useFocusEffect(
    React.useCallback(() => {
      loadConversations();

      return () => {
        // Cleanup listeners when screen loses focus
        messagingService.unsubscribeAll();
      };
    }, [])
  );

  const loadConversations = async () => {
    try {
      setLoading(true);
      const userConversations = await messagingService.getConversations(user?.id || '');
      setConversations(userConversations);

      // Subscribe to real-time updates
      if (user?.id) {
        messagingService.subscribeToConversations(user.id, (updatedConversations) => {
          setConversations(updatedConversations);
        });
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversation: Conversation) => {
    try {
      setSelectedConversation(conversation);
      const conversationMessages = await messagingService.getMessages(conversation.id);
      setMessages(conversationMessages);

      // Subscribe to real-time message updates
      messagingService.subscribeToConversation(conversation.id, (updatedMessages) => {
        setMessages(updatedMessages);
        // Scroll to bottom when new messages arrive
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({animated: true});
        }, 100);
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load messages');
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user) return;

    try {
      setSending(true);
      await messagingService.sendMessage(
        selectedConversation.id,
        user.id,
        newMessage.trim()
      );
      setNewMessage('');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getParticipantNames = (conversation: Conversation) => {
    return Object.values(conversation.participants)
      .filter(p => p.email !== user?.email) // Exclude current user
      .map(p => p.name)
      .join(', ');
  };

  const renderConversationItem = ({item: conversation}: {item: Conversation}) => (
    <Card
      style={[
        styles.conversationCard,
        selectedConversation?.id === conversation.id && styles.selectedConversationCard,
      ]}
      onPress={() => loadMessages(conversation)}>
      <Card.Content>
        <View style={styles.conversationHeader}>
          <View style={styles.conversationInfo}>
            <Text variant="titleMedium" style={styles.conversationTitle}>
              {getParticipantNames(conversation)}
            </Text>
            {conversation.lastMessage && (
              <Text variant="bodySmall" style={styles.lastMessage}>
                {conversation.lastMessage.content}
              </Text>
            )}
          </View>
          <View style={styles.conversationMeta}>
            <Chip style={styles.typeChip}>
              {conversation.type}
            </Chip>
            {conversation.lastMessage && (
              <Text variant="bodySmall" style={styles.timestamp}>
                {formatTime(conversation.lastMessage.timestamp)}
              </Text>
            )}
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  const renderMessageItem = ({item: message}: {item: Message}) => (
    <View style={[
      styles.messageContainer,
      message.senderId === user?.id ? styles.ownMessage : styles.otherMessage,
    ]}>
      <View style={styles.messageContent}>
        {message.senderId !== user?.id && (
          <Text variant="bodySmall" style={styles.senderName}>
            {message.senderName}
          </Text>
        )}
        <View style={[
          styles.messageBubble,
          message.senderId === user?.id ? styles.ownBubble : styles.otherBubble,
        ]}>
          <Text style={[
            styles.messageText,
            message.senderId === user?.id ? styles.ownMessageText : styles.otherMessageText,
          ]}>
            {message.content}
          </Text>
        </View>
        <Text variant="bodySmall" style={[
          styles.messageTime,
          message.senderId === user?.id ? styles.ownMessageTime : styles.otherMessageTime,
        ]}>
          {formatTime(message.timestamp)}
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading conversations...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!selectedConversation ? (
        // Conversations List
        <>
          <View style={styles.header}>
            <Text variant="headlineMedium" style={styles.title}>
              Messages
            </Text>
            <Text variant="bodyMedium" style={styles.subtitle}>
              Manage admin communications
            </Text>
          </View>

          <FlatList
            data={conversations}
            renderItem={renderConversationItem}
            keyExtractor={item => item.id}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text>No conversations yet</Text>
              </View>
            }
          />

          <FAB
            icon="message-plus"
            onPress={() => setShowNewMessageDialog(true)}
            style={styles.fab}
          />
        </>
      ) : (
        // Messages View
        <>
          <View style={styles.messagesHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setSelectedConversation(null)}>
              <Icon name="arrow-back" type="material" color="#3f51b5" size={24} />
            </TouchableOpacity>
            <Text variant="titleLarge" style={styles.conversationTitle}>
              {getParticipantNames(selectedConversation)}
            </Text>
            <Chip style={styles.typeChip}>
              {selectedConversation.type}
            </Chip>
          </View>

          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessageItem}
            keyExtractor={item => item.id}
            style={styles.messagesList}
            ListEmptyComponent={
              <View style={styles.emptyMessagesContainer}>
                <Text>No messages yet. Start the conversation!</Text>
              </View>
            }
          />

          <View style={styles.messageInputContainer}>
            <TextInput
              style={styles.messageInput}
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Type a message..."
              multiline
            />
            <TouchableOpacity
              style={[styles.sendButton, (!newMessage.trim() || sending) && styles.sendButtonDisabled]}
              onPress={sendMessage}
              disabled={!newMessage.trim() || sending}>
              {sending ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Icon name="send" type="material" color="white" size={20} />
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
  },
  header: {
    padding: 16,
    backgroundColor: 'white',
    elevation: 2,
  },
  title: {
    color: '#3f51b5',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    color: '#666',
  },
  conversationCard: {
    margin: 8,
    elevation: 2,
  },
  selectedConversationCard: {
    borderColor: '#3f51b5',
    borderWidth: 2,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  conversationInfo: {
    flex: 1,
  },
  conversationTitle: {
    fontWeight: 'bold',
  },
  lastMessage: {
    color: '#666',
    marginTop: 4,
  },
  conversationMeta: {
    alignItems: 'flex-end',
  },
  typeChip: {
    backgroundColor: '#e3f2fd',
    marginBottom: 4,
  },
  timestamp: {
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  messagesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    elevation: 2,
  },
  backButton: {
    marginRight: 16,
  },
  conversationTitle: {
    flex: 1,
    fontWeight: 'bold',
    color: '#3f51b5',
  },
  messagesList: {
    flex: 1,
    padding: 16,
  },
  messageContainer: {
    marginBottom: 16,
  },
  ownMessage: {
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignItems: 'flex-start',
  },
  messageContent: {
    maxWidth: '80%',
  },
  senderName: {
    color: '#666',
    marginBottom: 4,
    fontWeight: 'bold',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 18,
  },
  ownBubble: {
    backgroundColor: '#3f51b5',
  },
  otherBubble: {
    backgroundColor: '#e0e0e0',
  },
  messageText: {
    fontSize: 16,
  },
  ownMessageText: {
    color: 'white',
  },
  otherMessageText: {
    color: '#333',
  },
  messageTime: {
    marginTop: 4,
    fontSize: 12,
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'right',
  },
  otherMessageTime: {
    color: '#666',
  },
  emptyMessagesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  messageInputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#3f51b5',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#3f51b5',
  },
});
