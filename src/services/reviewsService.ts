import { supabase } from '../config/supabase';
import type { Review, MaybeRelation, UserReference } from '../types';

export interface FetchReviewsOptions {
  status?: 'published' | 'hidden';
  rating?: number;
  search?: string;
}

const sanitizeSearchTerm = (term: string) =>
  term
    .trim()
    .replace(/[%_]/g, match => `\\${match}`)
    .replace(/,/g, '\\,');

interface ReviewRow {
  id: string;
  bookingId?: string | null;
  booking_id?: string | null;
  reviewerId?: string | null;
  reviewer_id?: MaybeRelation<UserReference>;
  revieweeId?: string | null;
  reviewee_id?: MaybeRelation<UserReference>;
  caregiverId?: string | null;
  caregiver_id?: MaybeRelation<UserReference>;
  rating?: number | null;
  comment?: string | null;
  status?: 'published' | 'hidden' | null;
  createdAt?: string | null;
  created_at?: string | null;
  updatedAt?: string | null;
  updated_at?: string | null;
  reviewer?: MaybeRelation<UserReference>;
  reviewee?: MaybeRelation<UserReference>;
  caregiver?: MaybeRelation<UserReference>;
}

const resolveRelation = <T>(relation: MaybeRelation<T>): T | undefined => {
  if (!relation) {
    return undefined;
  }
  return Array.isArray(relation) ? relation[0] ?? undefined : relation;
};

const applyFilters = <T extends {
  eq(column: string, value: unknown): T;
  or(filters: string): T;
}>(query: T, options: FetchReviewsOptions) => {
  let next = query;

  if (options.status && options.status !== 'published') {
    next = next.eq('status', options.status);
  } else if (options.status === 'published') {
    next = next.or('status.is.null,status.eq.published');
  }

  if (options.rating && options.rating > 0) {
    next = next.eq('rating', options.rating);
  }

  if (options.search && options.search.trim()) {
    const sanitized = sanitizeSearchTerm(options.search);
    const orClause = ['comment', 'reviewer.name', 'reviewee.name']
      .map(column => `${column}.ilike.%${sanitized}%`)
      .join(',');
    next = next.or(orClause);
  }

  return next;
};

export const fetchReviews = async (options: FetchReviewsOptions = {}): Promise<Review[]> => {
  let query = supabase
    .from('reviews')
    .select(
      `
        id,
        booking_id,
        status,
        moderation_note,
        rating,
        comment,
        created_at,
        updated_at,
        caregiver:caregiver_id(id,name,email,role)
      `
    )
    .order('created_at', { ascending: false });

  query = applyFilters(query, options);

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch reviews: ${error.message}`);
  }

  const rows: ReviewRow[] = Array.isArray(data) ? data : data ? [data] : [];

  return rows.map(row => {
    const reviewer =
      resolveRelation<UserReference>(row.reviewer) ??
      resolveRelation<UserReference>(row.reviewer_id);

    const reviewee =
      resolveRelation<UserReference>(row.reviewee) ??
      resolveRelation<UserReference>(row.reviewee_id);

    const caregiver =
      resolveRelation<UserReference>(row.caregiver) ??
      resolveRelation<UserReference>(row.caregiver_id);

    return {
      id: row.id,
      bookingId: row.booking_id ?? '',
      caregiverId: caregiver?.id ?? null,
      rating: row.rating ?? 0,
      comment: row.comment ?? null,
      status: row.status ?? 'published',
      createdAt: row.created_at ?? new Date().toISOString(),
      updatedAt: row.updated_at ?? new Date().toISOString(),
      reviewerInfo: {
        name: reviewer?.name ?? 'Unknown Reviewer',
        email: reviewer?.email ?? 'unknown@example.com',
        role: reviewer?.role,
      },
      revieweeInfo: {
        name: reviewee?.name ?? 'Unknown User',
        email: reviewee?.email ?? 'unknown@example.com',
        role: reviewee?.role,
      },
    } as Review;
  });
};

interface UpdateReviewPayload {
  status: 'published' | 'hidden';
  moderation_note?: string | null;
}

export const updateReviewStatus = async (
  reviewId: string,
  status: 'published' | 'hidden',
  note?: string,
) => {
  const payload: UpdateReviewPayload = { status };
  if (note !== undefined) {
    payload.moderation_note = note || null;
  }

  const { error } = await supabase
    .from('reviews')
    .update(payload)
    .eq('id', reviewId);

  if (error) {
    throw new Error(`Failed to update review status: ${error.message}`);
  }
};

export const deleteReview = async (reviewId: string) => {
  const { error } = await supabase
    .from('reviews')
    .delete()
    .eq('id', reviewId);

  if (error) {
    throw new Error(`Failed to delete review: ${error.message}`);
  }
};
