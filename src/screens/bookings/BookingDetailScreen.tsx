import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import {
  Text,
  Card,
  useTheme,
  ActivityIndicator,
  Button,
  Chip,
  Divider,
} from 'react-native-paper';
import { RouteProp, useRoute } from '@react-navigation/native';

import { Booking } from '../../types';
import {
  fetchBookingById,
  confirmBooking,
  startBooking,
  completeBooking,
  cancelBooking,
  updateBookingStatus,
} from '../../services/bookingsService';
import { SkeletonBlock } from '../../components/skeletons/Skeleton';

type BookingDetailRouteProp = RouteProp<{ BookingDetail: { bookingId: string; booking?: Booking } }, 'BookingDetail'>;
type ActionKey = 'confirm' | 'start' | 'complete' | 'cancel' | 'no_show';

const STATUS_COLORS: Record<string, string> = {
  pending: '#ff9800',
  confirmed: '#2196f3',
  in_progress: '#9c27b0',
  completed: '#4caf50',
  cancelled: '#f44336',
  no_show: '#795548',
};

const ACTION_DEFINITIONS: Record<
  ActionKey,
  {
    label: string;
    confirmTitle: string;
    confirmMessage: string;
    successMessage: string;
    mode: 'contained' | 'outlined';
  }
> = {
  confirm: {
    label: 'Mark Confirmed',
    confirmTitle: 'Confirm Booking',
    confirmMessage: 'Are you sure you want to mark this booking as confirmed?',
    successMessage: 'Booking marked as confirmed.',
    mode: 'contained',
  },
  start: {
    label: 'Start Service',
    confirmTitle: 'Start Booking',
    confirmMessage: 'Start this booking and mark it as in progress?',
    successMessage: 'Booking marked as in progress.',
    mode: 'contained',
  },
  complete: {
    label: 'Mark Completed',
    confirmTitle: 'Complete Booking',
    confirmMessage: 'Complete this booking and mark the service as finished?',
    successMessage: 'Booking marked as completed.',
    mode: 'contained',
  },
  cancel: {
    label: 'Cancel Booking',
    confirmTitle: 'Cancel Booking',
    confirmMessage: 'Cancel this booking? This action cannot be undone.',
    successMessage: 'Booking cancelled successfully.',
    mode: 'outlined',
  },
  no_show: {
    label: 'Mark No Show',
    confirmTitle: 'No Show',
    confirmMessage: 'Mark this booking as a no-show?',
    successMessage: 'Booking marked as no-show.',
    mode: 'outlined',
  },
};

export default function BookingDetailScreen() {
  const theme = useTheme();
  const route = useRoute<BookingDetailRouteProp>();
  const { bookingId, booking: initialBookingParam } = route.params;

  const [booking, setBooking] = useState<Booking | null>(initialBookingParam ?? null);
  const [loading, setLoading] = useState(!initialBookingParam);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<ActionKey | null>(null);

  const mergeBookingData = useCallback((existing: Booking | null, incoming: Booking): Booking => {
    if (!existing) {
      return incoming;
    }

    return {
      ...existing,
      ...incoming,
      parentId: {
        name: incoming.parentId?.name || existing.parentId.name,
        email: incoming.parentId?.email || existing.parentId.email,
      },
      caregiverId: {
        name: incoming.caregiverId?.name || existing.caregiverId.name,
        email: incoming.caregiverId?.email || existing.caregiverId.email,
      },
      jobId: {
        title: incoming.jobId?.title || existing.jobId.title,
        location: incoming.jobId?.location || existing.jobId.location,
      },
      selectedChildren: incoming.selectedChildren ?? existing.selectedChildren,
      emergencyContact: incoming.emergencyContact ?? existing.emergencyContact,
      specialInstructions: incoming.specialInstructions ?? existing.specialInstructions,
      contactPhone: incoming.contactPhone ?? existing.contactPhone,
      serviceDate: incoming.serviceDate ?? existing.serviceDate,
      startTime: incoming.startTime ?? existing.startTime,
      endTime: incoming.endTime ?? existing.endTime,
      timeDisplay: incoming.timeDisplay ?? existing.timeDisplay,
    };
  }, []);

  useEffect(() => {
    if (initialBookingParam) {
      setBooking((prev) => mergeBookingData(prev, initialBookingParam));
      setLoading(false);
    }
  }, [initialBookingParam, mergeBookingData]);

  const loadBooking = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    }

    try {
      const data = await fetchBookingById(bookingId);
      setBooking((prev) => mergeBookingData(prev, data));
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load booking details.';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [bookingId]);

  useEffect(() => {
    loadBooking({ silent: !!initialBookingParam });
  }, [initialBookingParam, loadBooking]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadBooking({ silent: true });
  }, [loadBooking]);

  const availableActions = useMemo<ActionKey[]>(() => {
    if (!booking) {
      return [];
    }

    switch (booking.status) {
      case 'pending':
        return ['confirm', 'cancel'];
      case 'confirmed':
        return ['start', 'cancel'];
      case 'in_progress':
        return ['complete', 'cancel', 'no_show'];
      default:
        return [];
    }
  }, [booking]);

  const formatDate = useCallback((value: string | null | undefined) => {
    if (!value) {
      return 'TBD';
    }
    return new Date(value).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, []);

  const formatDateTime = useCallback((value: string | null | undefined) => {
    if (!value) {
      return 'TBD';
    }
    return new Date(value).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }, []);

  const formatCurrency = useCallback((amount: number | null | undefined) => {
    if (!amount) {
      return '₱0.00';
    }
    return `₱${amount.toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }, []);

  const formatTime = useCallback((time: string | null | undefined) => {
    if (!time) {
      return 'TBD';
    }
    const [hours, minutes] = time.split(':');
    const date = new Date();
    date.setHours(Number(hours), Number(minutes ?? 0), 0, 0);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  }, []);

  const resolvedServiceDate = booking?.serviceDate ?? booking?.startDate ?? null;
  const resolvedTimeRange = useMemo(() => {
    if (!booking) {
      return 'TBD';
    }
    if (booking.timeDisplay) {
      return booking.timeDisplay;
    }
    const start = formatTime(booking.startTime);
    const end = formatTime(booking.endTime);
    return `${start} → ${end}`;
  }, [booking, formatTime]);

  const executeAction = useCallback(async (action: ActionKey) => {
    setActionLoading(action);

    try {
      switch (action) {
        case 'confirm':
          await confirmBooking(bookingId);
          break;
        case 'start':
          await startBooking(bookingId);
          break;
        case 'complete':
          await completeBooking(bookingId);
          break;
        case 'cancel':
          await cancelBooking(bookingId);
          break;
        case 'no_show':
          await updateBookingStatus(bookingId, 'no_show');
          break;
        default:
          break;
      }

      await loadBooking({ silent: true });
      Alert.alert('Success', ACTION_DEFINITIONS[action].successMessage);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Operation failed.';
      Alert.alert('Error', message);
    } finally {
      setActionLoading(null);
    }
  }, [bookingId, loadBooking]);

  const handleActionPress = useCallback((action: ActionKey) => {
    const config = ACTION_DEFINITIONS[action];

    Alert.alert(config.confirmTitle, config.confirmMessage, [
      { text: 'Dismiss', style: 'cancel' },
      {
        text: 'Confirm',
        style: 'default',
        onPress: () => executeAction(action),
      },
    ]);
  }, [executeAction]);

  const renderActions = useMemo(() => {
    if (!booking || availableActions.length === 0) {
      return (
        <Text variant="bodyMedium" style={styles.actionsEmpty}>
          No further actions are available for this booking.
        </Text>
      );
    }

    return availableActions.map((action) => {
      const config = ACTION_DEFINITIONS[action];
      return (
        <Button
          key={action}
          mode={config.mode}
          onPress={() => handleActionPress(action)}
          loading={actionLoading === action}
          disabled={!!actionLoading}
          style={styles.actionButton}
        >
          {config.label}
        </Button>
      );
    });
  }, [actionLoading, availableActions, handleActionPress, booking]);

  const renderInitialSkeleton = () => (
    <View style={styles.skeletonContainer}>
      <Card style={styles.sectionCard}>
        <Card.Content style={styles.skeletonContent}>
          <SkeletonBlock height={24} width="60%" />
          <SkeletonBlock height={16} width="80%" />
          <SkeletonBlock height={16} width="50%" />
        </Card.Content>
      </Card>
      <Card style={styles.sectionCard}>
        <Card.Content style={styles.skeletonContent}>
          <SkeletonBlock height={20} width="40%" />
          <SkeletonBlock height={14} width="70%" />
          <SkeletonBlock height={14} width="70%" />
          <SkeletonBlock height={14} width="60%" />
        </Card.Content>
      </Card>
      <Card style={styles.sectionCard}>
        <Card.Content style={styles.skeletonContent}>
          <SkeletonBlock height={20} width="50%" />
          <SkeletonBlock height={14} width="80%" />
        </Card.Content>
      </Card>
    </View>
  );

  const renderErrorState = () => (
    <View style={styles.errorContainer}>
      <Card style={styles.sectionCard}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.errorTitle}>
            Unable to load booking
          </Text>
          <Text variant="bodyMedium" style={styles.errorMessage}>
            {error}
          </Text>
          <Button mode="contained" onPress={() => loadBooking()} style={styles.retryButton}>
            Retry
          </Button>
        </Card.Content>
      </Card>
    </View>
  );

  const isInitialLoading = loading && !booking && !error;

  if (isInitialLoading) {
    return <View style={styles.container}>{renderInitialSkeleton()}</View>;
  }

  if (error && !booking) {
    return <View style={styles.container}>{renderErrorState()}</View>;
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {booking ? (
        <>
          <Card style={styles.sectionCard}>
            <Card.Content>
              <View style={styles.headerRow}>
                <Text variant="headlineMedium" style={styles.headerTitle}>
                  {booking.jobId.title}
                </Text>
                <Chip
                  style={[
                    styles.statusChip,
                    { backgroundColor: STATUS_COLORS[booking.status] || theme.colors.primary },
                  ]}
                  textStyle={styles.statusChipLabel}
                >
                  {booking.status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())}
                </Chip>
              </View>

              <Text variant="bodyMedium" style={styles.subtitle}>
                {booking.jobId.location}
              </Text>

              <Divider style={styles.sectionDivider} />

              <View style={styles.infoRow}>
                <View style={styles.infoColumn}>
                  <Text variant="titleSmall" style={styles.sectionLabel}>
                    Schedule
                  </Text>
                  <Text variant="bodyMedium" style={styles.infoValue}>
                    Service Date: {formatDate(resolvedServiceDate)}
                  </Text>
                  <Text variant="bodyMedium" style={styles.infoValue}>
                    Time: {resolvedTimeRange}
                  </Text>
                  <Text variant="bodyMedium" style={styles.infoValue}>
                    Total hours: {booking.totalHours}
                  </Text>
                </View>
                <View style={styles.infoColumn}>
                  <Text variant="titleSmall" style={styles.sectionLabel}>
                    Compensation
                  </Text>
                  <Text variant="bodyMedium" style={styles.infoValue}>
                    Hourly rate: {formatCurrency(booking.hourlyRate)}
                  </Text>
                  <Text variant="bodyMedium" style={styles.infoValue}>
                    Estimated total: {formatCurrency(booking.totalAmount)}
                  </Text>
                </View>
              </View>
            </Card.Content>
          </Card>

          <Card style={styles.sectionCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Participants
              </Text>
              <View style={styles.participantRow}>
                <View style={styles.participantColumn}>
                  <Text variant="titleSmall" style={styles.sectionLabel}>
                    Parent
                  </Text>
                  <Text variant="bodyMedium" style={styles.infoValue}>
                    {booking.parentId.name}
                  </Text>
                  <Text variant="bodySmall" style={styles.infoHint}>
                    {booking.parentId.email}
                  </Text>
                </View>
                <View style={styles.participantColumn}>
                  <Text variant="titleSmall" style={styles.sectionLabel}>
                    Caregiver
                  </Text>
                  <Text variant="bodyMedium" style={styles.infoValue}>
                    {booking.caregiverId.name}
                  </Text>
                  <Text variant="bodySmall" style={styles.infoHint}>
                    {booking.caregiverId.email}
                  </Text>
                </View>
              </View>
            </Card.Content>
          </Card>

          {(booking.contactPhone || booking.emergencyContact || booking.specialInstructions) && (
            <Card style={styles.sectionCard}>
              <Card.Content>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  Contact & Notes
                </Text>
                {booking.contactPhone ? (
                  <Text variant="bodyMedium" style={styles.infoValue}>
                    Phone: {booking.contactPhone}
                  </Text>
                ) : null}
                {booking.emergencyContact ? (
                  <View style={styles.contactRow}>
                    <Text variant="bodyMedium" style={styles.infoValue}>
                      Emergency Contact:
                    </Text>
                    <Text variant="bodySmall" style={styles.infoHint}>
                      {booking.emergencyContact.name ?? 'Unnamed'} · {booking.emergencyContact.phone ?? 'No phone'}
                      {booking.emergencyContact.relation ? ` (${booking.emergencyContact.relation})` : ''}
                    </Text>
                  </View>
                ) : null}
                {booking.specialInstructions ? (
                  <View style={styles.notesBlock}>
                    <Text variant="titleSmall" style={styles.sectionLabel}>
                      Special Instructions
                    </Text>
                    <Text variant="bodyMedium" style={styles.infoValue}>
                      {booking.specialInstructions}
                    </Text>
                  </View>
                ) : null}
              </Card.Content>
            </Card>
          )}

          {booking.selectedChildren && booking.selectedChildren.length > 0 && (
            <Card style={styles.sectionCard}>
              <Card.Content>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  Children
                </Text>
                <View style={styles.childList}>
                  {booking.selectedChildren.map((child, index) => (
                    <View key={`${child?.name ?? 'child'}-${index}`} style={styles.childCard}>
                      <Text variant="titleSmall" style={styles.childTitle}>
                        {child?.name ?? `Child ${index + 1}`}
                      </Text>
                      <Text variant="bodySmall" style={styles.childMeta}>
                        {child?.age !== undefined ? `Age ${child.age}` : 'Age TBD'}
                      </Text>
                      {child?.allergies ? (
                        <Text variant="bodySmall" style={styles.infoHint}>
                          Allergies: {child.allergies}
                        </Text>
                      ) : null}
                      {child?.preferences ? (
                        <Text variant="bodySmall" style={styles.infoHint}>
                          Preferences: {child.preferences}
                        </Text>
                      ) : null}
                      {child?.specialInstructions ? (
                        <Text variant="bodySmall" style={styles.infoHint}>
                          Notes: {child.specialInstructions}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              </Card.Content>
            </Card>
          )}

          <Card style={styles.sectionCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Timeline
              </Text>
              <Text variant="bodyMedium" style={styles.infoValue}>
                Created: {formatDateTime(booking.createdAt)}
              </Text>
              <Text variant="bodyMedium" style={styles.infoValue}>
                Updated: {formatDateTime(booking.updatedAt)}
              </Text>
            </Card.Content>
          </Card>

          <Card style={styles.sectionCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Quick Actions
              </Text>
              <View style={styles.actionsContainer}>{renderActions}</View>
            </Card.Content>
          </Card>
        </>
      ) : (
        <View style={styles.loadingFallback}>
          <ActivityIndicator />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  scroll: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 24,
  },
  sectionCard: {
    borderRadius: 16,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerTitle: {
    flex: 1,
    fontWeight: 'bold',
  },
  subtitle: {
    marginTop: 8,
    color: '#616161',
  },
  sectionDivider: {
    marginVertical: 16,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  infoColumn: {
    flex: 1,
    minWidth: 140,
    gap: 6,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 12,
  },
  sectionLabel: {
    fontWeight: '600',
  },
  infoValue: {
    color: '#424242',
  },
  infoHint: {
    color: '#757575',
  },
  participantRow: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  participantColumn: {
    flex: 1,
    minWidth: 160,
    gap: 4,
  },
  contactRow: {
    marginTop: 8,
    gap: 4,
  },
  notesBlock: {
    marginTop: 12,
    gap: 6,
  },
  actionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionButton: {
    flexGrow: 1,
    minWidth: 140,
  },
  actionsEmpty: {
    color: '#616161',
  },
  statusChip: {
    borderRadius: 999,
  },
  statusChipLabel: {
    color: '#fff',
    fontWeight: '600',
  },
  skeletonContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 16,
  },
  skeletonContent: {
    gap: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  errorTitle: {
    fontWeight: '600',
    marginBottom: 8,
  },
  errorMessage: {
    color: '#616161',
    marginBottom: 16,
  },
  retryButton: {
    alignSelf: 'flex-start',
  },
  loadingFallback: {
    padding: 24,
    alignItems: 'center',
  },
  childList: {
    gap: 12,
  },
  childCard: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    gap: 4,
  },
  childTitle: {
    fontWeight: '600',
  },
  childMeta: {
    color: '#616161',
  },
});
