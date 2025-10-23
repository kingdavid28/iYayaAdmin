import { supabase } from '../config/supabase';
import type { NotificationItem, NotificationType, MaybeRelation, UserReference } from '../types';

export interface FetchNotificationsOptions {
  type?: NotificationType;
  search?: string;
}

export const NOTIFICATION_TYPES: NotificationType[] = [
  'message',
  'job_application',
  'booking_request',
  'booking_confirmed',
  'booking_cancelled',
  'review',
  'payment',
  'system',
];

export interface NotificationStats {
  total: number;
  unread: number;
  targeted: number;
  broadcasts: number;
  perType: Record<NotificationType, number>;
}

const sanitizeSearchTerm = (term: string) =>
  term
    .trim()
    .replace(/[%_]/g, match => `\\${match}`)
    .replace(/,/g, '\\,');

interface NotificationRow {
  id: string;
  userId?: string | null;
  user?: MaybeRelation<UserReference>;
  type: NotificationType;
  title: string;
  message: string;
  data?: unknown;
  read?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

const resolveRelation = <T>(relation: MaybeRelation<T>): T | undefined => {
  if (!relation) {
    return undefined;
  }
  return Array.isArray(relation) ? relation[0] ?? undefined : relation;
};

const parseData = (value: unknown): Record<string, unknown> | null => {
  if (!value) {
    return null;
  }
  if (typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  try {
    return JSON.parse(String(value)) as Record<string, unknown>;
  } catch (error) {
    return { raw: value };
  }
};

export const fetchNotifications = async (options: FetchNotificationsOptions = {}): Promise<NotificationItem[]> => {
  let query = supabase
    .from('notifications')
    .select(
      `
        id,
        userId:user_id,
        type,
        title,
        message,
        data,
        read,
        createdAt:created_at,
        updatedAt:updated_at,
        user:user_id(name,email)
      `
    )
    .order('created_at', { ascending: false });

  if (options.type) {
    query = query.eq('type', options.type);
  }

  if (options.search && options.search.trim()) {
    const sanitized = sanitizeSearchTerm(options.search);
    const orClause = ['title', 'message', 'user_id.name', 'user_id.email']
      .map(column => `${column}.ilike.%${sanitized}%`)
      .join(',');
    query = query.or(orClause);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch notifications: ${error.message}`);
  }

  const rows: NotificationRow[] = Array.isArray(data) ? data : data ? [data] : [];

  return rows.map(row => {
    const user = resolveRelation<UserReference>(row.user);
    const normalizedUserId = row.userId ?? user?.id ?? null;
    const normalizedCreatedAt = row.createdAt ?? new Date().toISOString();
    const normalizedUpdatedAt = row.updatedAt ?? undefined;

    return {
      id: row.id,
      userId: normalizedUserId ?? undefined,
      userInfo: user
        ? {
            name: user.name ?? undefined,
            email: user.email ?? undefined,
          }
        : undefined,
      type: row.type,
      title: row.title,
      message: row.message,
      data: parseData(row.data),
      read: row.read ?? false,
      createdAt: normalizedCreatedAt,
      updatedAt: normalizedUpdatedAt,
    } satisfies NotificationItem;
  });
};

export interface CreateNotificationPayload {
  userId?: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown> | null;
}

interface NotificationInsertPayload {
  user_id?: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
}

export const createNotification = async (payload: CreateNotificationPayload) => {
  const insertPayload: NotificationInsertPayload = {
    type: payload.type,
    title: payload.title,
    message: payload.message,
    data: payload.data ?? null,
  };

  if (payload.userId) {
    insertPayload.user_id = payload.userId;
  }

  const { error } = await supabase.from('notifications').insert(insertPayload);
  if (error) {
    throw new Error(`Failed to send notification: ${error.message}`);
  }
};

export const toggleNotificationRead = async (notificationId: string, read: boolean) => {
  const { error } = await supabase
    .from('notifications')
    .update({ read })
    .eq('id', notificationId);

  if (error) {
    throw new Error(`Failed to update notification status: ${error.message}`);
  }
};

export const deleteNotification = async (notificationId: string) => {
  const { error } = await supabase.from('notifications').delete().eq('id', notificationId);

  if (error) {
    throw new Error(`Failed to delete notification: ${error.message}`);
  }
};

const runCountQuery = async (query: any, context: string): Promise<number> => {
  const { count, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch ${context}: ${error.message}`);
  }
  return count ?? 0;
};

export const fetchNotificationStats = async (): Promise<NotificationStats> => {
  const selectOptions = { count: 'exact' as const, head: true };

  const [total, unread, targeted, broadcasts] = await Promise.all([
    runCountQuery(supabase.from('notifications').select('id', selectOptions), 'total notification count'),
    runCountQuery(
      supabase.from('notifications').select('id', selectOptions).eq('read', false),
      'unread notification count',
    ),
    runCountQuery(
      supabase.from('notifications').select('id', selectOptions).not('user_id', 'is', null),
      'targeted notification count',
    ),
    runCountQuery(
      supabase.from('notifications').select('id', selectOptions).is('user_id', null),
      'broadcast notification count',
    ),
  ]);

  const perTypeEntries = await Promise.all(
    NOTIFICATION_TYPES.map(async type => {
      const count = await runCountQuery(
        supabase.from('notifications').select('id', selectOptions).eq('type', type),
        `notification count for type ${type}`,
      );
      return [type, count] as const;
    }),
  );

  const perType = perTypeEntries.reduce((acc, [type, count]) => {
    acc[type] = count;
    return acc;
  }, {} as Record<NotificationType, number>);

  return {
    total,
    unread,
    targeted,
    broadcasts,
    perType,
  } satisfies NotificationStats;
};
