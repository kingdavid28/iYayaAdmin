import { supabase } from '../config/supabase';
import type { AnalyticsSummaryResponse, AnalyticsTrendPoint } from '../types';

type Timeframe = '7d' | '30d' | '90d' | '180d';

type QueryFilter = (query: any) => any;

const TIMEFRAME_DAYS: Record<Timeframe, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '180d': 180,
};

const ISO_DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
};

const getDateRanges = (timeframe: Timeframe) => {
  const days = TIMEFRAME_DAYS[timeframe];
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));

  const previousEnd = new Date(start);
  previousEnd.setDate(start.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousEnd.getDate() - (days - 1));

  return {
    current: {
      start,
      end,
    },
    previous: {
      start: previousStart,
      end: previousEnd,
    },
  };
};

const formatISO = (date: Date) => date.toISOString();

const isTableMissingError = (error: any) => {
  if (!error) {
    return false;
  }
  const message = String(error.message ?? '').toLowerCase();
  const details = String(error.details ?? '').toLowerCase();
  return error.code === '42P01' || message.includes('schema cache') || message.includes('does not exist') || details.includes('does not exist');
};

const countRows = async (
  table: string,
  range: { start: Date; end: Date },
  filter?: QueryFilter,
  createdColumn = 'created_at',
): Promise<number> => {
  let query = supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .gte(createdColumn, formatISO(range.start))
    .lte(createdColumn, formatISO(range.end));

  if (filter) {
    query = filter(query);
  }

  const { count, error } = await query;
  if (error) {
    throw new Error(`Failed to count rows for ${table}: ${error.message}`);
  }

  return count ?? 0;
};

const sumColumn = async (
  table: string,
  column: string,
  range: { start: Date; end: Date },
  filter?: QueryFilter,
  createdColumn = 'created_at',
): Promise<number> => {
  let query = supabase
    .from(table)
    .select(`${column}, ${createdColumn}`)
    .gte(createdColumn, formatISO(range.start))
    .lte(createdColumn, formatISO(range.end));

  if (filter) {
    query = filter(query);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to aggregate ${column} on ${table}: ${error.message}`);
  }

  const rows: any[] = Array.isArray(data) ? (data as any[]) : [];

  return rows.reduce((acc, row: any) => {
    const value = Number(row?.[column] ?? 0);
    return acc + (Number.isNaN(value) ? 0 : value);
  }, 0);
};

const fetchRows = async (
  table: string,
  columns: string,
  range: { start: Date; end: Date },
  filter?: QueryFilter,
  createdColumn = 'created_at',
) => {
  let query = supabase
    .from(table)
    .select(columns)
    .gte(createdColumn, formatISO(range.start))
    .lte(createdColumn, formatISO(range.end))
    .order(createdColumn, { ascending: true });

  if (filter) {
    query = filter(query);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch data from ${table}: ${error.message}`);
  }

  return data ?? [];
};

const buildTrend = (
  rows: any[],
  dateColumn: string,
  valueSelector: (row: any) => number,
): AnalyticsTrendPoint[] => {
  const buckets = new Map<string, number>();

  rows.forEach(row => {
    const isoDate = new Date(row[dateColumn]).toISOString().slice(0, 10);
    const current = buckets.get(isoDate) ?? 0;
    buckets.set(isoDate, current + valueSelector(row));
  });

  return Array.from(buckets.entries() as Iterable<[string, number]>)
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .map(([date, value]) => ({
      date,
      value,
      label: new Date(date).toLocaleDateString(undefined, ISO_DATE_FORMAT_OPTIONS),
    }));
};

const calculateDelta = (current: number, previous: number) => {
  if (previous === 0) {
    return {
      delta: current === 0 ? 0 : 100,
      deltaType: current === 0 ? 'stable' : 'increase',
    } as const;
  }

  const delta = Number((((current - previous) / previous) * 100).toFixed(1));
  let deltaType: 'increase' | 'decrease' | 'stable' = 'stable';
  if (delta > 0) {
    deltaType = 'increase';
  } else if (delta < 0) {
    deltaType = 'decrease';
  }

  return { delta, deltaType } as const;
};

export const fetchAnalyticsSummary = async (timeframe: Timeframe): Promise<AnalyticsSummaryResponse> => {
  const ranges = getDateRanges(timeframe);

  const [
    usersCurrent,
    usersPrevious,
    caregiversCurrent,
    caregiversPrevious,
    jobsCurrent,
    jobsPrevious,
    bookingsCurrent,
    bookingsPrevious,
    bookingRows,
    newUserRows,
  ] = await Promise.all([
    countRows('users', ranges.current),
    countRows('users', ranges.previous),
    countRows('users', ranges.current, query => query.eq('role', 'caregiver')),
    countRows('users', ranges.previous, query => query.eq('role', 'caregiver')),
    countRows('jobs', ranges.current),
    countRows('jobs', ranges.previous),
    countRows('bookings', ranges.current),
    countRows('bookings', ranges.previous),
    fetchRows('bookings', 'id, created_at', ranges.current),
    fetchRows('users', 'id, created_at', ranges.current),
  ]);

  let revenueAvailable = true;
  let revenueCurrent = 0;
  let revenuePrevious = 0;
  let paymentRows: Record<string, any>[] = [];

  try {
    revenueCurrent = await sumColumn('payments', 'total_amount', ranges.current, query => query.eq('payment_status', 'paid'));
    revenuePrevious = await sumColumn('payments', 'total_amount', ranges.previous, query => query.eq('payment_status', 'paid'));
    paymentRows = await fetchRows('payments', 'id, created_at, total_amount', ranges.current, query => query.eq('payment_status', 'paid'));
  } catch (error) {
    if (isTableMissingError(error)) {
      revenueAvailable = false;
      revenueCurrent = 0;
      revenuePrevious = 0;
      paymentRows = [];
    } else {
      throw error;
    }
  }

  const bookingsTrend = buildTrend(bookingRows, 'created_at', () => 1).slice(-10);
  const revenueTrend = revenueAvailable
    ? buildTrend(paymentRows, 'created_at', row => Number((row as Record<string, any>).total_amount ?? 0)).slice(-10)
    : [];
  const newUsersTrend = buildTrend(newUserRows, 'created_at', () => 1).slice(-10);

  const usersDelta = calculateDelta(usersCurrent, usersPrevious);
  const caregiversDelta = calculateDelta(caregiversCurrent, caregiversPrevious);
  const jobsDelta = calculateDelta(jobsCurrent, jobsPrevious);
  const bookingsDelta = calculateDelta(bookingsCurrent, bookingsPrevious);
  const revenueDelta = calculateDelta(revenueCurrent, revenuePrevious);

  return {
    timeframe,
    overview: {
      users: {
        label: 'Total Users',
        value: usersCurrent,
        ...usersDelta,
      },
      caregivers: {
        label: 'Active Caregivers',
        value: caregiversCurrent,
        ...caregiversDelta,
      },
      jobs: {
        label: 'Jobs Created',
        value: jobsCurrent,
        ...jobsDelta,
      },
      bookings: {
        label: 'Bookings',
        value: bookingsCurrent,
        ...bookingsDelta,
      },
      revenue: revenueAvailable
        ? {
            label: 'Revenue',
            value: Number(revenueCurrent.toFixed(2)),
            ...revenueDelta,
          }
        : undefined,
    },
    trends: {
      bookings: bookingsTrend,
      revenue: revenueAvailable ? revenueTrend : undefined,
      newUsers: newUsersTrend,
    },
  };
};
