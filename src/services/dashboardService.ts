import { supabase } from '../config/supabase';
import type { DashboardStats } from '../types';

type SectionKey = 'users' | 'jobs' | 'bookings' | 'applications';

type DashboardMetricsRow = {
  users_total?: number;
  users_active?: number;
  users_suspended?: number;
  jobs_total?: number;
  jobs_active?: number;
  bookings_total?: number;
  bookings_completed?: number;
  applications_pending?: number;
  applications_approved?: number;
};

const toDashboardStats = (row: DashboardMetricsRow): DashboardStats => ({
  users: {
    total: row.users_total ?? 0,
    active: row.users_active ?? 0,
    suspended: row.users_suspended ?? 0,
  },
  jobs: {
    total: row.jobs_total ?? 0,
    active: row.jobs_active ?? 0,
  },
  bookings: {
    total: row.bookings_total ?? 0,
    completed: row.bookings_completed ?? 0,
  },
  applications: {
    pending: row.applications_pending ?? 0,
    approved: row.applications_approved ?? 0,
  },
});

const SECTION_COLUMNS: Record<SectionKey, (keyof DashboardMetricsRow)[]> = {
  users: ['users_total', 'users_active', 'users_suspended'],
  jobs: ['jobs_total', 'jobs_active'],
  bookings: ['bookings_total', 'bookings_completed'],
  applications: ['applications_pending', 'applications_approved'],
};

const ALL_SECTIONS: SectionKey[] = ['users', 'jobs', 'bookings', 'applications'];

const DEFAULT_STATS: DashboardStats = {
  users: { total: 0, active: 0, suspended: 0 },
  jobs: { total: 0, active: 0 },
  bookings: { total: 0, completed: 0 },
  applications: { pending: 0, approved: 0 },
};

const buildColumnList = (sections: SectionKey[]): string => {
  const columnSet = new Set<keyof DashboardMetricsRow>();
  sections.forEach(section => {
    SECTION_COLUMNS[section].forEach(column => columnSet.add(column));
  });
  return Array.from(columnSet.values()).join(', ');
};

export const fetchDashboardStats = async (sections: SectionKey[] = ALL_SECTIONS): Promise<DashboardStats> => {
  const uniqueSections = sections.length > 0 ? Array.from(new Set(sections)) : ALL_SECTIONS;
  const columnList = buildColumnList(uniqueSections);

  if (!columnList) {
    return DEFAULT_STATS;
  }

  const { data, error } = await supabase
    .from('dashboard_metrics')
    .select(columnList)
    .maybeSingle();

  if (data) {
    return toDashboardStats(data as DashboardMetricsRow);
  }

  if (error && error.code && error.code !== 'PGRST116') {
    console.warn('dashboard_metrics view unavailable, falling back to manual counts:', error.message);
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from('dashboard_metrics')
    .select(columnList)
    .limit(1);

  if (fallbackError && fallbackError.code !== 'PGRST116') {
    throw fallbackError;
  }

  const row = Array.isArray(fallbackData) ? fallbackData[0] : fallbackData;
  if (row) {
    return toDashboardStats(row as DashboardMetricsRow);
  }

  return DEFAULT_STATS;
};
