import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Alert, FlatList, Image, Linking, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View} from 'react-native';
import {
  ActivityIndicator,
  Avatar,
  Button,
  Card,
  Chip,
  Divider,
  Dialog,
  FAB,
  HelperText,
  IconButton,
  Portal,
  Searchbar,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import {NotificationItem, NotificationType} from '../../types';
import {
  fetchNotifications,
  createNotification,
  toggleNotificationRead,
  deleteNotification,
  fetchNotificationStats,
  NOTIFICATION_TYPES,
  NotificationStats,
} from '../../services/notificationsService';

const TYPE_LABELS: Record<NotificationType, string> = {
  message: 'Message',
  job_application: 'Job Application',
  booking_request: 'Booking Request',
  booking_confirmed: 'Booking Confirmed',
  booking_cancelled: 'Booking Cancelled',
  review: 'Review',
  payment: 'Payment',
  payment_proof: 'Payment Proof',
  system: 'System',
};

const composeInitialState = {
  userId: '',
  type: 'system' as NotificationType,
  title: '',
  message: '',
  data: '',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const pickString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }
  return undefined;
};

const pickNumber = (...values: unknown[]): number | undefined => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
};

const formatCurrency = (value: number | undefined): string | undefined => {
  if (value === undefined) {
    return undefined;
  }
  try {
    return value.toLocaleString(undefined, {
      style: 'currency',
      currency: 'PHP',
    });
  } catch (error) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
};

const summarizeProof = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  if (value.length > 60) {
    return `Image data (${value.length} chars)`;
  }
  return value;
};

const isImageData = (value: string | undefined, mimeType?: string): boolean => {
  if (!value) {
    return false;
  }
  if (mimeType && mimeType.startsWith('image/')) {
    return true;
  }
  if (/^data:image\//i.test(value)) {
    return true;
  }
  if (/^https?:\/\//i.test(value)) {
    return true;
  }
  return false;
};

const formatStatus = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
};

const formatLabel = (value: string): string =>
  value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

const summarizeValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return 'Not provided';
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return 'Not provided';
    }
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }
    if (trimmed.length > 80) {
      return `${trimmed.slice(0, 77)}… (${trimmed.length} chars)`;
    }
    return trimmed;
  }

  if (typeof value === 'number') {
    return value.toLocaleString();
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (Array.isArray(value)) {
    return `Array (${value.length} items)`;
  }

  if (isRecord(value)) {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      return 'Object (empty)';
    }
    return `Object keys: ${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '…' : ''}`;
  }

  return String(value);
};

function useDebouncedValue<T>(value: T, delay = 400) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [delay, value]);

  return debouncedValue;
}

export default function NotificationsManagementScreen() {
  const theme = useTheme();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<NotificationType | 'all'>('all');
  const [composeVisible, setComposeVisible] = useState(false);
  const [composePayload, setComposePayload] = useState({...composeInitialState});
  const [composeSubmitting, setComposeSubmitting] = useState(false);
  const [dataFieldError, setDataFieldError] = useState<string | null>(null);
  const [toggleLoadingId, setToggleLoadingId] = useState<string | null>(null);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);
  const debouncedQuery = useDebouncedValue(searchQuery);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [proofPreviewUri, setProofPreviewUri] = useState<string | null>(null);
  const closeProofPreview = useCallback(() => setProofPreviewUri(null), []);
  const handleOpenProofExternally = useCallback(() => {
    if (!proofPreviewUri || !proofPreviewUri.startsWith('http')) {
      return;
    }
    Linking.openURL(proofPreviewUri).catch(error => {
      console.warn('Failed to open proof URL', error);
    });
  }, [proofPreviewUri]);
  const isRemoteProof = useMemo(() => Boolean(proofPreviewUri?.startsWith('http')), [proofPreviewUri]);

  const closeComposeDialog = useCallback(() => {
    setComposeVisible(false);
    setComposePayload({...composeInitialState});
    setDataFieldError(null);
    setComposeSubmitting(false);
  }, []);

  const formatDateTime = useCallback((value: string | null | undefined) => {
    if (!value) {
      return 'Unknown date';
    }
    try {
      return new Date(value).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch (error) {
      return value;
    }
  }, []);

  const loadNotifications = useCallback(
    async (options?: {silent?: boolean}) => {
      if (!options?.silent) {
        setLoading(true);
      }
      try {
        const fetchedNotifications = await fetchNotifications({
          type: selectedType !== 'all' ? selectedType : undefined,
          search: debouncedQuery.trim() ? debouncedQuery : undefined,
        });
        setNotifications(fetchedNotifications);

        fetchNotificationStats()
          .then(setStats)
          .catch(error => {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.warn('[notifications] Failed to load stats:', message);
          });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load notifications';
        Alert.alert('Error', message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [debouncedQuery, selectedType],
  );

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadNotifications({silent: true});
  }, [loadNotifications]);

  const handleComposeChange = useCallback(
    (field: 'userId' | 'type' | 'title' | 'message' | 'data', value: string) => {
      setComposePayload(prev => ({...prev, [field]: value}));
      if (field === 'data') {
        setDataFieldError(null);
      }
    },
    [],
  );

  const handleSendNotification = useCallback(async () => {
    if (!composePayload.title.trim() || !composePayload.message.trim()) {
      Alert.alert('Missing fields', 'Title and message are required.');
      return;
    }

    let parsedData: Record<string, unknown> | undefined;
    if (composePayload.data.trim()) {
      try {
        parsedData = JSON.parse(composePayload.data.trim()) as Record<string, unknown>;
        setDataFieldError(null);
      } catch (error) {
        setDataFieldError('Please provide valid JSON.');
        return;
      }
    }

    setComposeSubmitting(true);

    try {
      await createNotification({
        userId: composePayload.userId.trim() || undefined,
        type: composePayload.type,
        title: composePayload.title.trim(),
        message: composePayload.message.trim(),
        data: parsedData ?? null,
      });
      Alert.alert('Success', 'Notification sent successfully.');
      closeComposeDialog();
      await loadNotifications({silent: true});
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send notification.';
      Alert.alert('Error', message);
      setComposeSubmitting(false);
    }
  }, [closeComposeDialog, composePayload, loadNotifications]);

  const handleToggleRead = useCallback(
    async (notification: NotificationItem) => {
      setToggleLoadingId(notification.id);
      try {
        await toggleNotificationRead(notification.id, !notification.read);
        await loadNotifications({silent: true});
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update notification status';
        Alert.alert('Error', message);
      } finally {
        setToggleLoadingId(null);
      }
    },
    [loadNotifications],
  );

  const renderPayloadContent = useCallback(
    (item: NotificationItem): React.ReactNode => {
      if (!item.data) {
        return null;
      }

      let normalizedData: unknown = item.data;

      if (typeof normalizedData === 'string') {
        const trimmed = normalizedData.trim();
        if (!trimmed) {
          return null;
        }
        try {
          const parsed = JSON.parse(trimmed);
          normalizedData = parsed;
        } catch (error) {
          return (
            <Text variant="bodySmall" style={styles.jsonText}>
              {summarizeValue(trimmed)}
            </Text>
          );
        }
      }

      if (item.type === 'payment' && isRecord(normalizedData)) {
        const data = normalizedData as Record<string, unknown>;
        const bookingCandidate = data['booking'];
        const booking = isRecord(bookingCandidate) ? bookingCandidate : undefined;
        const paymentCandidate = data['payment'];
        const payment = isRecord(paymentCandidate) ? paymentCandidate : undefined;

        const bookingId = pickString(
          data['bookingId'],
          data['booking_id'],
          booking?.['id'],
        );

        const paymentId = pickString(
          data['paymentId'],
          data['payment_id'],
          payment?.['id'],
          data['id'],
        );

        const amountNumber = pickNumber(
          data['amount'],
          data['totalAmount'],
          data['total_amount'],
          payment?.['amount'],
          payment?.['total'],
          payment?.['total_amount'],
        );

        const amountDisplay = formatCurrency(amountNumber) ?? pickString(data['amount']);

        const statusDisplay = formatStatus(
          pickString(
            data['paymentStatus'],
            data['payment_status'],
            data['status'],
            payment?.['status'],
          ),
        );

        const proofRaw = pickString(
          data['paymentProof'],
          data['payment_proof'],
          data['proofUrl'],
          data['proof_url'],
          payment?.['proof'],
        );
        const mimeTypeDisplay = pickString(
          data['paymentProofMimeType'],
          data['payment_proof_mime_type'],
          data['mimeType'],
          data['mime_type'],
        );

        const showImagePreview = isImageData(proofRaw, mimeTypeDisplay ?? undefined);
        const proofUri = proofRaw
          ? proofRaw.startsWith('http')
            ? proofRaw
            : `data:${mimeTypeDisplay ?? 'image/jpeg'};base64,${proofRaw}`
          : null;
        const proofDisplay = summarizeProof(proofRaw);

        const uploadedAtRaw = pickString(
          data['uploadedAt'],
          data['uploaded_at'],
          data['createdAt'],
          data['created_at'],
        );
        const uploadedAtDisplay = uploadedAtRaw ? formatDateTime(uploadedAtRaw) : undefined;

        const parentName = pickString(
          data['parentName'],
          data['parent_name'],
          data['parentEmail'],
          data['parent_email'],
          payment?.['parentName'],
        );

        const caregiverName = pickString(
          data['caregiverName'],
          data['caregiver_name'],
          payment?.['caregiverName'],
        );

        const details: {label: string; value: string}[] = [];

        if (paymentId) {
          details.push({label: 'Payment ID', value: paymentId});
        }
        if (bookingId) {
          details.push({label: 'Booking ID', value: bookingId});
        }
        if (statusDisplay) {
          details.push({label: 'Status', value: statusDisplay});
        }
        if (amountDisplay) {
          details.push({label: 'Amount', value: amountDisplay});
        }
        if (parentName) {
          details.push({label: 'Parent', value: parentName});
        }
        if (caregiverName) {
          details.push({label: 'Caregiver', value: caregiverName});
        }
        if (mimeTypeDisplay) {
          details.push({label: 'Proof Type', value: mimeTypeDisplay});
        }
        if (!showImagePreview && proofDisplay) {
          details.push({label: 'Proof', value: proofDisplay});
        }
        if (uploadedAtDisplay && uploadedAtDisplay !== 'Unknown date') {
          details.push({label: 'Uploaded', value: uploadedAtDisplay});
        }

        if (details.length > 0 || showImagePreview) {
          if (__DEV__ && showImagePreview) {
            console.log('[notifications] proof preview', {
              id: item.id,
              proofUri,
              mimeTypeDisplay,
            });
          }

          return (
            <View style={styles.dataList}>
              {details.map(detail => (
                <View key={detail.label} style={styles.dataRow}>
                  <Text variant="labelSmall" style={styles.dataLabel}>
                    {detail.label}
                  </Text>
                  <Text variant="bodySmall" style={styles.dataValue}>
                    {detail.value}
                  </Text>
                </View>
              ))}

              {showImagePreview && proofUri ? (
                <View style={styles.previewContainer}>
                  <Text variant="labelSmall" style={styles.dataLabel}>
                    Payment Proof
                  </Text>
                  <TouchableOpacity
                    style={styles.previewTouchable}
                    onPress={() => setProofPreviewUri(proofUri)}>
                    <Image
                      source={{
                        uri: proofUri,
                      }}
                      style={styles.previewImage}
                      resizeMode="cover"
                      onError={() => console.warn('[notifications] proof image failed', item.id)}
                      onLoad={() => console.log('[notifications] proof image loaded', item.id)}
                    />
                    <Text variant="bodySmall" style={styles.previewHint}>
                      Tap to view full proof
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          );
        }
      }

      if (isRecord(normalizedData)) {
        const entries = Object.entries(normalizedData as Record<string, unknown>);
        const genericDetails = entries
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => ({
            label: formatLabel(key),
            value: summarizeValue(value),
          }))
          .filter(detail => detail.value && detail.value.length > 0)
          .slice(0, 8);

        if (genericDetails.length > 0) {
          return (
            <View style={styles.dataList}>
              {genericDetails.map(detail => (
                <View key={detail.label} style={styles.dataRow}>
                  <Text variant="labelSmall" style={styles.dataLabel}>
                    {detail.label}
                  </Text>
                  <Text variant="bodySmall" style={styles.dataValue}>
                    {detail.value}
                  </Text>
                </View>
              ))}
            </View>
          );
        }
      }

      if (Array.isArray(normalizedData)) {
        return (
          <Text variant="bodySmall" style={styles.jsonText}>
            {`Array (${normalizedData.length} items)`}
          </Text>
        );
      }

      return (
        <Text variant="bodySmall" style={styles.jsonText}>
          {summarizeValue(normalizedData)}
        </Text>
      );
    },
    [formatDateTime],
  );

  const confirmDeleteNotification = useCallback(
    (notification: NotificationItem) => {
      Alert.alert(
        'Delete notification',
        'Are you sure you want to delete this notification? This action cannot be undone.',
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              setDeleteLoadingId(notification.id);
              try {
                await deleteNotification(notification.id);
                await loadNotifications({silent: true});
              } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to delete notification';
                Alert.alert('Error', message);
              } finally {
                setDeleteLoadingId(null);
              }
            },
          },
        ],
      );
    },
    [loadNotifications],
  );

  const renderListHeader = useCallback(() => (
    <View style={styles.headerContainer}>
      <Text variant="headlineMedium" style={styles.title}>
        Notifications Management
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Send announcements and track delivery for system alerts.
      </Text>

      <View style={styles.statsContainer}>
        <Card style={styles.statCard}>
          <Card.Content style={styles.statContent}>
            <Avatar.Icon icon="bell-outline" size={42} style={[styles.statIcon, styles.statIconPrimary]} color={theme.colors.onPrimary} />
            <View style={styles.statTextGroup}>
              <Text variant="titleLarge" style={styles.statValue}>{stats?.total ?? '––'}</Text>
              <Text variant="bodySmall" style={styles.statLabel}>Total sent</Text>
            </View>
          </Card.Content>
        </Card>
        <Card style={styles.statCard}>
          <Card.Content style={styles.statContent}>
            <Avatar.Icon icon="bell-ring" size={42} style={[styles.statIcon, styles.statIconAccent]} color={theme.colors.onPrimary} />
            <View style={styles.statTextGroup}>
              <Text variant="titleLarge" style={styles.statValue}>{stats?.unread ?? '––'}</Text>
              <Text variant="bodySmall" style={styles.statLabel}>Unread</Text>
            </View>
          </Card.Content>
        </Card>
        <Card style={styles.statCard}>
          <Card.Content style={styles.statContent}>
            <Avatar.Icon icon="account-group" size={42} style={[styles.statIcon, styles.statIconInfo]} color={theme.colors.onPrimary} />
            <View style={styles.statTextGroup}>
              <Text variant="titleLarge" style={styles.statValue}>{stats?.broadcasts ?? '––'}</Text>
              <Text variant="bodySmall" style={styles.statLabel}>Broadcasts</Text>
            </View>
          </Card.Content>
        </Card>
        <Card style={styles.statCard}>
          <Card.Content style={styles.statContent}>
            <Avatar.Icon icon="account-check" size={42} style={[styles.statIcon, styles.statIconSuccess]} color={theme.colors.onPrimary} />
            <View style={styles.statTextGroup}>
              <Text variant="titleLarge" style={styles.statValue}>{stats?.targeted ?? '––'}</Text>
              <Text variant="bodySmall" style={styles.statLabel}>Targeted</Text>
            </View>
          </Card.Content>
        </Card>
      </View>

      <Searchbar
        placeholder="Search notifications"
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={styles.searchbar}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterContent}
        style={styles.filterScroll}>
        <Chip
          mode={selectedType === 'all' ? 'flat' : 'outlined'}
          style={styles.filterChip}
          onPress={() => setSelectedType('all')}>
          {`All Types (${stats?.total ?? 0})`}
        </Chip>
        {NOTIFICATION_TYPES.map(type => (
          <Chip
            key={type}
            mode={selectedType === type ? 'flat' : 'outlined'}
            style={styles.filterChip}
            onPress={() => setSelectedType(type)}>
            {`${TYPE_LABELS[type] ?? type.replace(/_/g, ' ')} (${stats?.perType?.[type] ?? 0})`}
          </Chip>
        ))}
      </ScrollView>
    </View>
  ), [searchQuery, selectedType, stats, theme.colors.onPrimary]);

  const renderNotificationCard = useCallback(({item}: {item: NotificationItem}) => {
    const isToggleLoading = toggleLoadingId === item.id;
    const isDeleteLoading = deleteLoadingId === item.id;

    const payloadContent = renderPayloadContent(item);

    return (
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.headerRow}>
            <View style={styles.headerInfo}>
              <Avatar.Icon
                icon={item.read ? 'bell-check' : 'bell-ring'}
                size={40}
                style={[styles.avatar, item.read ? styles.avatarRead : styles.avatarUnread]}
                color={item.read ? theme.colors.onSurfaceVariant : theme.colors.onPrimary}
              />
              <View style={styles.headerText}>
                <Text variant="titleMedium" numberOfLines={1}>
                  {item.title}
                </Text>
                <Text variant="bodySmall" style={styles.subtleText} numberOfLines={2}>
                  {(item.userInfo?.name || 'Broadcast') + ' • ' + (TYPE_LABELS[item.type] ?? item.type.replace(/_/g, ' '))}
                </Text>
              </View>
            </View>
            <Chip
              style={styles.readChip}
              icon={item.read ? 'check' : 'clock-outline'}
              textStyle={styles.readChipText}>
              {item.read ? 'Read' : 'Unread'}
            </Chip>
          </View>

          <Text variant="bodyMedium" style={styles.messageText}>
            {item.message}
          </Text>

          <Divider style={styles.cardDivider} />

          <View style={styles.tagRow}>
            <Chip
              icon={item.userId?.trim() ? 'account' : 'account-group'}
              compact
              style={styles.tagChip}
              textStyle={styles.tagChipText}>
              {item.userId?.trim() ? 'Direct recipient' : 'Broadcast'}
            </Chip>
            <Chip
              icon="bell-outline"
              compact
              style={[styles.tagChip, styles.tagChipSecondary]}
              textStyle={styles.tagChipText}>
              {TYPE_LABELS[item.type] ?? item.type.replace(/_/g, ' ')}
            </Chip>
          </View>

          <View style={styles.metaRow}>
            <IconButton icon="calendar-clock" size={18} disabled />
            <Text variant="bodySmall" style={styles.metaText}>
              {formatDateTime(item.createdAt)}
            </Text>
          </View>

          {payloadContent ? (
            <Card style={styles.dataCard}>
              <Card.Content>
                <Text variant="titleSmall" style={styles.dataTitle}>
                  Payload
                </Text>
                {payloadContent}
              </Card.Content>
            </Card>
          ) : null}

          <View style={styles.actionsRow}>
            <Button
              mode="contained"
              icon={item.read ? 'email-open-outline' : 'email-outline'}
              onPress={() => handleToggleRead(item)}
              loading={isToggleLoading}
              disabled={isToggleLoading || isDeleteLoading}
              style={styles.actionButton}>
              {item.read ? 'Mark Unread' : 'Mark Read'}
            </Button>
            <Button
              mode="outlined"
              icon="delete"
              textColor={theme.colors.error}
              onPress={() => confirmDeleteNotification(item)}
              loading={isDeleteLoading}
              disabled={isDeleteLoading || isToggleLoading}
              style={styles.actionButton}>
              Delete
            </Button>
          </View>
        </Card.Content>
      </Card>
    );
  }, [confirmDeleteNotification, deleteLoadingId, formatDateTime, handleToggleRead, renderPayloadContent, theme.colors.error, theme.colors.onPrimary, theme.colors.onSurfaceVariant, toggleLoadingId]);

  const renderItemSeparator = useCallback(() => <View style={styles.listSeparator} />, []);

  const skeletonItems = useMemo(
    () =>
      Array.from({length: 4}).map((_, index) => (
        <Card key={`skeleton-${index}`} style={styles.card}>
          <Card.Content>
            <View style={[styles.headerRow, styles.skeletonRow]}>
              <View style={styles.headerInfo}>
                <View style={styles.skeletonAvatar} />
                <View style={styles.headerText}>
                  <View style={styles.skeletonLineLarge} />
                  <View style={styles.skeletonLineSmall} />
                </View>
              </View>
              <View style={styles.skeletonChip} />
            </View>

            <View style={styles.skeletonBlock} />
            <View style={[styles.metaRow, styles.skeletonMetaRow]}>
              <View style={styles.skeletonMetaIcon} />
              <View style={styles.skeletonMetaText} />
            </View>
            <View style={styles.skeletonButtonRow}>
              <View style={styles.skeletonButton} />
              <View style={styles.skeletonButton} />
            </View>
          </Card.Content>
        </Card>
      )),
    [],
  );

  const renderEmptyComponent = useCallback(() => (
    <View style={styles.emptyStateContainer}>
      {loading ? (
        <View style={styles.loadingContainer}>
          {skeletonItems}
        </View>
      ) : (
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
      )}
    </View>
  ), [loading, skeletonItems]);

  return (
    <View style={styles.container}>
      <FlatList
        data={notifications}
        keyExtractor={item => item.id}
        renderItem={renderNotificationCard}
        ItemSeparatorComponent={renderItemSeparator}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={renderEmptyComponent}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListFooterComponent={<View style={styles.footerSpacer} />}
      />

      <FAB icon="plus" onPress={() => setComposeVisible(true)} style={styles.fab} />

      <Portal>
        <Dialog visible={composeVisible} onDismiss={closeComposeDialog}>
          <Dialog.Title>Send Notification</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="User ID (optional)"
              value={composePayload.userId}
              onChangeText={text => handleComposeChange('userId', text)}
              style={styles.dialogInput}
              placeholder="Leave blank for broadcast"
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterContent}
              style={styles.dialogChipRow}>
              {NOTIFICATION_TYPES.map(type => (
                <Chip
                  key={type}
                  mode={composePayload.type === type ? 'flat' : 'outlined'}
                  style={styles.dialogChip}
                  onPress={() => handleComposeChange('type', type)}>
                  {TYPE_LABELS[type] ?? type.replace(/_/g, ' ')}
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
              error={Boolean(dataFieldError)}
            />
            {dataFieldError ? (
              <HelperText type="error" visible>
                {dataFieldError}
              </HelperText>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={closeComposeDialog} disabled={composeSubmitting}>
              Cancel
            </Button>
            <Button mode="contained" onPress={handleSendNotification} loading={composeSubmitting}>
              Send
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={Boolean(proofPreviewUri)} onDismiss={closeProofPreview}>
          <Dialog.Title>Payment Proof</Dialog.Title>
          <Dialog.Content>
            {proofPreviewUri ? (
              <Image source={{uri: proofPreviewUri}} style={styles.previewModalImage} resizeMode="contain" />
            ) : null}
          </Dialog.Content>
          <Dialog.Actions style={styles.previewActions}>
            {isRemoteProof ? (
              <Button onPress={handleOpenProofExternally} accessibilityLabel="Open proof in browser">
                Open in Browser
              </Button>
            ) : null}
            <Button onPress={closeProofPreview} mode="contained" style={styles.previewActionButton}>
              Close
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
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 96,
  },
  headerContainer: {
    marginBottom: 16,
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
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flexBasis: '48%',
    flexGrow: 1,
    borderRadius: 16,
    elevation: 2,
    backgroundColor: '#ffffff',
  },
  statContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statIcon: {
    backgroundColor: '#3f51b5',
  },
  statIconPrimary: {
    backgroundColor: '#3f51b5',
  },
  statIconAccent: {
    backgroundColor: '#ff7043',
  },
  statIconInfo: {
    backgroundColor: '#29b6f6',
  },
  statIconSuccess: {
    backgroundColor: '#66bb6a',
  },
  statTextGroup: {
    flexShrink: 1,
  },
  statValue: {
    fontWeight: '700',
  },
  statLabel: {
    color: '#616161',
  },
  searchbar: {
    marginBottom: 12,
  },
  filterScroll: {
    marginBottom: 16,
  },
  filterContent: {
    paddingRight: 16,
  },
  filterChip: {
    marginRight: 8,
  },
  listSeparator: {
    height: 12,
  },
  loadingContainer: {
    paddingVertical: 24,
    gap: 12,
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  card: {
    marginBottom: 0,
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
  readChipText: {
    fontWeight: '600',
  },
  messageText: {
    marginTop: 12,
    marginBottom: 12,
    color: '#424242',
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e0e0e0',
    marginVertical: 12,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  tagChip: {
    backgroundColor: '#e8eaf6',
  },
  tagChipSecondary: {
    backgroundColor: '#f3e5f5',
  },
  tagChipText: {
    fontSize: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: -8,
  },
  metaText: {
    color: '#616161',
  },
  dataCard: {
    marginBottom: 12,
    backgroundColor: '#fafafa',
  },
  dataTitle: {
    marginBottom: 4,
    color: '#666',
  },
  dataList: {},
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dataLabel: {
    color: '#757575',
    fontWeight: '600',
  },
  dataValue: {
    flexShrink: 1,
    textAlign: 'right',
    color: '#333',
  },
  previewContainer: {
    marginTop: 8,
    gap: 8,
  },
  previewTouchable: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f1f3f4',
  },
  previewImage: {
    width: '100%',
    height: 160,
    backgroundColor: '#d1d5db',
  },
  previewModalImage: {
    width: '100%',
    height: 320,
    backgroundColor: '#000',
    borderRadius: 12,
  },
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  previewActionButton: {
    minWidth: 96,
  },
  previewHint: {
    marginTop: 6,
    color: '#3f51b5',
    textAlign: 'center',
    fontWeight: '500',
  },
  jsonText: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
  },
  skeletonRow: {
    alignItems: 'center',
  },
  skeletonAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
  },
  skeletonLineLarge: {
    height: 16,
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    marginBottom: 8,
    width: '70%',
  },
  skeletonLineSmall: {
    height: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 6,
    width: '50%',
  },
  skeletonChip: {
    width: 70,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e0e0e0',
  },
  skeletonBlock: {
    height: 60,
    backgroundColor: '#e0e0e0',
    borderRadius: 12,
    marginVertical: 16,
  },
  skeletonMetaRow: {
    marginBottom: 16,
  },
  skeletonMetaIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e0e0e0',
    marginRight: 8,
  },
  skeletonMetaText: {
    flex: 1,
    height: 14,
    backgroundColor: '#e0e0e0',
    borderRadius: 7,
  },
  skeletonButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  skeletonButton: {
    flex: 1,
    height: 40,
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
  },
  avatar: {
    backgroundColor: '#3f51b5',
  },
  avatarUnread: {
    backgroundColor: '#3f51b5',
  },
  avatarRead: {
    backgroundColor: '#e0e0e0',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#3f51b5',
  },
  footerSpacer: {
    height: 72,
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
  emptyStateContainer: {
    paddingVertical: 32,
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
