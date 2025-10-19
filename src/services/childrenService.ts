import { supabase } from '../config/supabase';
import type { ChildProfile } from '../types';

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
        dateOfBirth:date_of_birth,
        gender,
        specialNeeds:special_needs,
        allergies,
        medicalConditions:medical_conditions,
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

    return {
      id: row.id,
      parentId: row.parentId,
      parentInfo: {
        name: parent?.name ?? undefined,
        email: parent?.email ?? undefined,
      },
      name: row.name,
      dateOfBirth: row.dateOfBirth,
      gender: row.gender ?? undefined,
      specialNeeds: row.specialNeeds ?? undefined,
      allergies: row.allergies ?? undefined,
      medicalConditions: row.medicalConditions ?? undefined,
      emergencyContact: row.emergencyContact ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    } satisfies ChildProfile;
  });
};

export const updateChildNotes = async (childId: string, existingContact: Record<string, any> | null, notes: string) => {
  const updatedContact = {
    ...(existingContact ?? {}),
    adminNotes: notes || null,
  };

  const { error } = await supabase
    .from('children')
    .update({ emergency_contact: updatedContact })
    .eq('id', childId);

  if (error) {
    throw new Error(`Failed to update child profile: ${error.message}`);
  }
};

export const deleteChildProfile = async (childId: string) => {
  const { error } = await supabase.from('children').delete().eq('id', childId);

  if (error) {
    throw new Error(`Failed to delete child profile: ${error.message}`);
  }
};
