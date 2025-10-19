import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Alert, RefreshControl, ScrollView, StyleSheet, View} from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Dialog,
  FAB,
  Portal,
  Searchbar,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import {Icon} from 'react-native-elements';
import {NotificationItem, NotificationType} from '../../types';
import {
  fetchNotifications,
  createNotification,
  toggleNotificationRead,
  deleteNotification,
} from '../../services/notificationsService';

const NOTIFICATION_TYPES: NotificationType[] = [
  'message',
  'job_application',
  'booking_request',
  'booking_confirmed',
  'booking_cancelled',
  'review',
  'payment',
  'system',
];

export default function NotificationsManagementScreen() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<NotificationType | 'all'>('all');
  const [composeVisible, setComposeVisible] = useState(false);
  const [composePayload, setComposePayload] = useState({
    userId: '',
    type: 'system' as NotificationType,
    title: '',
    message: '',
    data: '',
  });
  const theme = useTheme();

  const loadNotifications = useCallback(async () => {
    try {
      if (!refreshing) {
        setLoading(true);
      }
      const fetchedNotifications = await fetchNotifications({
        type: selectedType !== 'all' ? selectedType : undefined,
        search: searchQuery.trim() || undefined,
      });
      setNotifications(fetchedNotifications);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing, searchQuery, selectedType]);

  useEffect(() => {
    loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType]);

  const filteredNotifications = useMemo(() => {
    if (!searchQuery.trim()) {
      return notifications;
    }
    const query = searchQuery.toLowerCase();
    return notifications.filter(notification => {
      return (
        notification.title.toLowerCase().includes(query) ||
        notification.message.toLowerCase().includes(query) ||
        notification.userInfo?.name?.toLowerCase().includes(query) ||
        notification.userInfo?.email?.toLowerCase().includes(query)
      );
    });
  }, [notifications, searchQuery]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const handleComposeChange = (field: 'userId' | 'type' | 'title' | 'message' | 'data', value: string) => {
    setComposePayload(prev => ({...prev, [field]: value}));
  };

  const handleSendNotification = async () => {
    if (!composePayload.title.trim() || !composePayload.message.trim()) {
      Alert.alert('Missing fields', 'Title and message are required.');
      return;
    }

    try {
      const data = composePayload.data.trim() ? JSON.parse(composePayload.data) : undefined;
      await createNotification({
        userId: composePayload.userId.trim() || undefined,
        type: composePayload.type,
        title: composePayload.title.trim(),
        message: composePayload.message.trim(),
        data,
      });
      Alert.alert('Success', 'Notification sent successfully.');
      setComposeVisible(false);
      setComposePayload({userId: '', type: 'system', title: '', message: '', data: ''});
      await loadNotifications();
    } catch (error: any) {
      const message = error.message || 'Failed to send notification.';
      Alert.alert('Error', message.includes('JSON') ? 'Invalid JSON in data field.' : message);
    }
  };

  const handleToggleRead = async (notification: NotificationItem) => {
    try {
      await toggleNotificationRead(notification.id, !notification.read);
      await loadNotifications();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update notification status');
    }
  };

  const handleDelete = (notification: NotificationItem) => {
    Alert.alert(
      'Delete Notification',
      'Are you sure you want to remove this notification? This cannot be undone.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteNotification(notification.id);
              await loadNotifications();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete notification');
            }
          },
        },
      ],
    );
  };

  const renderNotificationCard = (notification: NotificationItem) => {
    return (
      <Card key={notification.id} style={styles.card}>
        <Card.Content>
          <View style={styles.headerRow}>
            <View style={styles.headerInfo}>
              <Icon
                name={notification.read ? 'notifications' : 'notifications-active'}
                type="material"
                color={notification.read ? '#9e9e9e' : theme.colors.primary}
                size={24}
              />
              <View style={styles.headerText}>
                <Text variant="titleMedium">{notification.title}</Text>
                <Text variant="bodySmall" style={styles.subtleText}>
                  {notification.userInfo?.name ?? 'Broadcast'} • {notification.type.replace('_', ' ')}
                </Text>
              </View>
            </View>
            <Chip style={styles.readChip} icon={notification.read ? 'check' : 'schedule'}>
              {notification.read ? 'Read' : 'Unread'}
            </Chip>
          </View>

          <Text variant="bodyMedium" style={styles.messageText}>
            {notification.message}
          </Text>

          {notification.data ? (
            <Card style={styles.dataCard}>
              <Card.Content>
                <Text variant="titleSmall" style={styles.dataTitle}>
                  Payload
                </Text>
                <Text variant="bodySmall" style={styles.jsonText}>
                  {JSON.stringify(notification.data, null, 2)}
                </Text>
              </Card.Content>
            </Card>
          ) : null}

          <View style={styles.actionsRow}>
            <Button
              mode="contained"
              icon={notification.read ? 'email-open' : 'email'}
              onPress={() => handleToggleRead(notification)}
              style={styles.actionButton}>
              {notification.read ? 'Mark Unread' : 'Mark Read'}
            </Button>
            <Button
              mode="outlined"
              icon="delete"
              textColor={theme.colors.error}
              onPress={() => handleDelete(notification)}
              style={styles.actionButton}>
              Delete
            </Button>
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
        <Text variant="headlineMedium" style={styles.title}>
          Notifications Management
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Send announcements and track delivery for system alerts.
        </Text>

        <Searchbar
          placeholder="Search notifications"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={loadNotifications}
          style={styles.searchbar}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          <Chip
            mode={selectedType === 'all' ? 'flat' : 'outlined'}
            style={styles.filterChip}
            onPress={() => setSelectedType('all')}>
            All Types
          </Chip>
          {NOTIFICATION_TYPES.map(type => (
            <Chip
              key={type}
              mode={selectedType === type ? 'flat' : 'outlined'}
              style={styles.filterChip}
              onPress={() => setSelectedType(type)}>
              {type.replace('_', ' ')}
            </Chip>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>Loading notifications...</Text>
          </View>
        ) : filteredNotifications.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.emptyTitle}>
                No notifications found
              </Text>
              <Text variant="bodyMedium" style={styles.emptyText}>
                Try refreshing or adjusting your filters.
              </Text>
            </Card.Content>
          </Card>
        ) : (
          filteredNotifications.map(renderNotificationCard)
        )}
      </ScrollView>

      <FAB icon="plus" onPress={() => setComposeVisible(true)} style={styles.fab} />

      <Portal>
        <Dialog visible={composeVisible} onDismiss={() => setComposeVisible(false)}>
          <Dialog.Title>Send Notification</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="User ID (optional)"
              value={composePayload.userId}
              onChangeText={text => handleComposeChange('userId', text)}
              style={styles.dialogInput}
              placeholder="Leave blank for broadcast"
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dialogChipRow}>
              {NOTIFICATION_TYPES.map(type => (
                <Chip
                  key={type}
                  mode={composePayload.type === type ? 'flat' : 'outlined'}
                  style={styles.dialogChip}
                  onPress={() => handleComposeChange('type', type)}>
                  {type.replace('_', ' ')}
                </Chip>
              ))}
            </ScrollView>
            <TextInput
              label="Title"
              value={composePayload.title}
              onChangeText={text => handleComposeChange('title', text)}
              style={styles.dialogInput}
            />
            <TextInput
              label="Message"
              value={composePayload.message}
              onChangeText={text => handleComposeChange('message', text)}
              style={styles.dialogInput}
              multiline
            />
            <TextInput
              label="Additional data (JSON)"
              value={composePayload.data}
              onChangeText={text => handleComposeChange('data', text)}
              style={styles.dialogInput}
              placeholder='{"key":"value"}'
              multiline
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setComposeVisible(false)}>Cancel</Button>
            <Button mode="contained" onPress={handleSendNotification}>
              Send
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 96,
  },
  title: {
    textAlign: 'center',
    color: '#3f51b5',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 16,
  },
  searchbar: {
    marginBottom: 12,
  },
  filterRow: {
    marginBottom: 16,
  },
  filterChip: {
    marginRight: 8,
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerText: {
    marginLeft: 12,
    flexShrink: 1,
  },
  subtleText: {
    color: '#666',
  },
  readChip: {
    backgroundColor: '#e0e0e0',
  },
  messageText: {
    marginTop: 12,
    marginBottom: 12,
    color: '#424242',
  },
  dataCard: {
    marginBottom: 12,
    backgroundColor: '#fafafa',
  },
  dataTitle: {
    marginBottom: 4,
    color: '#666',
  },
  jsonText: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    marginRight: 8,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#3f51b5',
  },
  emptyCard: {
    padding: 12,
    elevation: 0,
    backgroundColor: '#fff',
  },
  emptyTitle: {
    textAlign: 'center',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
  },
  dialogInput: {
    marginBottom: 12,
  },
  dialogChipRow: {
    marginBottom: 12,
  },
  dialogChip: {
    marginRight: 8,
  },
});
