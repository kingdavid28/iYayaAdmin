// File: apiService.ts (class ApiService and exports)

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ApiResponse,
  User,
  Review,
  ChildProfile,
  NotificationItem,
  PaymentRecord,
  AnalyticsSummaryResponse,
} from "../types";
import { apiBaseUrlWithApiPrefix, getEnvVar } from "../config/api";

class ApiService {
  private async getAuthToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem("authToken");
    } catch (error) {
      console.error("Error getting auth token:", error);
      return null;
    }
  }

  private async getHeaders(includeAuth = true): Promise<HeadersInit> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    // Dev bypass header for development (requires ALLOW_DEV_BYPASS=true on backend)
    const devBypass = getEnvVar("EXPO_PUBLIC_DEV_BYPASS") === "true";
    if (devBypass) {
      (headers as any)["X-Dev-Bypass"] = "1";
    }

    if (includeAuth) {
      const token = await this.getAuthToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    return data;
  }

  async get<T>(
    endpoint: string,
    params?: Record<string, any>,
  ): Promise<ApiResponse<T>> {
    return this.requestWithTimeout('GET', endpoint, undefined, params);
  }

  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.requestWithTimeout('POST', endpoint, data);
  }

  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.requestWithTimeout('PUT', endpoint, data);
  }

  async patch<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.requestWithTimeout('PATCH', endpoint, data);
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.requestWithTimeout('DELETE', endpoint);
  }

  async requestWithTimeout<T>(
    method: string,
    endpoint: string,
    data?: any,
    params?: Record<string, any>
  ): Promise<ApiResponse<T>> {
    return new Promise((resolve, reject) => {
      const timeoutMs = parseInt(getEnvVar('EXPO_PUBLIC_API_TIMEOUT') || '30000');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error('Network request timed out'));
      }, timeoutMs);

      this.performRequest<T>(method, endpoint, data, params, controller.signal)
        .then(resolve)
        .catch(reject)
        .finally(() => {
          clearTimeout(timeoutId);
        });
    });
  }

  private async performRequest<T>(
    method: string,
    endpoint: string,
    data?: any,
    params?: Record<string, any>,
    signal?: AbortSignal
  ): Promise<ApiResponse<T>> {
    try {
      let url = `${apiBaseUrlWithApiPrefix}${endpoint}`;
      if (params) {
        const urlObj = new URL(url);
        Object.keys(params).forEach((key) => {
          if (params[key] !== undefined) {
            urlObj.searchParams.append(key, params[key].toString());
          }
        });
        url = urlObj.toString();
      }

      const response = await fetch(url, {
        method,
        headers: await this.getHeaders(),
        body: data ? JSON.stringify(data) : undefined,
        signal,
      });

      return await this.handleResponse<T>(response);
    } catch (error) {
      if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
        throw new Error('Network request timed out');
      }
      console.error(`API ${method} error:`, error);
      throw error instanceof Error ? error : new Error('Unknown API error');
    }
  }
}

export const apiService = new ApiService();

// Admin API methods
export const adminApi = {
  // Dashboard
  getDashboard: () => apiService.get("/admin/dashboard"),

  // Users
  getUsers: (params?: {
    page?: number;
    limit?: number;
    userType?: string;
    search?: string;
  }) => apiService.get("/admin/users", params),

  createUser: (payload: {
    email: string;
    password?: string;
    role?: string;
    name?: string;
    phone?: string;
    status?: string;
  }) => apiService.post("/admin/users", payload),

  getUserById: (id: string) => apiService.get(`/admin/users/${id}`),

  updateUser: (
    userId: string,
    payload: {
      email?: string;
      password?: string;
      role?: string;
      name?: string;
      phone?: string;
      status?: string;
      reason?: string;
    },
  ) => apiService.put(`/admin/users/${userId}`, payload),

  updateUserStatus: (userId: string, status: string, reason?: string) =>
    apiService.patch(`/admin/users/${userId}/status`, { status, reason }),

  bulkUpdateUserStatus: (payload: {
    userIds: string[];
    status: string;
    reason?: string;
  }) => apiService.post("/admin/users/bulk/status", payload),

  deleteUser: (userId: string) => apiService.delete(`/admin/users/${userId}`),

  // Jobs
  getJobs: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }) => apiService.get("/admin/jobs", params),

  getJobById: (id: string) => apiService.get(`/admin/jobs/${id}`),

  createJob: (payload: {
    title: string;
    description: string;
    location: string;
    budget?: number;
    hourly_rate?: number;
    parent_id?: string;
    caregiver_id?: string;
  }) => apiService.post("/admin/jobs", payload),

  updateJob: (jobId: string, payload: {
    title?: string;
    description?: string;
    location?: string;
    budget?: number;
    hourly_rate?: number;
    parent_id?: string;
    caregiver_id?: string;
  }) => apiService.put(`/admin/jobs/${jobId}`, payload),

  updateJobStatus: (jobId: string, status: string, reason?: string) =>
    apiService.patch(`/admin/jobs/${jobId}/status`, { status, reason }),

  approveJob: (jobId: string, payload?: { reason?: string }) =>
    apiService.post(`/admin/jobs/${jobId}/approve`, payload),

  rejectJob: (jobId: string, payload?: { reason?: string }) =>
    apiService.post(`/admin/jobs/${jobId}/reject`, payload),

  cancelJob: (jobId: string, payload?: { reason?: string }) =>
    apiService.post(`/admin/jobs/${jobId}/cancel`, payload),

  completeJob: (jobId: string) =>
    apiService.post(`/admin/jobs/${jobId}/complete`),

  deleteJob: (jobId: string, payload?: { reason?: string }) =>
    apiService.delete(`/admin/jobs/${jobId}`),

  reopenJob: (jobId: string) => apiService.post(`/admin/jobs/${jobId}/reopen`),

  // Bookings
  getBookings: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }) => apiService.get("/admin/bookings", params),

  getBookingById: (bookingId: string) =>
    apiService.get(`/admin/bookings/${bookingId}`),

  updateBookingStatus: (bookingId: string, status: string, reason?: string) =>
    apiService.patch(`/admin/bookings/${bookingId}/status`, { status, reason }),

  confirmBooking: (bookingId: string, payload?: { reason?: string }) =>
    apiService.post(`/admin/bookings/${bookingId}/confirm`, payload),

  startBooking: (bookingId: string) =>
    apiService.post(`/admin/bookings/${bookingId}/start`),

  completeBooking: (bookingId: string) =>
    apiService.post(`/admin/bookings/${bookingId}/complete`),

  cancelBooking: (bookingId: string, payload?: { reason?: string }) =>
    apiService.post(`/admin/bookings/${bookingId}/cancel`, payload),

  // Audit Logs
  getAuditLogs: (params?: {
    page?: number;
    limit?: number;
    action?: string;
    targetId?: string;
    adminId?: string;
  }) => apiService.get("/admin/audit", params),

  // System Settings
  getSettings: () => apiService.get("/admin/settings"),

  updateSettings: (settings: Record<string, any>) =>
    apiService.patch("/admin/settings", settings),

  // Export data
  exportUsers: (format: "json" | "csv" = "json", userType?: string) =>
    apiService.get("/admin/export/users", { format, userType }),

  // Statistics
  getStats: () => apiService.get("/admin/stats"),
  getUserAnalytics: (timeframe?: string) =>
    apiService.get("/admin/analytics/users", { timeframe }),
  getActivitySummary: (timeframe?: string) =>
    apiService.get("/admin/activity-summary", { timeframe }),

  // Reviews
  getReviews: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    rating?: number;
  }) => apiService.get<Review[]>("/admin/reviews", params),

  getReviewById: (reviewId: string) =>
    apiService.get<Review>(`/admin/reviews/${reviewId}`),

  updateReviewStatus: (
    reviewId: string,
    status: "published" | "hidden",
    reason?: string,
  ) =>
    apiService.patch(`/admin/reviews/${reviewId}/status`, { status, reason }),

  deleteReview: (reviewId: string, reason?: string) =>
    apiService.delete<ApiResponse<null>>(
      `/admin/reviews/${reviewId}?reason=${encodeURIComponent(reason ?? "")}`,
    ),

  // Children
  getChildren: (params?: {
    page?: number;
    limit?: number;
    parentId?: string;
    search?: string;
  }) => apiService.get<ChildProfile[]>("/admin/children", params),

  getChildById: (childId: string) =>
    apiService.get<ChildProfile>(`/admin/children/${childId}`),

  updateChildProfile: (childId: string, updates: Partial<ChildProfile>) =>
    apiService.patch(`/admin/children/${childId}`, updates),

  deleteChildProfile: (childId: string, reason?: string) =>
    apiService.delete<ApiResponse<null>>(
      `/admin/children/${childId}?reason=${encodeURIComponent(reason ?? "")}`,
    ),

  // Notifications
  getNotifications: (params?: {
    page?: number;
    limit?: number;
    type?: string;
    userId?: string;
  }) => apiService.get<NotificationItem[]>("/admin/notifications", params),

  createNotification: (payload: {
    userId?: string;
    type: string;
    title: string;
    message: string;
    data?: Record<string, any>;
  }) => apiService.post<NotificationItem>("/admin/notifications", payload),

  markNotificationRead: (notificationId: string, read = true) =>
    apiService.patch(`/admin/notifications/${notificationId}/read`, { read }),

  deleteNotification: (notificationId: string) =>
    apiService.delete<ApiResponse<null>>(
      `/admin/notifications/${notificationId}`,
    ),

  // Payments
  getPayments: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    bookingId?: string;
  }) => apiService.get<PaymentRecord[]>("/admin/payments", params),

  getPaymentById: (paymentId: string) =>
    apiService.get<PaymentRecord>(`/admin/payments/${paymentId}`),

  updatePaymentStatus: (paymentId: string, status: string, notes?: string) =>
    apiService.patch(`/admin/payments/${paymentId}/status`, { status, notes }),

  refundPayment: (paymentId: string, reason?: string) =>
    apiService.post(`/admin/payments/${paymentId}/refund`, { reason }),

  // Analytics
  getAnalyticsSummary: (timeframe?: string) =>
    apiService.get<AnalyticsSummaryResponse>(
      "/admin/analytics/summary",
      timeframe ? { timeframe } : undefined,
    ),

  getAnalyticsTrends: (
    metric: "bookings" | "revenue" | "users" | "applications",
    timeframe?: string,
  ) =>
    apiService.get(
      `/admin/analytics/trends/${metric}`,
      timeframe ? { timeframe } : undefined,
    ),
};

// Add auth API for profile lookup by user ID (Supabase backend)
export const authApi = {
  getUserById: (userId: string) => apiService.get(`/auth/user/${userId}`),
};
