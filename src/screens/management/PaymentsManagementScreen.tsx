import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  Button,
  Card,
  Chip,
  Dialog,
  FAB,
  Portal,
  Searchbar,
  Surface,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {PanGestureHandler, PinchGestureHandler, State} from 'react-native-gesture-handler';
import {Icon} from 'react-native-elements';
import {PaymentProofInfo, PaymentProofSummary, PaymentRecord, PaymentStatus} from '../../types';
import {
  fetchPayments,
  updatePaymentStatus,
  refundPayment,
} from '../../services/paymentsService';

const AnimatedImage = Animated.createAnimatedComponent(Image);
const WINDOW = Dimensions.get('window');
const PREVIEW_MAX_WIDTH = Math.min(WINDOW.width * 0.9, 500);
const PREVIEW_MAX_HEIGHT = Math.min(WINDOW.height * 0.6, 500);
const LAST_PROOF_STORAGE_KEY = 'payments:lastProof';

type ProofEntry = {
  id: string;
  url: string;
  mimeType?: string | null;
  uploadedAt?: string | null;
  uploadedBy?: string | null;
  paymentId: string;
};

const STATUS_FILTERS: Array<{label: string; value: PaymentStatus | 'all'; icon: string; color: string}> = [
  {label: 'All', value: 'all', icon: 'select-all', color: '#616161'},
  {label: 'Pending', value: 'pending', icon: 'clock-outline', color: '#ff9800'},
  {label: 'Paid', value: 'paid', icon: 'check-circle', color: '#4caf50'},
  {label: 'Refunded', value: 'refunded', icon: 'undo', color: '#2196f3'},
  {label: 'Disputed', value: 'disputed', icon: 'gavel', color: '#f44336'},
];

type DebouncedValue<T> = {
  value: T;
};

function useDebouncedValue<T>(input: T, delay = 400): T {
  const [debounced, setDebounced] = useState<T>(input);

  useEffect(() => {
    const handler = setTimeout(() => setDebounced(input), delay);
    return () => clearTimeout(handler);
  }, [delay, input]);

  return debounced;
}

interface PaymentStats {
  total: number;
  pending: number;
  paid: number;
  refunded: number;
  disputed: number;
}

const SKELETON_COUNT = 4;

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
};

export default function PaymentsManagementScreen() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [proofSummary, setProofSummary] = useState<PaymentProofSummary | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'all'>('all');
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [saveLoadingId, setSaveLoadingId] = useState<string | null>(null);
  const [refundLoadingId, setRefundLoadingId] = useState<string | null>(null);
  const [refundDialog, setRefundDialog] = useState<{visible: boolean; paymentId: string | null; reason: string}>(
    {visible: false, paymentId: null, reason: ''},
  );
  const [proofPreview, setProofPreview] = useState<{visible: boolean; proofs: ProofEntry[]; index: number}>(
    {visible: false, proofs: [], index: 0},
  );
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [lastViewedProof, setLastViewedProof] = useState<{paymentId: string; proofId: string} | null>(null);
  const theme = useTheme();

  const debouncedSearch = useDebouncedValue(searchQuery);
  const pinchScale = useRef(new Animated.Value(1)).current;
  const baseScale = useRef(new Animated.Value(1)).current;
  const scale = Animated.multiply(baseScale, pinchScale);
  const lastScale = useRef(1);
  const pinchRef = useRef(null);
  const panRef = useRef(null);

  const resetPreviewTransforms = useCallback(() => {
    baseScale.setValue(1);
    pinchScale.setValue(1);
    lastScale.current = 1;
  }, [baseScale, pinchScale]);

  const getProofEntries = useCallback((payment: PaymentRecord): ProofEntry[] => {
    const result: ProofEntry[] = [];
    const rawProofs = (payment as unknown as {proofs?: PaymentProofInfo[]}).proofs;

    if (Array.isArray(rawProofs) && rawProofs.length > 0) {
      rawProofs.forEach((proof, index) => {
        const url = proof.publicUrl ?? proof.storagePath ?? null;
        if (!url) {
          return;
        }
        result.push({
          id: String(proof.id ?? `${payment.id}-proof-${index}`),
          url,
          mimeType: proof.mimeType ?? undefined,
          uploadedAt: proof.uploadedAt ?? undefined,
          uploadedBy: proof.uploadedBy ?? undefined,
          paymentId: payment.id,
        });
      });
    } else if (payment.paymentProof) {
      result.push({
        id: `${payment.id}-proof`,
        url: payment.paymentProof,
        uploadedAt: payment.updatedAt,
        paymentId: payment.id,
      });
    }

    return result;
  }, []);

  const persistLastViewedProof = useCallback((paymentId: string, proofId: string) => {
    setLastViewedProof({paymentId, proofId});
    AsyncStorage.setItem(LAST_PROOF_STORAGE_KEY, JSON.stringify({paymentId, proofId})).catch(() => {});
  }, []);

  const openProofPreview = useCallback(
    (payment: PaymentRecord, startIndex: number) => {
      const entries = getProofEntries(payment);
      if (!entries.length) {
        Alert.alert('Proof unavailable', 'No proof is attached to this payment yet.');
        return;
      }
      const initialIndex = Math.min(Math.max(startIndex, 0), entries.length - 1);
      setPreviewError(null);
      resetPreviewTransforms();
      setProofPreview({visible: true, proofs: entries, index: initialIndex});
      const selected = entries[initialIndex];
      if (selected?.id) {
        persistLastViewedProof(payment.id, selected.id);
      }
    },
    [getProofEntries, persistLastViewedProof, resetPreviewTransforms],
  );

  const changeProofIndex = useCallback(
    (direction: number) => {
      const normalized = direction > 0 ? 1 : -1;
      setProofPreview(prev => {
        if (!prev.visible) {
          return prev;
        }
        const nextIndex = prev.index + normalized;
        if (nextIndex < 0 || nextIndex >= prev.proofs.length) {
          return prev;
        }
        const nextProof = prev.proofs[nextIndex];
        resetPreviewTransforms();
        setPreviewError(null);
        if (nextProof?.id) {
          persistLastViewedProof(nextProof.paymentId, nextProof.id);
        }
        return {...prev, index: nextIndex};
      });
    },
    [persistLastViewedProof, resetPreviewTransforms],
  );

  const closeProofPreview = useCallback(() => {
    setProofPreview(prev => ({...prev, visible: false}));
  }, []);

  const handleOpenProofInBrowser = useCallback(() => {
    const current = proofPreview.proofs[proofPreview.index];
    if (!current?.url) {
      Alert.alert('No proof link available');
      return;
    }
    Linking.openURL(current.url).catch(() => {
      Alert.alert('Unable to open proof link');
    });
  }, [proofPreview]);

  const handlePanStateChange = useCallback(
    (event: any) => {
      if (event.nativeEvent.state === State.END || event.nativeEvent.state === State.CANCELLED) {
        if (lastScale.current > 1.05) {
          return;
        }
        const translationX = event.nativeEvent.translationX || 0;
        if (translationX > 60) {
          changeProofIndex(-1);
        } else if (translationX < -60) {
          changeProofIndex(1);
        }
      }
    },
    [changeProofIndex],
  );

  const onPinchEvent = useMemo(
    () =>
      Animated.event([{nativeEvent: {scale: pinchScale}}], {
        useNativeDriver: true,
      }),
    [pinchScale],
  );

  const onPinchStateChange = useCallback(
    (event: any) => {
      if (event.nativeEvent.oldState === State.ACTIVE) {
        let nextScale = lastScale.current * event.nativeEvent.scale;
        nextScale = Math.min(Math.max(nextScale, 1), 4);
        lastScale.current = nextScale;
        baseScale.setValue(nextScale);
        pinchScale.setValue(1);
      }
    },
    [baseScale, pinchScale],
  );

  const formatOptionalDateTime = useCallback(
    (value?: string | null) => (value ? formatDateTime(value) : 'Unknown'),
    [],
  );

  const clearLastViewedProof = useCallback(() => {
    setLastViewedProof(null);
    AsyncStorage.removeItem(LAST_PROOF_STORAGE_KEY).catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(LAST_PROOF_STORAGE_KEY)
      .then(value => {
        if (!value) {
          return;
        }
        try {
          const parsed = JSON.parse(value);
          if (parsed?.paymentId && parsed?.proofId) {
            setLastViewedProof(parsed);
          }
        } catch (error) {
          console.warn('Failed to parse last proof cache', error);
        }
      })
      .catch(() => {});
  }, []);

  const loadPayments = useCallback(
    async (options?: {silent?: boolean}) => {
      try {
        if (!options?.silent) {
          setLoading(true);
        }
        const {payments: fetchedPayments, proofSummary: summary} = await fetchPayments({
          status: statusFilter,
          search: debouncedSearch.trim() ? debouncedSearch : undefined,
        });
        const paymentList = Array.isArray(fetchedPayments) ? fetchedPayments : [];
        setPayments(paymentList);
        setProofSummary(summary ?? undefined);
        setNoteDrafts(prev => {
          const next: Record<string, string> = {};
          paymentList.forEach(payment => {
            next[payment.id] = prev[payment.id] ?? payment.notes ?? '';
          });
          return next;
        });
        if (lastViewedProof) {
          const candidatePayment = paymentList.find(payment => payment.id === lastViewedProof.paymentId);
          const candidateProofs = candidatePayment ? getProofEntries(candidatePayment) : [];
          if (!candidateProofs.some(proof => proof.id === lastViewedProof.proofId)) {
            clearLastViewedProof();
          }
        }
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Failed to load payments');
        setPayments([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [debouncedSearch, statusFilter],
  );

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const filteredPayments = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) {
      return payments;
    }
    return payments.filter(payment => {
      return (
        payment.parentInfo.name?.toLowerCase().includes(q) ||
        payment.parentInfo.email?.toLowerCase().includes(q) ||
        payment.caregiverInfo.name?.toLowerCase().includes(q) ||
        payment.caregiverInfo.email?.toLowerCase().includes(q) ||
        payment.bookingId.toLowerCase().includes(q)
      );
    });
  }, [debouncedSearch, payments]);

  const stats = useMemo<PaymentStats>(() => {
    return payments.reduce(
      (acc, payment) => {
        acc.total += 1;
        acc[payment.paymentStatus] += 1;
        return acc;
      },
      {
        total: 0,
        pending: 0,
        paid: 0,
        refunded: 0,
        disputed: 0,
      },
    );
  }, [payments]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadPayments({silent: true});
  }, [loadPayments]);

  const handleNoteChange = useCallback((paymentId: string, text: string) => {
    setNoteDrafts(prev => ({...prev, [paymentId]: text}));
  }, []);

  const handleStatusUpdate = useCallback(
    async (payment: PaymentRecord, nextStatus: PaymentStatus) => {
      const note = (noteDrafts[payment.id] ?? '').trim();
      if (!note) {
        Alert.alert('Missing notes', 'Please document the reason in the notes field before updating status.');
        return;
      }

      try {
        setSaveLoadingId(payment.id);
        await updatePaymentStatus(payment.id, nextStatus, note);
        setNoteDrafts(prev => ({...prev, [payment.id]: ''}));
        await loadPayments({silent: true});
        Alert.alert('Success', `Payment marked as ${nextStatus}.`);
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Failed to update payment status');
      } finally {
        setSaveLoadingId(null);
      }
    },
    [loadPayments, noteDrafts],
  );

  const openRefundDialog = useCallback((paymentId: string) => {
    setRefundDialog({visible: true, paymentId, reason: ''});
  }, []);

  const handleRefund = useCallback(async () => {
    const paymentId = refundDialog.paymentId;
    if (!paymentId) {
      return;
    }

    try {
      setRefundLoadingId(paymentId);
      const reason = (refundDialog.reason ?? '').trim();
      await refundPayment(paymentId, reason);
      setRefundDialog({visible: false, paymentId: null, reason: ''});
      await loadPayments({silent: true});
      Alert.alert('Success', 'Refund initiated successfully.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to process refund');
    } finally {
      setRefundLoadingId(null);
    }
  }, [loadPayments, refundDialog]);

  const getStatusMetric = useCallback(
    (value: PaymentStatus | 'all') => (value === 'all' ? stats.total : stats[value]),
    [stats],
  );

  const renderStatsCard = useCallback(
    (icon: string, label: string, value: number, color: string) => (
      <Surface key={label} style={styles.statCard} elevation={2}>
        <View style={styles.statIconWrapper}>
          <Icon name={icon} type="material-community" color={color} size={28} />
        </View>
        <Text variant="titleMedium" style={styles.statValue}>
          {value.toLocaleString()}
        </Text>
        <Text variant="bodySmall" style={styles.statLabel}>
          {label}
        </Text>
      </Surface>
    ),
    [],
  );

  const renderListHeader = useCallback(() => (
    <View style={styles.headerContainer}>
      <Text variant="headlineMedium" style={styles.title}>
        Payments Management
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Track caregiver payouts, resolve disputes, and manage refunds.
      </Text>

      <View style={styles.statsContainer}>
        {renderStatsCard('wallet-outline', 'Total payments', stats.total, theme.colors.primary)}
        {renderStatsCard('clock-outline', 'Pending', stats.pending, '#ff9800')}
        {renderStatsCard('check-circle-outline', 'Paid', stats.paid, '#4caf50')}
        {renderStatsCard('cash-refund', 'Refunded', stats.refunded, '#2196f3')}
      </View>

      <Searchbar
        placeholder="Search payments by user or booking"
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={styles.searchbar}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {STATUS_FILTERS.map(filter => (
          <Chip
            key={filter.value}
            icon={filter.icon}
            mode={statusFilter === filter.value ? 'flat' : 'outlined'}
            style={styles.filterChip}
            selected={statusFilter === filter.value}
            onPress={() => setStatusFilter(filter.value)}>
            {`${filter.label} (${getStatusMetric(filter.value)})`}
          </Chip>
        ))}
      </ScrollView>
    </View>
  ), [getStatusMetric, renderStatsCard, searchQuery, stats, statusFilter, theme.colors.primary]);

  const renderPaymentCard = useCallback(
    ({item}: {item: PaymentRecord}) => {
      const noteValue = noteDrafts[item.id] ?? '';
      const showExistingNotes = item.notes && item.notes.trim().length > 0;

      return (
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.headerRow}>
              <View style={styles.headerInfo}>
                <Icon name="credit-card-outline" type="material-community" color={theme.colors.primary} size={26} />
                <View style={styles.headerText}>
                  <Text variant="titleMedium">Booking {item.bookingId}</Text>
                  <Text variant="bodySmall" style={styles.subtleText}>
                    Parent: {item.parentInfo.name ?? 'Unknown'} • Caregiver: {item.caregiverInfo.name ?? 'Unknown'}
                  </Text>
                </View>
              </View>
              <Chip style={styles.statusChip} icon="information-outline">
                {item.paymentStatus.toUpperCase()}
              </Chip>
            </View>

            <View style={styles.amountRow}>
              <Text variant="headlineSmall" style={styles.amountText}>
                ₱{item.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}
              </Text>
              <Text variant="bodySmall" style={styles.subtleText}>
                Created {formatDateTime(item.createdAt)}
              </Text>
            </View>

            {showExistingNotes ? (
              <Card style={styles.notesCard}>
                <Card.Content>
                  <Text variant="titleSmall" style={styles.notesTitle}>
                    Existing notes
                  </Text>
                  <Text variant="bodySmall">{item.notes}</Text>
                </Card.Content>
              </Card>
            ) : null}

            <TextInput
              mode="outlined"
              label="Admin notes"
              placeholder="Document reason for changes"
              value={noteValue}
              onChangeText={text => handleNoteChange(item.id, text)}
              style={styles.notesInput}
              multiline
            />

            <View style={styles.actionsRow}>
              {item.paymentStatus !== 'paid' ? (
                <Button
                  mode="contained"
                  icon="check"
                  onPress={() => handleStatusUpdate(item, 'paid')}
                  style={styles.actionButton}
                  loading={saveLoadingId === item.id}
                  disabled={saveLoadingId === item.id || refundLoadingId === item.id}>
                  Mark Paid
                </Button>
              ) : null}
              {item.paymentStatus !== 'disputed' ? (
                <Button
                  mode="outlined"
                  icon="gavel"
                  onPress={() => handleStatusUpdate(item, 'disputed')}
                  style={styles.actionButton}
                  loading={saveLoadingId === item.id}
                  disabled={saveLoadingId === item.id || refundLoadingId === item.id}>
                  Flag Dispute
                </Button>
              ) : null}
              {item.paymentStatus !== 'refunded' ? (
                <Button
                  mode="outlined"
                  icon="undo"
                  onPress={() => openRefundDialog(item.id)}
                  style={styles.actionButton}
                  textColor={theme.colors.error}
                  disabled={refundLoadingId === item.id || saveLoadingId === item.id}>
                  Refund
                </Button>
              ) : null}
            </View>
          </Card.Content>
        </Card>
      );
    },
    [handleNoteChange, handleStatusUpdate, noteDrafts, openRefundDialog, refundLoadingId, saveLoadingId, theme.colors.error, theme.colors.primary],
  );

  const renderSkeletons = useMemo(
    () => (
      <View style={styles.skeletonContainer}>
        {Array.from({length: SKELETON_COUNT}).map((_, index) => (
          <Surface key={`payment-skeleton-${index}`} style={styles.card} elevation={2}>
            <View style={styles.skeletonCardContent}>
              <View style={[styles.skeletonLine, styles.skeletonLineWide]} />
              <View style={[styles.skeletonLine, styles.skeletonLineMedium]} />
              <View style={[styles.skeletonBlock, styles.skeletonAmount]} />
              <View style={[styles.skeletonBlock, styles.skeletonNotes]} />
              <View style={styles.skeletonActionRow}>
                <View style={[styles.skeletonBlock, styles.skeletonButton]} />
                <View style={[styles.skeletonBlock, styles.skeletonButton]} />
                <View style={[styles.skeletonBlock, styles.skeletonButton]} />
              </View>
            </View>
          </Surface>
        ))}
      </View>
    ),
    [],
  );

  const renderEmptyComponent = useCallback(() => {
    if (loading) {
      return renderSkeletons;
    }

    return (
      <Card style={styles.emptyCard}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.emptyTitle}>
            No payments found
          </Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            Try refreshing or adjusting your filters.
          </Text>
        </Card.Content>
      </Card>
    );
  }, [loading, renderSkeletons]);

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredPayments}
        keyExtractor={item => item.id}
        renderItem={renderPaymentCard}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={renderEmptyComponent}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      />

      <FAB icon="refresh" onPress={() => loadPayments()} style={styles.fab} disabled={loading} />

      <Portal>
        <Dialog visible={refundDialog.visible} onDismiss={() => setRefundDialog({visible: false, paymentId: null, reason: ''})}>
          <Dialog.Title>Initiate Refund</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Reason"
              value={refundDialog.reason}
              onChangeText={text => setRefundDialog(prev => ({...prev, reason: text}))}
              style={styles.dialogInput}
              placeholder="Provide details for the refund"
              multiline
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRefundDialog({visible: false, paymentId: null, reason: ''})}>
              Cancel
            </Button>
            <Button mode="contained" onPress={handleRefund} loading={refundLoadingId === refundDialog.paymentId} disabled={refundLoadingId === refundDialog.paymentId}>
              Confirm
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
  listContent: {
    padding: 16,
    paddingBottom: 96,
  },
  listSeparator: {
    height: 16,
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
  searchbar: {
    marginBottom: 12,
  },
  filterRow: {
    marginBottom: 16,
  },
  filterChip: {
    marginRight: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  statCard: {
    flexGrow: 1,
    flexBasis: '48%',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  statIconWrapper: {
    alignSelf: 'flex-start',
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f0ff',
    marginBottom: 12,
  },
  statValue: {
    fontWeight: 'bold',
    color: '#212121',
  },
  statLabel: {
    color: '#757575',
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
  statusChip: {
    backgroundColor: '#e0e0e0',
  },
  amountRow: {
    marginTop: 12,
    marginBottom: 12,
  },
  amountText: {
    fontWeight: 'bold',
    color: '#212121',
  },
  notesCard: {
    backgroundColor: '#f9fbe7',
    marginBottom: 12,
  },
  notesTitle: {
    marginBottom: 4,
    color: '#827717',
  },
  notesInput: {
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionButton: {
    flexGrow: 1,
    marginRight: 8,
    marginBottom: 8,
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
  skeletonContainer: {
    gap: 16,
  },
  skeletonCardContent: {
    padding: 16,
    gap: 12,
  },
  skeletonLine: {
    height: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 6,
  },
  skeletonLineWide: {
    width: '70%',
  },
  skeletonLineMedium: {
    width: '50%',
  },
  skeletonBlock: {
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
  },
  skeletonAmount: {
    height: 28,
    width: '60%',
  },
  skeletonNotes: {
    height: 80,
    width: '100%',
  },
  skeletonActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  skeletonButton: {
    flex: 1,
    height: 36,
  },
});
