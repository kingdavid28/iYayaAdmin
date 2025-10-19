import { supabase } from "../config/supabase";
import { adminApi } from "./apiService";
import type { ApiResponse, Job, JobReference, JobRow, MaybeRelation, UserReference } from "../types";

export interface FetchJobsOptions {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

export interface FetchJobsResult {
  jobs: Job[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  stats: {
    total: number;
    active: number;
    inactive: number;
    completed: number;
    cancelled: number;
  };
}

const DEFAULT_PAGE_SIZE = 20;

const sanitizeSearchTerm = (term: string) =>
  term
    .trim()
    .replace(/[%_]/g, (match) => `\\${match}`)
    .replace(/,/g, "\\,");

const resolveRelation = <T>(relation: MaybeRelation<T>): T | undefined => {
  if (!relation) {
    return undefined;
  }
  return Array.isArray(relation) ? relation[0] ?? undefined : relation;
};

const applyFilters = <T extends {
  eq(column: string, value: unknown): T;
  or(filters: string): T;
}>(query: T, options: FetchJobsOptions): T => {
  let next = query;

  if (options.status && options.status !== "all") {
    next = next.eq("status", options.status);
  }

  if (options.search && options.search.trim()) {
    const sanitized = sanitizeSearchTerm(options.search);
    const orClause = ["title", "description", "location"]
      .map((column) => `${column}.ilike.%${sanitized}%`)
      .join(",");
    next = next.or(orClause);
  }

  return next;
};

const mapJobRecord = (row: JobRow | null | undefined): Job => {
  if (!row) {
    return {
      id: "",
      title: "Unknown Job",
      description: "",
      status: "pending",
      parentId: {
        name: "Unknown Parent",
        email: "unknown@example.com",
      },
      location: "Unknown location",
      budget: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  const parentSource =
    resolveRelation<UserReference>(row.parent) ??
    resolveRelation<UserReference>(row.parentId) ??
    resolveRelation<UserReference>(row.parent_id) ??
    resolveRelation<UserReference>(row.parentInfo);

  const caregiverSource =
    resolveRelation<UserReference>(row.caregiver) ??
    resolveRelation<UserReference>(row.caregiverId) ??
    resolveRelation<UserReference>(row.caregiver_id) ??
    resolveRelation<UserReference>(row.caregiverInfo);

  const jobDetails: JobReference | undefined =
    resolveRelation<JobReference>(row.job) ??
    resolveRelation<JobReference>(row.jobInfo) ??
    undefined;

  return {
    id: row.id,
    title: row.title ?? row.name ?? jobDetails?.title ?? "Untitled Job",
    description: row.description ?? "",
    status: row.status ?? "pending",
    location: row.location ?? jobDetails?.location ?? "Unknown location",
    budget: row.budget ?? jobDetails?.budget ?? 0,
    parentId: {
      name: parentSource?.name ?? "Unknown Parent",
      email: parentSource?.email ?? "unknown@example.com",
    },
    caregiverId: caregiverSource
      ? {
          name: caregiverSource.name ?? "Caregiver",
          email: caregiverSource.email ?? "caregiver@example.com",
        }
      : undefined,
    createdAt: row.createdAt ?? row.created_at ?? new Date().toISOString(),
    updatedAt: row.updatedAt ?? row.updated_at ?? new Date().toISOString(),
  };
};

const handleJobApiResponse = async (
  promise: Promise<ApiResponse<JobRow>>,
  defaultError: string,
): Promise<Job> => {
  const response = await promise;
  if (!response?.success) {
    throw new Error(response?.error || defaultError);
  }
  return mapJobRecord(response.data);
};

const countJobsWithFilters = async (
  options: FetchJobsOptions,
  status?: Job["status"],
): Promise<number> => {
  let query = supabase
    .from("jobs")
    .select("id", { count: "exact", head: true });
  query = applyFilters(query, options);
  if (status) {
    query = query.eq("status", status);
  }
  const { count, error } = await query;
  if (error) {
    throw new Error(`Failed to count jobs: ${error.message}`);
  }
  return count ?? 0;
};

export const fetchJobs = async (
  options: FetchJobsOptions = {},
): Promise<FetchJobsResult> => {
  const limit = Math.max(1, options.limit ?? DEFAULT_PAGE_SIZE);
  const page = Math.max(1, options.page ?? 1);
  const offset = (page - 1) * limit;

  let query = supabase
    .from("jobs")
    .select(
      `
        id,
        title,
        description,
        status,
        location,
        budget,
        parent:parent_id(name,email),
        caregiver:caregiver_id(name,email),
        createdAt:created_at,
        updatedAt:updated_at
      `,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  query = applyFilters(query, options);

  const { data, count, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch jobs: ${error.message}`);
  }

  const rows: JobRow[] = Array.isArray(data)
    ? data
    : data
    ? [data]
    : [];

  const jobs: Job[] = rows.map(mapJobRecord);

  const total = count ?? rows.length;
  const hasMore = offset + rows.length < total;

  const [active, inactive, completed, cancelled] = await Promise.all([
    countJobsWithFilters(options, "active"),
    countJobsWithFilters(options, "inactive"),
    countJobsWithFilters(options, "completed"),
    countJobsWithFilters(options, "cancelled"),
  ]);

  return {
    jobs,
    pagination: {
      page,
      limit,
      total,
      hasMore,
    },
    stats: {
      total,
      active,
      inactive,
      completed,
      cancelled,
    },
  };
};

export const updateJobStatus = async (
  jobId: string,
  status: Job["status"],
  reason?: string,
) => {
  return handleJobApiResponse(
    adminApi.updateJobStatus(jobId, status, reason) as Promise<ApiResponse<JobRow>>,
    "Failed to update job status",
  );
};

export const approveJob = async (jobId: string, reason?: string) =>
  handleJobApiResponse(
    adminApi.approveJob(jobId, reason ? { reason } : undefined) as Promise<ApiResponse<JobRow>>,
    "Failed to approve job",
  );

export const rejectJob = async (jobId: string, reason?: string) =>
  handleJobApiResponse(
    adminApi.rejectJob(jobId, reason ? { reason } : undefined) as Promise<ApiResponse<JobRow>>,
    "Failed to reject job",
  );

export const cancelJob = async (jobId: string, reason?: string) =>
  handleJobApiResponse(
    adminApi.cancelJob(jobId, reason ? { reason } : undefined) as Promise<ApiResponse<JobRow>>,
    "Failed to cancel job",
  );

export const completeJob = async (jobId: string) =>
  handleJobApiResponse(
    adminApi.completeJob(jobId) as Promise<ApiResponse<JobRow>>,
    "Failed to complete job",
  );

export const reopenJob = async (jobId: string) =>
  handleJobApiResponse(
    adminApi.reopenJob(jobId) as Promise<ApiResponse<JobRow>>,
    "Failed to reopen job",
  );

export const fetchJobById = async (jobId: string): Promise<Job | null> => {
  const { data, error } = await supabase
    .from("jobs")
    .select(
      `
        id,
        title,
        description,
        status,
        location,
        budget,
        parent:parent_id(name,email),
        caregiver:caregiver_id(name,email),
        createdAt:created_at,
        updatedAt:updated_at
      `,
    )
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch job: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return mapJobRecord(data);
};
