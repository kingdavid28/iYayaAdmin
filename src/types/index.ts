export interface CaregiverProfile {
  hourly_rate?: number | null;
  background_check_status?: string | null;
  [key: string]: unknown;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'parent' | 'caregiver' | 'admin' | 'superadmin';
  userType?: string;
  status: 'active' | 'suspended' | 'banned' | 'inactive';
  statusReason?: string | null;
  statusUpdatedAt?: string | null;
  statusUpdatedBy?: string | null;
  phone?: string;
  profileImage?: string | null;
  createdAt: string;
  lastLogin?: string;
  deletedAt?: string | null;
  permissions?: string[];
  caregiverProfile?: CaregiverProfile | null;
}

export interface BookingWorkflowPayload {
  status: Booking['status'];
  reason?: string;
}

export interface BookingListFilters {
  page?: number;
  limit?: number;
  status?: string;
}

export interface DashboardStats {
  users: {
    total: number;
    active: number;
    suspended: number;
  };
  jobs: {
    total: number;
    active: number;
  };
  bookings: {
    total: number;
    completed: number;
  };
  applications: {
    pending: number;
    approved: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  count?: number;
  totalPages?: number;
  currentPage?: number;
  stats?: Record<string, unknown> | null;
}

export interface Job {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'active' | 'inactive';
  parentId: {
    name: string;
    email: string;
  };
  caregiverId?: {
    name: string;
    email: string;
  };
  location: string;
  budget: number;
  createdAt: string;
  updatedAt: string;
}

export interface JobWorkflowPayload {
  status: Job['status'];
  reason?: string;
}

export interface JobListFilters {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

export interface Booking {
  id: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' | 'in-progress';
  parentId: {
    name: string;
    email: string;
  };
  caregiverId: {
    name: string;
    email: string;
  };
  jobId: {
    title: string;
    location: string;
  };
  startDate: string;
  endDate: string;
  totalHours: number;
  hourlyRate: number;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChildProfile {
  id: string;
  parentId: string;
  parentInfo?: {
    name?: string;
    email?: string;
  };
  name: string;
  dateOfBirth: string;
  gender?: 'male' | 'female' | 'other';
  specialNeeds?: string;
  allergies?: string;
  medicalConditions?: string;
  emergencyContact?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  bookingId: string;
  reviewerId: string;
  reviewerInfo?: {
    name?: string;
    email?: string;
    role?: User['role'];
  };
  revieweeId: string;
  revieweeInfo?: {
    name?: string;
    email?: string;
    role?: User['role'];
  };
  caregiverId?: string | null;
  rating: number;
  comment?: string | null;
  createdAt: string;
  updatedAt: string;
  status?: 'published' | 'hidden';
}

export type NotificationType =
  | 'message'
  | 'job_application'
  | 'booking_request'
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'review'
  | 'payment'
  | 'system';

export interface NotificationItem {
  id: string;
  userId: string;
  userInfo?: {
    name?: string;
    email?: string;
  };
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown> | null;
  read: boolean;
  createdAt: string;
  updatedAt?: string;
}

export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'disputed';

export interface PaymentRecord {
  id: string;
  bookingId: string;
  parentInfo: {
    id?: string;
    name?: string;
    email?: string;
  };
  caregiverInfo: {
    id?: string;
    name?: string;
    email?: string;
  };
  totalAmount: number;
  paymentStatus: PaymentStatus;
  paymentProof?: string | null;
  createdAt: string;
  updatedAt: string;
  notes?: string | null;
}

export interface AnalyticsMetric {
  label: string;
  value: number;
  delta?: number;
  deltaType?: 'increase' | 'decrease' | 'stable';
}

export interface AnalyticsOverview {
  users: AnalyticsMetric;
  caregivers: AnalyticsMetric;
  jobs: AnalyticsMetric;
  bookings: AnalyticsMetric;
  revenue?: AnalyticsMetric;
}

export interface AnalyticsTrendPoint {
  date: string;
  value: number;
  label?: string;
  category?: string;
}

export interface AnalyticsTrends {
  bookings?: AnalyticsTrendPoint[];
  revenue?: AnalyticsTrendPoint[];
  newUsers?: AnalyticsTrendPoint[];
}

export interface AnalyticsSummaryResponse {
  timeframe: string;
  overview: AnalyticsOverview;
  trends: AnalyticsTrends;
}

export interface AuditLog {
  id: string;
  action: string;
  adminId: {
    name: string;
    email: string;
  };
  targetId: string;
  details: Record<string, unknown>;
  timestamp: string;
  ip?: string;
}

export type MaybeRelation<T> = T | T[] | null | undefined;

export interface UserReference {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  role?: User['role'] | string | null;
}

export interface JobReference {
  title?: string | null;
  location?: string | null;
  budget?: number | null;
}

export interface JobRow {
  id: string;
  title?: string | null;
  name?: string | null;
  description?: string | null;
  status?: Job['status'] | null;
  location?: string | null;
  budget?: number | null;
  parent?: MaybeRelation<UserReference>;
  parentId?: MaybeRelation<UserReference>;
  parent_id?: MaybeRelation<UserReference>;
  parentInfo?: MaybeRelation<UserReference>;
  caregiver?: MaybeRelation<UserReference>;
  caregiverId?: MaybeRelation<UserReference>;
  caregiver_id?: MaybeRelation<UserReference>;
  caregiverInfo?: MaybeRelation<UserReference>;
  job?: JobReference | null;
  jobInfo?: MaybeRelation<JobReference>;
  createdAt?: string | null;
  created_at?: string | null;
  updatedAt?: string | null;
  updated_at?: string | null;
}

export interface BookingRow {
  id: string;
  status?: Booking['status'] | null;
  parentId?: MaybeRelation<UserReference>;
  parent?: MaybeRelation<UserReference>;
  parent_id?: MaybeRelation<UserReference>;
  parentInfo?: MaybeRelation<UserReference>;
  caregiverId?: MaybeRelation<UserReference>;
  caregiver?: MaybeRelation<UserReference>;
  caregiver_id?: MaybeRelation<UserReference>;
  caregiverInfo?: MaybeRelation<UserReference>;
  jobId?: MaybeRelation<JobReference>;
  job?: MaybeRelation<JobReference>;
  job_id?: MaybeRelation<JobReference>;
  jobInfo?: MaybeRelation<JobReference>;
  startDate?: string | null;
  start_date?: string | null;
  startAt?: string | null;
  endDate?: string | null;
  end_date?: string | null;
  endAt?: string | null;
  totalHours?: number | null;
  total_hours?: number | null;
  hourlyRate?: number | null;
  hourly_rate?: number | null;
  totalAmount?: number | null;
  total_amount?: number | null;
  createdAt?: string | null;
  created_at?: string | null;
  updatedAt?: string | null;
  updated_at?: string | null;
}
