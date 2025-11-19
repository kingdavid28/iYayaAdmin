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

  const rowData = (row ?? {}) as Record<string, unknown>;

  const jobTitle =
    job?.title ??
    (typeof rowData.job_title === 'string' ? (rowData.job_title as string) : undefined) ??
    (typeof rowData.jobTitle === 'string' ? (rowData.jobTitle as string) : undefined) ??
    (typeof rowData.service_type === 'string' ? (rowData.service_type as string) : undefined) ??
    (typeof rowData.serviceType === 'string' ? (rowData.serviceType as string) : undefined) ??
    (typeof rowData.special_instructions === 'string' ? (rowData.special_instructions as string) : undefined) ??
    (typeof rowData.specialInstructions === 'string' ? (rowData.specialInstructions as string) : undefined) ??
    'Untitled Job';

  const jobLocation =
    job?.location ??
    (typeof rowData.job_location === 'string' ? (rowData.job_location as string) : undefined) ??
    (typeof rowData.jobLocation === 'string' ? (rowData.jobLocation as string) : undefined) ??
    (typeof rowData.address === 'string' ? (rowData.address as string) : undefined) ??
    (typeof rowData.location === 'string' ? (rowData.location as string) : undefined) ??
    'Unknown Location';

  const serviceDate =
    (typeof rowData.service_date === 'string' ? (rowData.service_date as string) : undefined) ??
    (typeof rowData.serviceDate === 'string' ? (rowData.serviceDate as string) : undefined) ??
    (typeof rowData.date === 'string' ? (rowData.date as string) : undefined);

  const startTime =
    (typeof rowData.start_time === 'string' ? (rowData.start_time as string) : undefined) ??
    (typeof rowData.startTime === 'string' ? (rowData.startTime as string) : undefined);

  const endTime =
    (typeof rowData.end_time === 'string' ? (rowData.end_time as string) : undefined) ??
    (typeof rowData.endTime === 'string' ? (rowData.endTime as string) : undefined);

  const contactPhone =
    (typeof rowData.contact_phone === 'string' ? (rowData.contact_phone as string) : undefined) ??
    (typeof rowData.contactPhone === 'string' ? (rowData.contactPhone as string) : undefined) ??
    null;

  const specialInstructions =
    (typeof rowData.special_instructions === 'string' ? (rowData.special_instructions as string) : undefined) ??
    (typeof rowData.specialInstructions === 'string' ? (rowData.specialInstructions as string) : undefined) ??
    null;

  const timeDisplay =
    (typeof rowData.time_display === 'string' ? (rowData.time_display as string) : undefined) ??
    (typeof rowData.timeDisplay === 'string' ? (rowData.timeDisplay as string) : undefined) ??
    null;

  const emergencyContactRaw =
    (rowData.emergency_contact as unknown) ??
    rowData.emergencyContact ??
    rowData.emergencyContactInfo ??
    null;

  let emergencyContact: Booking['emergencyContact'] = null;
  if (typeof emergencyContactRaw === 'string') {
    try {
      const parsed = JSON.parse(emergencyContactRaw);
      emergencyContact = {
        name: typeof parsed?.name === 'string' ? parsed.name : undefined,
        phone: typeof parsed?.phone === 'string' ? parsed.phone : undefined,
        relation: typeof parsed?.relation === 'string' ? parsed.relation : undefined,
      };
    } catch {
      // ignore malformed JSON
    }
  } else if (emergencyContactRaw && typeof emergencyContactRaw === 'object') {
    const contactObj = emergencyContactRaw as Record<string, unknown>;
    emergencyContact = {
      name: typeof contactObj.name === 'string' ? contactObj.name : undefined,
      phone: typeof contactObj.phone === 'string' ? contactObj.phone : undefined,
      relation: typeof contactObj.relation === 'string' ? contactObj.relation : undefined,
    };
  }

  const selectedChildrenRaw =
    (rowData.selected_children as unknown) ??
    rowData.selectedChildren ??
    null;

  let selectedChildren: Booking['selectedChildren'] = null;
  if (Array.isArray(selectedChildrenRaw)) {
    selectedChildren = selectedChildrenRaw.map((child) => {
      const childRecord = child as Record<string, unknown>;
      return {
        name: typeof childRecord.name === 'string' ? childRecord.name : undefined,
        age: typeof childRecord.age === 'number' ? childRecord.age : undefined,
        allergies: typeof childRecord.allergies === 'string' ? childRecord.allergies : undefined,
        preferences: typeof childRecord.preferences === 'string' ? childRecord.preferences : undefined,
        specialInstructions:
          typeof childRecord.specialInstructions === 'string'
            ? childRecord.specialInstructions
            : typeof childRecord.special_instructions === 'string'
              ? (childRecord.special_instructions as string)
              : undefined,
      };
    });
  } else if (typeof selectedChildrenRaw === 'string') {
    try {
      const parsed = JSON.parse(selectedChildrenRaw);
      if (Array.isArray(parsed)) {
        selectedChildren = parsed.map((child) => {
          const childRecord = child as Record<string, unknown>;
          return {
            name: typeof childRecord.name === 'string' ? childRecord.name : undefined,
            age: typeof childRecord.age === 'number' ? childRecord.age : undefined,
            allergies: typeof childRecord.allergies === 'string' ? childRecord.allergies : undefined,
            preferences: typeof childRecord.preferences === 'string' ? childRecord.preferences : undefined,
            specialInstructions:
              typeof childRecord.specialInstructions === 'string'
                ? childRecord.specialInstructions
                : typeof childRecord.special_instructions === 'string'
                  ? (childRecord.special_instructions as string)
                  : undefined,
          };
        });
      }
    } catch {
      // ignore malformed JSON
    }
  }

  const totalHours = (() => {
    const directHours =
      (typeof row?.totalHours === 'number' ? row.totalHours : undefined) ??
      (typeof row?.total_hours === 'number' ? (row.total_hours as number) : undefined);

    if (typeof directHours === 'number' && !Number.isNaN(directHours) && directHours > 0) {
      return directHours;
    }

    if (typeof startTime === 'string' && typeof endTime === 'string') {
      const [startHour = '0', startMinute = '0'] = startTime.split(':');
      const [endHour = '0', endMinute = '0'] = endTime.split(':');

      const startDate = new Date(0, 0, 0, Number(startHour), Number(startMinute));
      const endDate = new Date(0, 0, 0, Number(endHour), Number(endMinute));

      const diffMs = endDate.getTime() - startDate.getTime();
      if (diffMs > 0) {
        return Number((diffMs / (1000 * 60 * 60)).toFixed(2));
      }
    }

    return 0;
  })();

  return {
    id: row?.id ?? '',
    status: row?.status ?? 'pending',
    parentId: {
      name: parent?.name ?? 'Unknown Parent',
      email: parent?.email ?? "unknown@example.com",
    },
    caregiverId: {
      name: caregiver?.name ?? 'Unassigned',
      email: caregiver?.email ?? 'unassigned@example.com',
    },
    jobId: {
      title: jobTitle,
      location: jobLocation,
    },
    startDate: row?.startDate ?? row?.start_date ?? row?.startAt ?? "",
    endDate: row?.endDate ?? row?.end_date ?? row?.endAt ?? "",
    serviceDate,
    startTime,
    endTime,
    totalHours,
    hourlyRate: row?.hourlyRate ?? row?.hourly_rate ?? 0,
    totalAmount: row?.totalAmount ?? row?.total_amount ?? 0,
    createdAt: row?.createdAt ?? row?.created_at ?? new Date().toISOString(),
    updatedAt: row?.updatedAt ?? row?.updated_at ?? new Date().toISOString(),
    contactPhone,
    specialInstructions,
    emergencyContact,
    selectedChildren,
    timeDisplay,
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

export const fetchBookingById = async (bookingId: string): Promise<Booking> => {
  const response = await adminApi.getBookingById(bookingId) as ApiResponse<BookingRow>;

  if (!response?.success) {
    throw new Error(response?.error || "Failed to fetch booking detail");
  }

  return mapBookingRecord(response.data);
};
