// Force localhost for Week 1-5 backend integration
import { apiBaseUrlWithApiPrefix } from '../config/api';

const API_BASE = apiBaseUrlWithApiPrefix;

export interface SolanaPaymentRequest {
  signature: string;
  bookingId: string;
  expected: {
    token: 'SOL' | 'USDC';
    amount: number;
    caregiverId: string;
    rating?: number;
    payer: string;
    caregiver: string;
  };
}

export interface PointsAwardRequest {
  caregiverId: string;
  rating: number;
  punctual: boolean;
}

export const verifySolanaPayment = async (payment: SolanaPaymentRequest) => {
  const response = await fetch(`${API_BASE}/solana/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payment)
  });
  return response.json();
};

export const awardPoints = async (request: PointsAwardRequest) => {
  const response = await fetch(`${API_BASE}/points/award`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });
  return response.json();
};

export const getCaregiverPoints = async (caregiverId: string) => {
  const response = await fetch(`${API_BASE}/points/${caregiverId}`);
  return response.json();
};