import { supabase } from '../config/supabase';
import type {
  PaymentRecord,
  PaymentStatus,
  MaybeRelation,
  UserReference,
} from '../types';

export interface FetchPaymentsOptions {
  status?: PaymentStatus | 'all';
  search?: string;
}

const sanitizeSearchTerm = (term: string) =>
  term
    .trim()
    .replace(/[%_]/g, match => `\\${match}`)
    .replace(/,/g, '\\,');

interface PaymentRow {
  id: string;
  bookingId?: string | null;
  booking_id?: MaybeRelation<{ id?: string | null }>;
  parentId?: MaybeRelation<UserReference>;
  parent_id?: MaybeRelation<UserReference>;
  caregiverId?: MaybeRelation<UserReference>;
  caregiver_id?: MaybeRelation<UserReference>;
  totalAmount?: number | null;
  total_amount?: number | null;
  paymentStatus?: PaymentStatus | null;
  payment_status?: PaymentStatus | null;
  paymentProof?: string | null;
  payment_proof?: string | null;
  notes?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
  updatedAt?: string | null;
  updated_at?: string | null;
  refundReason?: string | null;
  refund_reason?: string | null;
  parent?: MaybeRelation<UserReference>;
  caregiver?: MaybeRelation<UserReference>;
  booking?: MaybeRelation<{ id?: string | null }>;
}

const resolveRelation = <T>(relation: MaybeRelation<T>): T | undefined => {
  if (!relation) {
    return undefined;
  }
  return Array.isArray(relation) ? relation[0] ?? undefined : relation;
};

export const fetchPayments = async (options: FetchPaymentsOptions = {}): Promise<PaymentRecord[]> => {
  let query = supabase
    .from('payments')
    .select(
      `
        id,
        bookingId:booking_id,
        parentId:parent_id,
        caregiverId:caregiver_id,
        totalAmount:total_amount,
        paymentStatus:payment_status,
        paymentProof:payment_proof,
        notes,
        createdAt:created_at,
        updatedAt:updated_at,
        refundReason:refund_reason,
        parent:parent_id(name,email),
        caregiver:caregiver_id(name,email),
        booking:booking_id(id)
      `
    )
    .order('created_at', { ascending: false });

  if (options.status && options.status !== 'all') {
    query = query.eq('payment_status', options.status);
  }

  if (options.search && options.search.trim()) {
    const sanitized = sanitizeSearchTerm(options.search);
    const orClause = ['parent_id.name', 'parent_id.email', 'caregiver_id.name', 'caregiver_id.email', 'booking_id.id']
      .map(column => `${column}.ilike.%${sanitized}%`)
      .join(',');
    query = query.or(orClause);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch payments: ${error.message}`);
  }

  const rows: PaymentRow[] = Array.isArray(data) ? data : data ? [data] : [];

  return rows.map(row => {
    const parent =
      resolveRelation<UserReference>(row.parent) ??
      resolveRelation<UserReference>(row.parent_id) ??
      resolveRelation<UserReference>(row.parentId);

    const caregiver =
      resolveRelation<UserReference>(row.caregiver) ??
      resolveRelation<UserReference>(row.caregiver_id) ??
      resolveRelation<UserReference>(row.caregiverId);

    const bookingRelation =
      resolveRelation<{ id?: string | null }>(row.booking) ??
      resolveRelation<{ id?: string | null }>(row.booking_id);

    const bookingId = bookingRelation?.id ?? row.bookingId ?? 'unknown-booking';

    return {
      id: row.id,
      bookingId,
      parentInfo: {
        name: parent?.name ?? undefined,
        email: parent?.email ?? undefined,
      },
      caregiverInfo: {
        name: caregiver?.name ?? undefined,
        email: caregiver?.email ?? undefined,
      },
      totalAmount: Number(row.totalAmount ?? row.total_amount ?? 0),
      paymentStatus: (row.paymentStatus ?? row.payment_status ?? 'pending') as PaymentStatus,
      paymentProof: row.paymentProof ?? row.payment_proof ?? null,
      createdAt: row.createdAt ?? row.created_at ?? new Date().toISOString(),
      updatedAt: row.updatedAt ?? row.updated_at ?? new Date().toISOString(),
      notes: row.notes ?? null,
    } satisfies PaymentRecord;
  });
};

interface UpdatePaymentPayload {
  payment_status: PaymentStatus;
  notes?: string | null;
}

export const updatePaymentStatus = async (paymentId: string, status: PaymentStatus, note?: string) => {
  const payload: UpdatePaymentPayload = {
    payment_status: status,
  };

  if (note !== undefined) {
    payload.notes = note || null;
  }

  const { error } = await supabase
    .from('payments')
    .update(payload)
    .eq('id', paymentId);

  if (error) {
    throw new Error(`Failed to update payment status: ${error.message}`);
  }
};

export const refundPayment = async (paymentId: string, reason?: string) => {
  const { error } = await supabase
    .from('payments')
    .update({
      payment_status: 'refunded',
      refund_reason: reason || null,
    })
    .eq('id', paymentId);

  if (error) {
    throw new Error(`Failed to process refund: ${error.message}`);
  }
};
