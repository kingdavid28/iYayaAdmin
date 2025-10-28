// src/hooks/useChildren.ts
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../config/supabase';
import type { ChildProfile } from '../types';

export interface UseChildrenParams {
  pageSize?: number;
  search?: string;
  organizationId?: string | null;
}

export interface UseChildrenResult {
  children: ChildProfile[];
  loading: boolean;
  error: string | null;
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  goToNextPage: () => void;
  goToPreviousPage: () => void;
  goToPage: (page: number) => void;
  refresh: () => Promise<void>;
}

interface ChildRow {
  id: string;
  parent_id: string;
  name: string;
  birth_date?: string | null;
  gender?: string | null;
  special_needs?: string | string[] | null;
  allergies?: string | null;
  notes?: string | null;
  emergency_contact?: unknown;
  created_at: string;
  updated_at: string;
  parent?:
    | null
    | {
        id?: string | null;
        name?: string | null;
        email?: string | null;
      }
    | Array<{
        id?: string | null;
        name?: string | null;
        email?: string | null;
      }>;
}

const mapRowToChild = (row: ChildRow): ChildProfile => {
  const parent = Array.isArray(row?.parent) ? row.parent[0] : row?.parent;
  const emergencyContact = typeof row?.emergency_contact === 'string'
    ? (() => {
        try {
          return JSON.parse(row.emergency_contact);
        } catch (_error) {
          return row.emergency_contact;
        }
      })()
    : row?.emergency_contact ?? null;

  return {
    id: row.id,
    parentId: row.parent_id,
    parentInfo: parent
      ? {
          name: parent.name ?? undefined,
          email: parent.email ?? undefined,
        }
      : undefined,
    name: row.name,
    birthDate: row.birth_date ?? null,
    gender: row.gender === 'male' || row.gender === 'female' || row.gender === 'other' ? row.gender : undefined,
    specialNeeds: Array.isArray(row.special_needs)
      ? row.special_needs.join(', ')
      : row.special_needs ?? undefined,
    allergies: row.allergies ?? undefined,
    notes: row.notes ?? undefined,
    emergencyContact,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } satisfies ChildProfile;
};

const sanitizeSearch = (value?: string) => value?.trim().replace(/[%_]/g, match => `\\${match}`) ?? '';

export const useChildren = (params: UseChildrenParams = {}): UseChildrenResult => {
  const { pageSize = 20, search, organizationId } = params;

  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  const fetchChildren = useCallback(
    async (pageNumber: number) => {
      setLoading(true);
      setError(null);

      const sanitizedSearch = sanitizeSearch(search);
      const from = (pageNumber - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('children')
        .select(
          `
            id,
            parent_id,
            name,
            birth_date,
            gender,
            special_needs,
            allergies,
            notes,
            emergency_contact,
            created_at,
            updated_at,
            parent:parent_id (id, name, email)
          `,
          { count: 'exact' }
        )
        .order('created_at', { ascending: false })
        .range(from, to);

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      if (sanitizedSearch) {
        query = query.ilike('name', `%${sanitizedSearch}%`);
      }

      const { data, error: queryError, count } = await query;

      if (queryError) {
        setError(queryError.message);
        setChildren([]);
        setTotalCount(0);
        setTotalPages(1);
        setLoading(false);
        return;
      }

      setChildren((data ?? []).map(mapRowToChild));
      const resolvedCount = count ?? data?.length ?? 0;
      setTotalCount(resolvedCount);
      setTotalPages(Math.max(1, Math.ceil((resolvedCount || 1) / pageSize)));
      setLoading(false);
    },
    [pageSize, search]
  );

  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  useEffect(() => {
    fetchChildren(page)
      .catch(error => {
        const message = error instanceof Error ? error.message : 'Failed to fetch child profiles';
        setError(message);
        setChildren([]);
        setTotalCount(0);
        setTotalPages(1);
        setLoading(false);
      });
  }, [fetchChildren, page]);

  const refresh = useCallback(async () => {
    await fetchChildren(page);
  }, [fetchChildren, page]);

  const goToPage = useCallback(
    (targetPage: number) => {
      setPage(prev => {
        const clamped = Math.max(1, Math.min(targetPage, totalPages || targetPage));
        return prev === clamped ? prev : clamped;
      });
    },
    [totalPages]
  );

  const goToNextPage = useCallback(() => {
    setPage(prev => Math.min(prev + 1, totalPages));
  }, [totalPages]);

  const goToPreviousPage = useCallback(() => {
    setPage(prev => Math.max(prev - 1, 1));
  }, []);

  return useMemo(
    () => ({
      children,
      loading,
      error,
      page,
      totalPages,
      totalCount,
      pageSize,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      goToNextPage,
      goToPreviousPage,
      goToPage,
      refresh,
    }),
    [children, error, goToNextPage, goToPage, goToPreviousPage, loading, page, pageSize, refresh, totalCount, totalPages]
  );
};