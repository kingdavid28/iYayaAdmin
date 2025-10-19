import { adminApi } from "./apiService";
import type {
  ApiResponse,
  Booking,
  BookingRow,
  JobReference,
  MaybeRelation,
  UserReference,
} from "../types";

export interface FetchBookingsOptions {
  page?: number;
  limit?: number;
  status?: string;
}

export interface FetchBookingsResult {
  bookings: Booking[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

const DEFAULT_PAGE_SIZE = 20;

const resolveRelation = <T>(relation: MaybeRelation<T>): T | undefined => {
  if (!relation) {
    return undefined;
  }
  return Array.isArray(relation) ? relation[0] ?? undefined : relation;
};

const mapBookingRecord = (row: BookingRow | null | undefined): Booking => {
  const parent =
    resolveRelation<UserReference>(row?.parentId) ??
    resolveRelation<UserReference>(row?.parent) ??
    resolveRelation<UserReference>(row?.parent_id) ??
    resolveRelation<UserReference>(row?.parentInfo);

  const caregiver =
    resolveRelation<UserReference>(row?.caregiverId) ??
    resolveRelation<UserReference>(row?.caregiver) ??
    resolveRelation<UserReference>(row?.caregiver_id) ??
    resolveRelation<UserReference>(row?.caregiverInfo);

  const job =
    resolveRelation<JobReference>(row?.jobId) ??
    resolveRelation<JobReference>(row?.job) ??
    resolveRelation<JobReference>(row?.job_id) ??
    resolveRelation<JobReference>(row?.jobInfo);

  return {
    id: row?.id ?? "",
    status: row?.status ?? "pending",
    parentId: {
      name: parent?.name ?? "Unknown Parent",
      email: parent?.email ?? "unknown@example.com",
    },
    caregiverId: {
      name: caregiver?.name ?? "Unassigned",
      email: caregiver?.email ?? "unassigned@example.com",
    },
    jobId: {
      title: job?.title ?? "Untitled Job",
      location: job?.location ?? "Unknown Location",
    },
    startDate: row?.startDate ?? row?.start_date ?? row?.startAt ?? "",
    endDate: row?.endDate ?? row?.end_date ?? row?.endAt ?? "",
    totalHours: row?.totalHours ?? row?.total_hours ?? 0,
    hourlyRate: row?.hourlyRate ?? row?.hourly_rate ?? 0,
    totalAmount: row?.totalAmount ?? row?.total_amount ?? 0,
    createdAt: row?.createdAt ?? row?.created_at ?? new Date().toISOString(),
    updatedAt: row?.updatedAt ?? row?.updated_at ?? new Date().toISOString(),
  };
};

const handleBookingApiResponse = async (
  promise: Promise<ApiResponse<BookingRow>>,
  defaultError: string,
): Promise<Booking> => {
  const response = await promise;
  if (!response?.success) {
    throw new Error(response?.error || defaultError);
  }
  return mapBookingRecord(response.data);
};

export const fetchBookings = async (
  options: FetchBookingsOptions = {},
): Promise<FetchBookingsResult> => {
  const limit = Math.max(1, options.limit ?? DEFAULT_PAGE_SIZE);
  const page = Math.max(1, options.page ?? 1);

  const params: Record<string, string | number | undefined> = {
    page,
    limit,
  };
  if (options.status && options.status !== "all") {
    params.status = options.status;
  }

  const response = await adminApi.getBookings(params) as ApiResponse<BookingRow[]>;

  if (!response?.success) {
    throw new Error(response?.error || "Failed to fetch bookings");
  }

  const rows: BookingRow[] = Array.isArray(response.data) ? response.data : [];
  const bookings: Booking[] = rows.map(mapBookingRecord);
  const total = response.count ?? rows.length;
  const currentPage = response.currentPage ?? page;
  const totalPages =
    response.totalPages ?? Math.max(1, Math.ceil(total / limit));
  const hasMore = currentPage < totalPages;

  return {
    bookings,
    pagination: {
      page: currentPage,
      limit,
      total,
      hasMore,
    },
  };
};

export const updateBookingStatus = async (
  bookingId: string,
  status: Booking["status"],
  reason?: string,
) => {
  return handleBookingApiResponse(
    adminApi.updateBookingStatus(bookingId, status, reason) as Promise<ApiResponse<BookingRow>>,
    "Failed to update booking status",
  );
};

export const confirmBooking = async (bookingId: string, reason?: string) =>
  handleBookingApiResponse(
    adminApi.confirmBooking(bookingId, reason ? { reason } : undefined) as Promise<ApiResponse<BookingRow>>,
    "Failed to confirm booking",
  );

export const startBooking = async (bookingId: string) =>
  handleBookingApiResponse(
    adminApi.startBooking(bookingId) as Promise<ApiResponse<BookingRow>>,
    "Failed to start booking",
  );

export const completeBooking = async (bookingId: string) =>
  handleBookingApiResponse(
    adminApi.completeBooking(bookingId) as Promise<ApiResponse<BookingRow>>,
    "Failed to complete booking",
  );

export const cancelBooking = async (bookingId: string, reason?: string) =>
  handleBookingApiResponse(
    adminApi.cancelBooking(bookingId, reason ? { reason } : undefined) as Promise<ApiResponse<BookingRow>>,
    "Failed to cancel booking",
  );
