import { supabase } from '../config/supabase';
import type { NotificationItem, NotificationType, MaybeRelation, UserReference } from '../types';

export interface FetchNotificationsOptions {
  type?: NotificationType;
  search?: string;
}

const sanitizeSearchTerm = (term: string) =>
  term
    .trim()
    .replace(/[%_]/g, match => `\\${match}`)
    .replace(/,/g, '\\,');

interface NotificationRow {
  id: string;
  userId?: string | null;
  user_id?: MaybeRelation<UserReference>;
  user?: MaybeRelation<UserReference>;
  type: NotificationType;
  title: string;
  message: string;
  data?: unknown;
  read?: boolean | null;
  createdAt?: string | null;
  created_at?: string | null;
  updatedAt?: string | null;
  updated_at?: string | null;
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
        user:user_id(name,email),
        type,
        title,
        message,
        data,
        read,
        createdAt:created_at,
        updatedAt:updated_at
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
    const user =
      resolveRelation<UserReference>(row.user) ??
      resolveRelation<UserReference>(row.user_id);

    return {
      id: row.id,
      userId: row.userId ?? user?.id ?? '',
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
      createdAt: row.createdAt ?? row.created_at ?? new Date().toISOString(),
      updatedAt: row.updatedAt ?? row.updated_at ?? undefined,
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
