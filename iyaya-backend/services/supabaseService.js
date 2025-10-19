/**
 * Supabase Database Service Layer
 * Replaces MongoDB/Mongoose models with Supabase operations
 */

const { supabase } = require('../config/supabase');

/**
 * User Service - Handles all user-related database operations
 */
class UserService {

  /**
   * Create a new user
   */
  static async create(userData) {
    const { data, error } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Find user by ID
   */
  static async findById(id) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  /**
   * Find user by ID with caregiver profile/background details
   */
  static async findDetailedById(id) {
    const { data, error } = await supabase
      .from('users')
      .select(`
        *,
        caregiver_profiles(*),
        caregiver_background_checks!caregiver_background_checks_user_id_fkey(*)
      `)
      .eq('id', id)
      .single();

    if (!error || error.code === 'PGRST116') return data;

    const relationshipError = ['PGRST200', 'PGRST201'].includes(error.code);
    if (!relationshipError) throw error;

    const user = await this.findById(id);
    if (!user) return null;

    const [profileResult, backgroundResult] = await Promise.all([
      supabase.from('caregiver_profiles').select('*').eq('user_id', id).maybeSingle(),
      supabase.from('caregiver_background_checks').select('*').eq('user_id', id)
    ]);

    if (profileResult.error && profileResult.error.code !== 'PGRST116') throw profileResult.error;
    if (backgroundResult.error) throw backgroundResult.error;

    user.caregiver_profiles = profileResult.data || null;
    user.caregiver_background_checks = backgroundResult.data || [];
    return user;
  }

  /**
   * Find user by email
   */
  static async findByEmail(email) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  /**
   * Update user
   */
  static async update(id, updates) {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Delete user
   */
  static async delete(id) {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  /**
   * Get users with pagination and filters
   */
  static async getUsers({ page = 1, limit = 10, role, status, search, includeProfile = false } = {}) {
    let selectColumns = '*';
    if (includeProfile) {
      selectColumns += ', caregiver_profiles(*), caregiver_background_checks!caregiver_background_checks_user_id_fkey(*)';
    }

    let query = supabase.from('users').select(selectColumns, { count: 'exact' });

    if (role) query = query.eq('role', role);
    if (status) query = query.eq('status', status);
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const offset = (page - 1) * limit;
    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      const relationshipMissing =
        includeProfile &&
        ((typeof error.message === 'string' && error.message.toLowerCase().includes('relationship')) ||
          ['PGRST200', 'PGRST201'].includes(error.code));

      if (!relationshipMissing) throw error;

      console.warn(
        '[UserService.getUsers] Relationship missing when joining caregiver data – retrying with manual merge.',
      );

      const baseResult = await this.getUsers({
        page,
        limit,
        role,
        status,
        search,
        includeProfile: false,
      });

      if (!includeProfile) return baseResult;

      const userIds = baseResult.users.map((user) => user.id).filter(Boolean);
      if (!userIds.length) return baseResult;

      const [profilesResult, backgroundResult] = await Promise.all([
        supabase.from('caregiver_profiles').select('*').in('user_id', userIds),
        supabase.from('caregiver_background_checks').select('*').in('user_id', userIds)
      ]);

      if (profilesResult.error) throw profilesResult.error;
      if (backgroundResult.error) throw backgroundResult.error;

      const profilesByUser = new Map();
      (profilesResult.data || []).forEach((profile) => {
        profilesByUser.set(profile.user_id, profile);
      });

      const backgroundByUser = new Map();
      (backgroundResult.data || []).forEach((record) => {
        const list = backgroundByUser.get(record.user_id) || [];
        list.push(record);
        backgroundByUser.set(record.user_id, list);
      });

      const usersWithRelations = baseResult.users.map((user) => ({
        ...user,
        caregiver_profiles: profilesByUser.get(user.id) || null,
        caregiver_background_checks: backgroundByUser.get(user.id) || []
      }));

      return {
        ...baseResult,
        users: usersWithRelations
      };
    }

    return { users: data, total: count, page, limit };
  }

  static async getUserCounts({ role, search } = {}) {
    const buildQuery = () => {
      let query = supabase.from('users').select('id', { count: 'exact', head: true });
      if (role) query = query.eq('role', role);
      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
      }
      return query;
    };

    const makeCount = async (status) => {
      let query = buildQuery();
      if (status) {
        query = query.eq('status', status);
      }
      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    };

    const [total, active, suspended, banned, inactive] = await Promise.all([
      makeCount(),
      makeCount('active'),
      makeCount('suspended'),
      makeCount('banned'),
      makeCount('inactive')
    ]);

    return { total, active, suspended, banned, inactive };
  }

  /**
   * Update user status
   */
  static async updateStatus(id, status, { reason, adminId } = {}) {
    const now = new Date().toISOString();
    const updates = {
      status,
      status_reason: reason ?? null,
      status_updated_at: now,
      status_updated_by: adminId ?? null
    };

    return this.update(id, updates);
  }

  /**
   * Soft delete user by marking inactive and recording deletion metadata
   */
  static async softDelete(id, { deletedBy, reason } = {}) {
    const now = new Date().toISOString();
    return this.update(id, {
      status: 'inactive',
      status_reason: reason ?? 'Account deleted by administrator',
      deleted_at: now,
      deleted_by: deletedBy ?? null,
      status_updated_at: now,
      status_updated_by: deletedBy ?? null
    });
  }

  /**
   * Count users by role
   */
  static async countByRole(role) {
    const { count, error } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role', role);

    if (error) throw error;
    return count || 0;
  }

  /**
   * Fetch most recent users
   */
  static async getRecentUsers(limit = 5) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }
}

/**
 * Conversation Service - Handles messaging conversations
 */
class ConversationService {

  static async create(participant1, participant2, type = 'admin_user') {
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        participant_1: participant1,
        participant_2: participant2,
        type
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async findById(id) {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  static async findByParticipants(user1, user2) {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .or(`and(participant_1.eq.${user1},participant_2.eq.${user2}),and(participant_1.eq.${user2},participant_2.eq.${user1})`)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  static async getUserConversations(userId) {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
      .order('last_message_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  static async updateLastMessage(id, timestamp) {
    const { data, error } = await supabase
      .from('conversations')
      .update({ last_message_at: timestamp })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

/**
 * Message Service - Handles individual messages
 */
class MessageService {

  static async create(messageData) {
    const { data, error } = await supabase
      .from('messages')
      .insert(messageData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getByConversation(conversationId) {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  }

  static async markAsRead(messageId, timestamp) {
    const { data, error } = await supabase
      .from('messages')
      .update({ read_at: timestamp })
      .eq('id', messageId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getUnreadCount(userId) {
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', userId)
      .is('read_at', null);

    if (error) throw error;
    return count || 0;
  }
}

/**
 * Job Service - Handles job listings and applications
 */
class JobService {

  static async create(jobData) {
    const { data, error } = await supabase
      .from('jobs')
      .insert(jobData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async findById(id) {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  static async getJobs({ page = 1, limit = 10, status, search } = {}) {
    let query = supabase
      .from('jobs')
      .select(
        `
        id,
        title,
        description,
        status,
        job_status:status,
        location,
        budget:hourly_rate,
        parent_id,
        caregiver_id,
        created_at,
        updated_at,
        parent:parent_id ( id, name, email, profile_image )
      `,
        { count: 'exact' }
      );

    if (status) query = query.eq('status', status);
    query = JobService.applyJobSearchFilter(query, search);

    const offset = (page - 1) * limit;
    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;
    return { jobs: data, total: count, page, limit, stats: { total: count } };
    return { jobs: data, total: count, page, limit };
  }

  static async updateStatus(id, status) {
    const { data, error } = await supabase
      .from('jobs')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

/**
 * Booking Service - Handles booking operations
 */
class BookingService {

  static async create(bookingData) {
    const { data, error } = await supabase
      .from('bookings')
      .insert(bookingData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async findById(id) {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  static async getBookings({ page = 1, limit = 10, status, search } = {}) {
    let query = supabase
      .from('bookings')
      .select(
        `*,
        parent:parent_id ( id, name, email, profile_image ),
        caregiver:caregiver_id ( id, name, email, profile_image ),
        job:job_id ( id, title, job_status:status )
      `,
        { count: 'exact' }
      );

    if (status) query = query.eq('status', status);
    if (search) {
      query = query.or(
        `parent.name.ilike.%${search}%,parent.email.ilike.%${search}%,caregiver.name.ilike.%${search}%,caregiver.email.ilike.%${search}%`
      );
    }

    const offset = (page - 1) * limit;
    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;
    return { bookings: data, total: count, page, limit };
  }

  static async updateStatus(id, status) {
    const { data, error } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

/**
 * Audit Log Service - Handles audit logging
 */
class AuditLogService {

  static async create(logData) {
    const { data, error } = await supabase
      .from('audit_logs')
      .insert(logData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getLogs({ page = 1, limit = 10, action, targetId, adminId } = {}) {
    let query = supabase.from('audit_logs').select('*', { count: 'exact' });

    if (action) query = query.eq('action', action);
    if (targetId) query = query.eq('target_id', targetId);
    if (adminId) query = query.eq('admin_id', adminId);

    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return { logs: data, total: count, page, limit };
  }
}

class AuthAdminService {
  static async createUser({ email, password, phone, role = 'parent', name, emailConfirm = true, userMetadata = {}, appMetadata = {} } = {}) {
    const payload = {
      email,
      email_confirm: emailConfirm,
      user_metadata: {
        name,
        role,
        phone,
        ...userMetadata
      },
      app_metadata: {
        role,
        ...appMetadata
      }
    };

    if (password) {
      payload.password = password;
    }

    const { data, error } = await supabase.auth.admin.createUser(payload);

    if (error) throw error;
    return data?.user || null;
  }

  static async updateUser(userId, { email, password, phone, role, name, userMetadata = {}, appMetadata = {}, banDuration } = {}) {
    const updatePayload = {};

    if (email) updatePayload.email = email;
    if (password) updatePayload.password = password;
    if (typeof banDuration !== 'undefined') updatePayload.ban_duration = banDuration;

    const metadata = {
      ...(userMetadata || {}),
      ...(name ? { name } : {}),
      ...(phone ? { phone } : {})
    };
    if (role) metadata.role = role;
    if (Object.keys(metadata).length) {
      updatePayload.user_metadata = metadata;
    }

    const appMeta = {
      ...(appMetadata || {})
    };
    if (role) appMeta.role = role;
    if (Object.keys(appMeta).length) {
      updatePayload.app_metadata = appMeta;
    }

    const { data, error } = await supabase.auth.admin.updateUserById(userId, updatePayload);

    if (error) throw error;
    return data?.user || null;
  }

  static async deleteUser(userId) {
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) throw error;
    return true;
  }
}

class CaregiverProfileService {
  static async getByUserId(userId) {
    const { data, error } = await supabase
      .from('caregiver_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  static async upsert(userId, profileData = {}) {
    const payload = { user_id: userId, ...profileData };
    const { data, error } = await supabase
      .from('caregiver_profiles')
      .upsert(payload, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async update(userId, updates) {
    const { data, error } = await supabase
      .from('caregiver_profiles')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async delete(userId) {
    const { error } = await supabase
      .from('caregiver_profiles')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  }

  static async updateVerification(userId, verificationUpdates = {}) {
    const existing = await this.getByUserId(userId);
    const verification = {
      ...(existing?.verification || {}),
      ...verificationUpdates
    };

    return this.upsert(userId, {
      ...(existing || {}),
      verification
    });
  }
}

class CaregiverDocumentService {
  static async listByUser(userId) {
    const { data, error } = await supabase
      .from('caregiver_documents')
      .select('*')
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async create(userId, documentData) {
    const payload = { user_id: userId, ...documentData };
    const { data, error } = await supabase
      .from('caregiver_documents')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async update(documentId, updates) {
    const { data, error } = await supabase
      .from('caregiver_documents')
      .update(updates)
      .eq('id', documentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async delete(documentId) {
    const { error } = await supabase
      .from('caregiver_documents')
      .delete()
      .eq('id', documentId);

    if (error) throw error;
    return true;
  }

  static async markVerified(documentId, { adminId, verifiedAt = new Date().toISOString(), verified = true } = {}) {
    return this.update(documentId, {
      verified,
      verified_at: verified ? verifiedAt : null,
      verified_by: verified ? adminId ?? null : null
    });
  }
}

class BackgroundCheckService {
  static async getByUserId(userId) {
    const { data, error } = await supabase
      .from('caregiver_background_checks')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  static async upsert(userId, payload = {}) {
    const { data, error } = await supabase
      .from('caregiver_background_checks')
      .upsert({ user_id: userId, ...payload }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async updateStatus(userId, { status, provider, check_types, notes, verifiedBy, verifiedAt, completedAt, requestedAt, expiryDate } = {}) {
    const existing = await this.getByUserId(userId);
    const updates = {
      status: status ?? existing?.status ?? 'not_started',
      provider: provider ?? existing?.provider ?? 'internal',
      check_types: check_types ?? existing?.check_types ?? [],
      notes: notes ?? existing?.notes ?? null,
      verified_by: verifiedBy ?? existing?.verified_by ?? null,
      verified_at: verifiedAt ?? existing?.verified_at ?? null,
      completed_at: completedAt ?? existing?.completed_at ?? null,
      requested_at: requestedAt ?? existing?.requested_at ?? null,
      expiry_date: expiryDate ?? existing?.expiry_date ?? null
    };

    return this.upsert(userId, updates);
  }
}

class UserStatusHistoryService {
  static async logChange({ userId, status, reason, changedBy }) {
    const payload = {
      user_id: userId,
      status,
      reason: reason ?? null,
      changed_by: changedBy ?? null,
      changed_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('user_status_history')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async listByUser(userId, { limit = 20 } = {}) {
    const { data, error } = await supabase
      .from('user_status_history')
      .select('*')
      .eq('user_id', userId)
      .order('changed_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }
}

const DEFAULT_SYSTEM_SETTINGS = {
  maintenance_mode: false,
  registration_enabled: true,
  email_verification_required: true,
  background_check_required: true
};

class SystemSettingsService {
  static toCamel(record = DEFAULT_SYSTEM_SETTINGS) {
    return {
      maintenanceMode:
        typeof record.maintenance_mode === 'boolean'
          ? record.maintenance_mode
          : DEFAULT_SYSTEM_SETTINGS.maintenance_mode,
      registrationEnabled:
        typeof record.registration_enabled === 'boolean'
          ? record.registration_enabled
          : DEFAULT_SYSTEM_SETTINGS.registration_enabled,
      emailVerificationRequired:
        typeof record.email_verification_required === 'boolean'
          ? record.email_verification_required
          : DEFAULT_SYSTEM_SETTINGS.email_verification_required,
      backgroundCheckRequired:
        typeof record.background_check_required === 'boolean'
          ? record.background_check_required
          : DEFAULT_SYSTEM_SETTINGS.background_check_required
    };
  }

  static toSnake(settings = {}) {
    return {
      maintenance_mode:
        typeof settings.maintenanceMode === 'boolean'
          ? settings.maintenanceMode
          : DEFAULT_SYSTEM_SETTINGS.maintenance_mode,
      registration_enabled:
        typeof settings.registrationEnabled === 'boolean'
          ? settings.registrationEnabled
          : DEFAULT_SYSTEM_SETTINGS.registration_enabled,
      email_verification_required:
        typeof settings.emailVerificationRequired === 'boolean'
          ? settings.emailVerificationRequired
          : DEFAULT_SYSTEM_SETTINGS.email_verification_required,
      background_check_required:
        typeof settings.backgroundCheckRequired === 'boolean'
          ? settings.backgroundCheckRequired
          : DEFAULT_SYSTEM_SETTINGS.background_check_required
    };
  }

  static async getSettings() {
    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .limit(1)
      .single();

    if (!error) {
      return this.toCamel(data);
    }

    if (error.code === 'PGRST116' || error.code === '42P01') {
      if (error.code === '42P01') {
        console.warn('[SystemSettingsService] system_settings table missing; returning defaults.');
      }
      return this.toCamel();
    }

    throw error;
  }

  static async updateSettings(settings = {}) {
    const payload = {
      id: 1,
      ...this.toSnake(settings)
    };

    const { data, error } = await supabase
      .from('system_settings')
      .upsert(payload, { onConflict: 'id' })
      .select('*')
      .single();

    if (error) {
      if (error.code === '42P01') {
        const missingTableError = new Error(
          'system_settings table is missing. Create it or adjust SystemSettingsService.',
        );
        missingTableError.original = error;
        throw missingTableError;
      }
      throw error;
    }

    return this.toCamel(data);
  }
}

module.exports = {
  UserService,
  ConversationService,
  MessageService,
  JobService,
  BookingService,
  AuditLogService,
  AuthAdminService,
  CaregiverProfileService,
  CaregiverDocumentService,
  BackgroundCheckService,
  UserStatusHistoryService,
  SystemSettingsService
};
