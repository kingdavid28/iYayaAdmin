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

const safeJsonParse = (value: unknown) => {
  if (typeof value !== 'string') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn('[auditService] Failed to parse JSON value', error);
    return value;
  }
};

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
        adminId:admin_id,
        details,
        metadata,
        timestamp,
        ip,
        admin:admin_id(id,name,email)
      `,
      { count: 'exact' }
    )
    .order('timestamp', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch audit logs: ${error.message}`);
  }

  const rows = Array.isArray(data) ? data : data ? [data] : [];
  const adminIds = Array.from(
    new Set(
      rows
        .map(row => row.adminId)
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
    ),
  );

  let adminLookup = new Map<string, {id?: string; name?: string; email?: string}>();
  if (adminIds.length > 0) {
    const { data: adminRows, error: adminError } = await supabase
      .from('users')
      .select('id,name,email')
      .in('id', adminIds);

    if (!adminError && Array.isArray(adminRows)) {
      adminLookup = new Map(
        adminRows.map((admin: any) => [admin.id as string, { id: admin.id, name: admin.name, email: admin.email }]),
      );
    } else if (adminError) {
      console.warn('[auditService] Failed to fetch admin profiles for audit logs', adminError);
    }
  }

  const logs: AuditLog[] = rows.map((row: any) => {
    const adminRelation = Array.isArray(row.admin) ? row.admin[0] : row.admin;
    const adminFromLookup = row.adminId ? adminLookup.get(row.adminId) : undefined;
    const adminInfo = adminRelation ?? adminFromLookup;
    const parsedDetails = typeof row.details === 'string' ? safeJsonParse(row.details) : row.details;
    const parsedMetadata = typeof row.metadata === 'string' ? safeJsonParse(row.metadata) : row.metadata;

    return {
      id: row.id,
      action: row.action,
      adminId: {
        id: adminInfo?.id ?? row.adminId ?? undefined,
        name: adminInfo?.name ?? adminFromLookup?.name ?? undefined,
        email: adminInfo?.email ?? adminFromLookup?.email ?? undefined,
      },
      targetId: row.targetId,
      details: typeof parsedDetails === 'object' && parsedDetails !== null ? parsedDetails : {},
      metadata: typeof parsedMetadata === 'object' && parsedMetadata !== null ? parsedMetadata : undefined,
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
