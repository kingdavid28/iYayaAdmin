import { adminApi } from './apiService';
import type { ApiResponse, CaregiverProfile, User } from '../types';

export interface FetchUsersOptions {
  page?: number;
  limit?: number;
  userType?: string;
  search?: string;
}

export interface FetchUsersResult {
  users: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  stats: {
    total: number;
    active: number;
    suspended: number;
    banned: number;
    inactive: number;
  };
}

export interface CreateUserPayload {
  email: string;
  password?: string;
  role?: string;
  name?: string;
  phone?: string;
  status?: string;
}

export interface UpdateUserPayload {
  email?: string;
  password?: string;
  role?: string;
  name?: string;
  phone?: string;
  status?: string;
  reason?: string;
}

export interface BulkUpdateUserStatusPayload {
  userIds: string[];
  status: string;
  reason?: string;
}

const DEFAULT_PAGE_SIZE = 20;

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: User['role'];
  userType?: string | null;
  status: User['status'];
  statusReason?: string | null;
  status_reason?: string | null;
  statusUpdatedAt?: string | null;
  status_updated_at?: string | null;
  statusUpdatedBy?: string | null;
  status_updated_by?: string | null;
  phone?: string | null;
  profileImage?: string | null;
  profile_image?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
  lastLogin?: string | null;
  last_login?: string | null;
  deletedAt?: string | null;
  deleted_at?: string | null;
  permissions?: string[] | null;
  caregiverProfile?: Record<string, unknown> | null;
  caregiver_profiles?: Record<string, unknown> | null;
}

const coerceCaregiverProfile = (profile: unknown): CaregiverProfile | null => {
  if (profile && typeof profile === 'object') {
    return profile as CaregiverProfile;
  }
  return null;
};

const normalizeUser = (record: UserRow): User => ({
  id: record.id,
  email: record.email,
  name: record.name,
  role: record.role,
  userType: record.userType ?? record.role,
  status: record.status,
  statusReason: record.statusReason ?? record.status_reason ?? null,
  statusUpdatedAt: record.statusUpdatedAt ?? record.status_updated_at ?? null,
  statusUpdatedBy: record.statusUpdatedBy ?? record.status_updated_by ?? null,
  phone: record.phone ?? undefined,
  profileImage: record.profileImage ?? record.profile_image ?? null,
  createdAt: record.createdAt ?? record.created_at ?? new Date().toISOString(),
  lastLogin: record.lastLogin ?? record.last_login ?? undefined,
  deletedAt: record.deletedAt ?? record.deleted_at ?? null,
  permissions: Array.isArray(record.permissions) ? record.permissions : [],
  caregiverProfile: coerceCaregiverProfile(record.caregiverProfile ?? record.caregiver_profiles ?? null)
});

const sanitizeParam = (value?: string) => (value?.trim() ? value.trim() : undefined);

export const fetchUsers = async (options: FetchUsersOptions = {}): Promise<FetchUsersResult> => {
  const limit = Math.max(1, options.limit ?? DEFAULT_PAGE_SIZE);
  const page = Math.max(1, options.page ?? 1);
  const params = {
    page,
    limit,
    userType: options.userType && options.userType !== 'all' ? options.userType : undefined,
    search: sanitizeParam(options.search)
  };

  const response = await adminApi.getUsers(params) as ApiResponse<UserRow[]>;

  if (!response.success) {
    throw new Error(response.error || 'Failed to fetch users');
  }

  const rows: UserRow[] = Array.isArray(response.data) ? response.data : [];
  const users = rows.map(normalizeUser);
  const total = response.count ?? users.length;
  const currentPage = response.currentPage ?? page;
  const totalPages = response.totalPages ?? Math.max(1, Math.ceil(total / limit));
  const hasMore = currentPage < totalPages;
  const rawStats = (response.stats ?? {}) as Record<string, unknown>;
  const toNumber = (value: unknown, fallback: number): number =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;

  return {
    users,
    pagination: {
      page: currentPage,
      limit,
      total,
      hasMore
    },
    stats: {
      total: toNumber(rawStats.total, total),
      active: toNumber(rawStats.active, 0),
      suspended: toNumber(rawStats.suspended, 0),
      banned: toNumber(rawStats.banned, 0),
      inactive: toNumber(rawStats.inactive, 0)
    }
  };
};

export const updateUserStatus = async (userId: string, status: string, reason?: string) => {
  const response = await adminApi.updateUserStatus(userId, status, reason) as ApiResponse<UserRow>;

  if (!response.success) {
    throw new Error(response.error || 'Failed to update user status');
  }

  if (!response.data) {
    throw new Error('User payload missing from updateUserStatus response');
  }

  return normalizeUser(response.data);
};

export const bulkUpdateUserStatus = async (payload: BulkUpdateUserStatusPayload) => {
  const response = await adminApi.bulkUpdateUserStatus(payload) as ApiResponse<UserRow[]>;

  if (!response.success) {
    throw new Error(response.error || 'Failed to update user statuses');
  }

  const rows: UserRow[] = Array.isArray(response.data) ? response.data : [];
  return rows.map(normalizeUser);
};

export const createUser = async (payload: CreateUserPayload) => {
  const response = await adminApi.createUser(payload) as ApiResponse<UserRow>;

  if (!response.success) {
    throw new Error(response.error || 'Failed to create user');
  }

  if (!response.data) {
    throw new Error('User payload missing from createUser response');
  }

  return normalizeUser(response.data);
};

export const updateUser = async (userId: string, payload: UpdateUserPayload) => {
  const response = await adminApi.updateUser(userId, payload) as ApiResponse<UserRow>;

  if (!response.success) {
    throw new Error(response.error || 'Failed to update user');
  }

  if (!response.data) {
    throw new Error('User payload missing from updateUser response');
  }

  return normalizeUser(response.data);
};

export const deleteUser = async (userId: string) => {
  const response = await adminApi.deleteUser(userId) as ApiResponse<null>;

  if (!response.success) {
    throw new Error(response.error || 'Failed to delete user');
  }
};
