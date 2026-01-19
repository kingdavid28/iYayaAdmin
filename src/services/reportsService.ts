import { adminApi } from './apiService';

export interface Report {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  report_type: 'caregiver_misconduct' | 'parent_maltreatment' | 'inappropriate_behavior' | 'safety_concern' | 'payment_dispute' | 'other';
  category?: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'under_review' | 'resolved' | 'dismissed';
  evidence_urls?: string[];
  booking_id?: string;
  job_id?: string;
  admin_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  resolution?: string;
  created_at: string;
  updated_at: string;
  reporter?: { id: string; name: string; email: string; role: string };
  reported_user?: { id: string; name: string; email: string; role: string };
  reviewer?: { id: string; name: string; email: string };
}

export interface ReportStats {
  total: number;
  byStatus: Record<string, number>;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
}

export const reportsService = {
  async getReports(params?: {
    page?: number;
    limit?: number;
    status?: string;
    reportType?: string;
    severity?: string;
    search?: string;
  }) {
    const response = await adminApi.get('/admin/reports', params);
    return response.data;
  },

  async getReportById(id: string) {
    const response = await adminApi.get(`/admin/reports/${id}`);
    return response.data;
  },

  async createReport(data: {
    reported_user_id: string;
    report_type: string;
    title: string;
    description: string;
    severity?: string;
    category?: string;
    evidence_urls?: string[];
    booking_id?: string;
    job_id?: string;
  }) {
    const response = await adminApi.post('/auth/reports', data);
    return response.data;
  },

  async updateReportStatus(id: string, data: {
    status: string;
    adminNotes?: string;
    resolution?: string;
  }) {
    const response = await adminApi.patch(`/admin/reports/${id}/status`, data);
    return response.data;
  },

  async getReportStats() {
    const response = await adminApi.get('/admin/reports/stats');
    return response.data;
  },

  async getMyReports(params?: { page?: number; limit?: number }) {
    const response = await adminApi.get('/auth/reports/my', params);
    return response.data;
  },
};
