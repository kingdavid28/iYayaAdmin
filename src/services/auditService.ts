import { supabase } from '../config/supabase';
import type { AuditLog } from '../types';

export interface FetchAuditLogsOptions {
  page?: number;
  limit?: number;
}

export interface FetchAuditLogsResult {
  logs: AuditLog[];
  pagination: {
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

const DEFAULT_PAGE_SIZE = 20;

export const fetchAuditLogs = async (options: FetchAuditLogsOptions = {}): Promise<FetchAuditLogsResult> => {
  const limit = Math.max(1, options.limit ?? DEFAULT_PAGE_SIZE);
  const page = Math.max(1, options.page ?? 1);
  const offset = (page - 1) * limit;

  const query = supabase
    .from('audit_logs')
    .select(
      `
        id,
        action,
        targetId:target_id,
        details,
        timestamp,
        ip,
        admin:admin_id(name,email)
      `,
      { count: 'exact' }
    )
    .order('timestamp', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch audit logs: ${error.message}`);
  }

  const logs: AuditLog[] = (data ?? []).map((row: any) => {
    const admin = Array.isArray(row.admin) ? row.admin[0] : row.admin;
    return {
      id: row.id,
      action: row.action,
      adminId: {
        name: admin?.name ?? 'Unknown Admin',
        email: admin?.email ?? 'unknown@example.com',
      },
      targetId: row.targetId,
      details: typeof row.details === 'object' && row.details !== null ? row.details : {},
      timestamp: row.timestamp,
      ip: row.ip ?? undefined,
    };
  });

  const total = count ?? logs.length;
  const hasMore = offset + logs.length < total;

  return {
    logs,
    pagination: {
      page,
      limit,
      hasMore,
    },
  };
};
