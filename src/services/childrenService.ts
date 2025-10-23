import { supabase } from '../config/supabase';
import type { ChildProfile } from '../types';
import { adminApi } from './apiService';

export interface FetchChildrenOptions {
  search?: string;
}

const sanitizeSearchTerm = (term: string) =>
  term
    .trim()
    .replace(/[%_]/g, match => `\\${match}`)
    .replace(/,/g, '\\,');

export const fetchChildren = async (options: FetchChildrenOptions = {}): Promise<ChildProfile[]> => {
  let query = supabase
    .from('children')
    .select(
      `
        id,
        parentId:parent_id,
        parent:parent_id(id,name,email),
        name,
        gender,
        specialNeeds:special_needs,
        allergies,
        notes,
        emergencyContact:emergency_contact,
        createdAt:created_at,
        updatedAt:updated_at
      `
    )
    .order('created_at', { ascending: false });

  if (options.search && options.search.trim()) {
    const sanitized = sanitizeSearchTerm(options.search);
    const orClause = ['name', 'parent_id.name', 'parent_id.email']
      .map(column => `${column}.ilike.%${sanitized}%`)
      .join(',');
    query = query.or(orClause);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch child profiles: ${error.message}`);
  }

  return (data ?? []).map((row: any) => {
    const parent = Array.isArray(row.parent) ? row.parent[0] : row.parent;
    let emergencyContact = row.emergencyContact ?? null;

    if (typeof emergencyContact === 'string') {
      try {
        emergencyContact = JSON.parse(emergencyContact);
      } catch (error) {
        console.warn('[childrenService] Failed to parse emergency_contact JSON', error);
      }
    }

    return {
      id: row.id,
      parentId: row.parentId,
      parentInfo: {
        name: parent?.name ?? undefined,
        email: parent?.email ?? undefined,
      },
      name: row.name,
      specialNeeds: row.specialNeeds ?? undefined,
      allergies: row.allergies ?? undefined,
      notes: row.notes ?? undefined,
      emergencyContact,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    } satisfies ChildProfile;
  });
};

export const updateChildNotes = async (childId: string, existingContact: Record<string, any> | null, notes: string) => {
  const trimmed = notes.trim();
  const updatedContact = {
    ...(existingContact ?? {}),
    adminNotes: trimmed.length ? trimmed : null,
  };

  const { error } = await supabase
    .from('children')
    .update({
      notes: trimmed.length ? trimmed : null,
      emergency_contact: updatedContact,
    })
    .eq('id', childId);

  if (error) {
    throw new Error(`Failed to update child profile: ${error.message}`);
  }

  console.log('[children] updated note for', childId);
};

export const deleteChildProfile = async (childId: string) => {
  console.log('[children] delete request for', childId);
  try {
    await adminApi.deleteChildProfile(childId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to delete child profile: ${message}`);
  }
};
