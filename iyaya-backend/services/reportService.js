const { supabase } = require("../config/supabase");

class ReportService {
  static async create(reportData) {
    const { data, error } = await supabase
      .from("user_reports")
      .insert({
        ...reportData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select(`
        *,
        reporter:reporter_id ( id, name, email, role ),
        reported_user:reported_user_id ( id, name, email, role ),
        booking:booking_id ( id, status ),
        job:job_id ( id, title )
      `)
      .single();

    if (error) throw error;
    return data;
  }

  static async findById(id) {
    const { data, error } = await supabase
      .from("user_reports")
      .select(`
        *,
        reporter:reporter_id ( id, name, email, role, profile_image ),
        reported_user:reported_user_id ( id, name, email, role, profile_image ),
        booking:booking_id ( id, status, start_date, end_date ),
        job:job_id ( id, title, status ),
        reviewer:reviewed_by ( id, name, email )
      `)
      .eq("id", id)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return data;
  }

  static async getReports({
    page = 1,
    limit = 20,
    status,
    reportType,
    severity,
    reporterId,
    reportedUserId,
    search,
  } = {}) {
    let query = supabase
      .from("user_reports")
      .select(`
        *,
        reporter:reporter_id ( id, name, email, role ),
        reported_user:reported_user_id ( id, name, email, role ),
        booking:booking_id ( id, status ),
        job:job_id ( id, title )
      `, { count: "exact" });

    if (status) query = query.eq("status", status);
    if (reportType) query = query.eq("report_type", reportType);
    if (severity) query = query.eq("severity", severity);
    if (reporterId) query = query.eq("reporter_id", reporterId);
    if (reportedUserId) query = query.eq("reported_user_id", reportedUserId);
    
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const offset = (page - 1) * limit;
    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;
    return { reports: data, total: count, page, limit };
  }

  static async updateStatus(id, status, { adminNotes, reviewedBy, resolution } = {}) {
    const updates = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (adminNotes) updates.admin_notes = adminNotes;
    if (reviewedBy) {
      updates.reviewed_by = reviewedBy;
      updates.reviewed_at = new Date().toISOString();
    }
    if (resolution) updates.resolution = resolution;

    const { data, error } = await supabase
      .from("user_reports")
      .update(updates)
      .eq("id", id)
      .select(`
        *,
        reporter:reporter_id ( id, name, email, role ),
        reported_user:reported_user_id ( id, name, email, role ),
        reviewer:reviewed_by ( id, name, email )
      `)
      .single();

    if (error) throw error;
    return data;
  }

  static async getReportStats() {
    const { data, error } = await supabase
      .from("user_reports")
      .select("status, severity, report_type");

    if (error) throw error;

    const stats = {
      total: data.length,
      byStatus: {},
      bySeverity: {},
      byType: {},
    };

    data.forEach(report => {
      stats.byStatus[report.status] = (stats.byStatus[report.status] || 0) + 1;
      stats.bySeverity[report.severity] = (stats.bySeverity[report.severity] || 0) + 1;
      stats.byType[report.report_type] = (stats.byType[report.report_type] || 0) + 1;
    });

    return stats;
  }
}

module.exports = { ReportService };
