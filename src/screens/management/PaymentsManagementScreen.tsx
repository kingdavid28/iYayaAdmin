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
import {PaymentRecord, PaymentStatus} from '../../types';
import {
  fetchPayments,
  updatePaymentStatus,
  refundPayment,
} from '../../services/paymentsService';

const STATUS_FILTERS: Array<{label: string; value: PaymentStatus | 'all'; icon: string; color: string}> = [
  {label: 'All', value: 'all', icon: 'select-all', color: '#616161'},
  {label: 'Pending', value: 'pending', icon: 'schedule', color: '#ff9800'},
  {label: 'Paid', value: 'paid', icon: 'check-circle', color: '#4caf50'},
  {label: 'Refunded', value: 'refunded', icon: 'undo', color: '#2196f3'},
  {label: 'Disputed', value: 'disputed', icon: 'gavel', color: '#f44336'},
];

export default function PaymentsManagementScreen() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'all'>('all');
  const [notes, setNotes] = useState('');
  const [refundDialog, setRefundDialog] = useState<{visible: boolean; paymentId: string | null; reason: string}>(
    {visible: false, paymentId: null, reason: ''},
  );
  const theme = useTheme();

  const loadPayments = useCallback(async () => {
    try {
      if (!refreshing) {
        setLoading(true);
      }
      const fetchedPayments = await fetchPayments({
        status: statusFilter,
        search: searchQuery.trim() || undefined,
      });
      setPayments(fetchedPayments);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load payments');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing, searchQuery, statusFilter]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const filteredPayments = useMemo(() => {
    if (!searchQuery.trim()) {
      return payments;
    }
    const q = searchQuery.toLowerCase();
    return payments.filter(payment => {
      return (
        payment.parentInfo.name?.toLowerCase().includes(q) ||
        payment.parentInfo.email?.toLowerCase().includes(q) ||
        payment.caregiverInfo.name?.toLowerCase().includes(q) ||
        payment.caregiverInfo.email?.toLowerCase().includes(q) ||
        payment.bookingId.toLowerCase().includes(q)
      );
    });
  }, [payments, searchQuery]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadPayments();
  };

  const handleStatusUpdate = async (payment: PaymentRecord, nextStatus: PaymentStatus) => {
    if (!notes.trim()) {
      Alert.alert('Missing notes', 'Please document the reason in the notes field before updating status.');
      return;
    }

    try {
      await updatePaymentStatus(payment.id, nextStatus, notes.trim());
      setNotes('');
      await loadPayments();
      Alert.alert('Success', `Payment marked as ${nextStatus}.`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update payment status');
    }
  };

  const openRefundDialog = (paymentId: string) => {
    setRefundDialog({visible: true, paymentId, reason: ''});
  };

  const handleRefund = async () => {
    if (!refundDialog.paymentId) {
      return;
    }
    try {
      await refundPayment(refundDialog.paymentId, refundDialog.reason.trim() || undefined);
      setRefundDialog({visible: false, paymentId: null, reason: ''});
      await loadPayments();
      Alert.alert('Success', 'Refund initiated successfully.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to process refund');
    }
  };

  const paymentActions = (payment: PaymentRecord) => {
    return (
      <View style={styles.actionsRow}>
        {payment.paymentStatus !== 'paid' ? (
          <Button
            mode="contained"
            icon="check"
            onPress={() => handleStatusUpdate(payment, 'paid')}
            style={styles.actionButton}>
            Mark Paid
          </Button>
        ) : null}
        {payment.paymentStatus !== 'disputed' ? (
          <Button
            mode="outlined"
            icon="gavel"
            onPress={() => handleStatusUpdate(payment, 'disputed')}
            style={styles.actionButton}>
            Flag Dispute
          </Button>
        ) : null}
        {payment.paymentStatus !== 'refunded' ? (
          <Button
            mode="outlined"
            icon="undo"
            onPress={() => openRefundDialog(payment.id)}
            style={styles.actionButton}
            textColor={theme.colors.error}>
            Refund
          </Button>
        ) : null}
      </View>
    );
  };

  const renderPaymentCard = (payment: PaymentRecord) => {
    return (
      <Card key={payment.id} style={styles.card}>
        <Card.Content>
          <View style={styles.headerRow}>
            <View style={styles.headerInfo}>
              <Icon name="payment" type="material" color={theme.colors.primary} size={24} />
              <View style={styles.headerText}>
                <Text variant="titleMedium">Booking {payment.bookingId}</Text>
                <Text variant="bodySmall" style={styles.subtleText}>
                  Parent: {payment.parentInfo.name ?? 'Unknown'} • Caregiver: {payment.caregiverInfo.name ?? 'Unknown'}
                </Text>
              </View>
            </View>
            <Chip style={styles.statusChip} icon="info">
              {payment.paymentStatus.toUpperCase()}
            </Chip>
          </View>

          <View style={styles.amountRow}>
            <Text variant="headlineSmall" style={styles.amountText}>
              ₱{payment.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}
            </Text>
            <Text variant="bodySmall" style={styles.subtleText}>
              Created {new Date(payment.createdAt).toLocaleString()}
            </Text>
          </View>

          {payment.notes ? (
            <Card style={styles.notesCard}>
              <Card.Content>
                <Text variant="titleSmall" style={styles.notesTitle}>
                  Notes
                </Text>
                <Text variant="bodySmall">{payment.notes}</Text>
              </Card.Content>
            </Card>
          ) : null}

          <TextInput
            mode="outlined"
            label="Admin notes"
            placeholder="Document reason for changes"
            value={notes}
            onChangeText={setNotes}
            style={styles.notesInput}
            multiline
          />

          {paymentActions(payment)}
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
          Payments Management
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Track caregiver payouts, resolve disputes, and manage refunds.
        </Text>

        <Searchbar
          placeholder="Search payments by user or booking"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={loadPayments}
          style={styles.searchbar}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {STATUS_FILTERS.map(filter => (
            <Chip
              key={filter.value}
              icon={filter.icon}
              mode={statusFilter === filter.value ? 'flat' : 'outlined'}
              style={[styles.filterChip, statusFilter === filter.value && {backgroundColor: filter.color + '33'}]}
              onPress={() => setStatusFilter(filter.value)}>
              {filter.label}
            </Chip>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>Loading payments...</Text>
          </View>
        ) : filteredPayments.length === 0 ? (
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
        ) : (
          filteredPayments.map(renderPaymentCard)
        )}
      </ScrollView>

      <FAB icon="refresh" onPress={loadPayments} style={styles.fab} disabled={loading} />

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
            <Button mode="contained" onPress={handleRefund}>
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
});
