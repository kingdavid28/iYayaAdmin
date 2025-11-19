import { supabase } from '../config/supabase';
import type { ChildProfile } from '../types';
import { adminApi } from './apiService';

export interface FetchChildrenOptions {
  search?: string;
}

export const fetchChildren = async (options: FetchChildrenOptions = {}): Promise<ChildProfile[]> => {
  let query = supabase
    .from('children')
    .select(`
      id,
      parent_id,
      name,
      gender,
      special_needs,
      allergies,
      notes,
      emergency_contact,
      created_at,
      updated_at,
      parent:parent_id (id, name, email)
    `)
    .order('created_at', { ascending: false });

  if (options.search && options.search.trim()) {
    query = query.ilike('name', `%${options.search.trim()}%`);
  }

  const {data, error} = await query;

  if (error) {
    console.error('[childrenService] fetch error:', error);
    throw new Error(`Failed to fetch child profiles: ${error.message}`);
  }

  return (data ?? []).map(row => {
    const rawParent = Array.isArray(row.parent) ? row.parent[0] : row.parent;
    const parentRecord = (rawParent ?? null) as Record<string, unknown> | null;
    const parentName = typeof parentRecord?.name === 'string' ? (parentRecord.name as string) : undefined;
    const parentEmail = typeof parentRecord?.email === 'string' ? (parentRecord.email as string) : undefined;

    const parentInfo = parentName || parentEmail
      ? {
          name: parentName,
          email: parentEmail,
        }
      : undefined;

    return {
      id: row.id,
      parentId: row.parent_id,
      parentInfo,
      name: row.name,
      gender: row.gender,
      specialNeeds: row.special_needs,
      allergies: row.allergies,
      notes: row.notes,
      emergencyContact: row.emergency_contact,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
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
