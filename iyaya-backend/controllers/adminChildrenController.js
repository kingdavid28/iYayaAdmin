const { supabase } = require("../config/supabase");

const sanitizeSearchTerm = (value = "") =>
  value
    .trim()
    .replace(/[\0\n\r\t\f\v]/g, " ")
    .replace(/[%_]/g, (match) => `\\${match}`);

const mapChildRecord = (record) => {
  if (!record) {
    return null;
  }

  const parent = Array.isArray(record.parent)
    ? record.parent[0]
    : record.parent;

  return {
    id: record.id,
    parentId: record.parent_id,
    parent: parent
      ? {
          id: parent.id,
          name: parent.name,
          email: parent.email,
        }
      : null,
    name: record.name,
    gender: record.gender,
    specialNeeds: record.special_needs,
    allergies: record.allergies,
    notes: record.notes,
    emergencyContact: record.emergency_contact,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
};

const listChildren = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 20, 1),
      100,
    );
    const search =
      typeof req.query.search === "string" ? req.query.search : undefined;
    const offset = (page - 1) * limit;

    let query = supabase
      .from("children")
      .select(
        `
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
          parent:parent_id(id,name,email)
        `,
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (search && search.trim()) {
      const sanitized = sanitizeSearchTerm(search);
      query = query.or(
        ["name", "parent_id.name", "parent_id.email"]
          .map((column) => `${column}.ilike.%${sanitized}%`)
          .join(","),
      );
    }

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    res.status(200).json({
      success: true,
      data: {
        children: (data || []).map(mapChildRecord),
        total: typeof count === "number" ? count : (data || []).length,
        page,
        limit,
      },
    });
  } catch (error) {
    console.error("[adminChildrenController.listChildren] error", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch children",
    });
  }
};

const getChildById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("children")
      .select(
        `
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
          parent:parent_id(id,name,email)
        `,
      )
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({ success: false, error: "Child not found" });
    }

    res.status(200).json({ success: true, data: mapChildRecord(data) });
  } catch (error) {
    console.error("[adminChildrenController.getChildById] error", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch child",
    });
  }
};

const updateChild = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes, specialNeeds, allergies, emergencyContact } = req.body || {};

    const updates = {};

    if (typeof notes === "string") {
      const trimmed = notes.trim();
      updates.notes = trimmed.length ? trimmed : null;
    }
    if (typeof specialNeeds === "string") {
      const trimmed = specialNeeds.trim();
      updates.special_needs = trimmed.length ? trimmed : null;
    }
    if (typeof allergies === "string") {
      const trimmed = allergies.trim();
      updates.allergies = trimmed.length ? trimmed : null;
    }
    if (emergencyContact !== undefined) {
      if (emergencyContact === null || typeof emergencyContact === "object") {
        updates.emergency_contact = emergencyContact;
      } else {
        return res.status(400).json({
          success: false,
          error: "emergencyContact must be an object or null",
        });
      }
    }

    if (!Object.keys(updates).length) {
      return res
        .status(400)
        .json({ success: false, error: "No fields to update" });
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("children")
      .update(updates)
      .eq("id", id)
      .select(
        `
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
          parent:parent_id(id,name,email)
        `,
      )
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({ success: false, error: "Child not found" });
    }

    res.status(200).json({ success: true, data: mapChildRecord(data) });
  } catch (error) {
    console.error("[adminChildrenController.updateChild] error", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to update child",
    });
  }
};

const deleteChild = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase.from("children").delete().eq("id", id);

    if (error) {
      throw error;
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("[adminChildrenController.deleteChild] error", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to delete child",
    });
  }
};

module.exports = {
  listChildren,
  getChildById,
  updateChild,
  deleteChild,
};
