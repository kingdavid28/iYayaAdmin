import { adminApi } from './apiService';
import type { ApiResponse, PaymentProofSummary, PaymentRecord, PaymentStatus } from '../types';

export interface FetchPaymentsOptions {
  status?: PaymentStatus | 'all';
  search?: string;
}

export interface FetchPaymentsResult {
  payments: PaymentRecord[];
  proofSummary?: PaymentProofSummary;
}

const extractResponseData = <T>(response: ApiResponse<T>): T => {
  if (!response.success) {
    throw new Error(response.error || 'Request failed');
  }

  if (response.data === undefined) {
    throw new Error('Missing data in response');
  }

  return response.data;
};

export const fetchPayments = async (options: FetchPaymentsOptions = {}): Promise<FetchPaymentsResult> => {
  const response = await adminApi.getPayments({
    status: options.status === 'all' ? undefined : options.status,
    search: options.search,
  });

  const data = extractResponseData<PaymentRecord[] | { payments: PaymentRecord[] }>(response);
  const payments = Array.isArray((data as any).payments)
    ? (data as any).payments
    : Array.isArray(data)
    ? (data as PaymentRecord[])
    : [];

  const proofSummary = response.proofSummary ?? (response.data as any)?.proofSummary;
  return { payments, proofSummary: proofSummary ?? undefined };
};

export const getPaymentById = async (paymentId: string): Promise<PaymentRecord> => {
  const response = await adminApi.getPaymentById(paymentId);
  return extractResponseData<PaymentRecord>(response);
};

export const updatePaymentStatus = async (
  paymentId: string,
  status: PaymentStatus,
  note: string,
): Promise<{ payment: PaymentRecord; warnings?: string[] }> => {
  const response = await adminApi.updatePaymentStatus(paymentId, status, note);
  return {
    payment: extractResponseData<PaymentRecord>(response as unknown as ApiResponse<PaymentRecord>),
    warnings: response.warnings,
  };
};

export const refundPayment = async (
  paymentId: string,
  reason: string,
): Promise<{ payment: PaymentRecord; warnings?: string[] }> => {
  const response = await adminApi.refundPayment(paymentId, reason);
  return {
    payment: extractResponseData<PaymentRecord>(response as unknown as ApiResponse<PaymentRecord>),
    warnings: response.warnings,
  };
};
