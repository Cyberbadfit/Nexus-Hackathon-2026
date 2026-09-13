const config = require("../config/env");
const { generateUUID } = require("../utils/codeGenerator");

class SupabaseRequestError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = "SupabaseRequestError";
    this.status = status;
  }
}

/** Server-only PostgREST client. No Supabase credential reaches the browser. */
class SupabaseService {
  constructor() {
    this.baseUrl = (config.supabaseUrl || "").replace(/\/+$/, "");
    this.secretKey = config.supabaseSecretKey || "";
  }

  ensureConfigured() {
    if (!this.baseUrl || !this.secretKey) {
      throw new SupabaseRequestError(
        "Database is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY on the server.",
        503,
      );
    }
  }

  getHeaders(returnRepresentation = false) {
    const headers = {
      apikey: this.secretKey,
      Authorization: `Bearer ${this.secretKey}`,
      "Content-Type": "application/json",
    };
    if (returnRepresentation) headers.Prefer = "return=representation";
    return headers;
  }

  async request(
    table,
    { method = "GET", query = "", body, returnRepresentation = false } = {},
  ) {
    this.ensureConfigured();
    const url = `${this.baseUrl}/${table}${query ? `?${query}` : ""}`;
    let response;
    try {
      response = await fetch(url, {
        method,
        headers: this.getHeaders(returnRepresentation),
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      console.error(`[Supabase] ${method} ${table} network error:`, error.message);
      throw new SupabaseRequestError(
        "The registration database is temporarily unreachable. Please try again.",
      );
    }

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      console.error(`[Supabase] ${method} ${table} failed (${response.status}):`, detail);
      const messages = {
        400: "The submitted data could not be saved. Please check the form and try again.",
        401: "The server database credentials were rejected. Contact the site administrator.",
        403: "The database denied this request. Contact the site administrator.",
        404: "A required database table is missing. Run supabase_schema.sql in the Supabase SQL Editor.",
        409: "A record with this email or ID already exists.",
      };
      throw new SupabaseRequestError(
        messages[response.status] ||
          "The database could not save this request. Please try again.",
      );
    }
    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  first(data, fallback) {
    return Array.isArray(data) && data[0] ? data[0] : fallback;
  }

  /* ------------------- TEAMS ------------------- */
  getTeams() {
    return this.request("teams", { query: "select=*&order=created_at.desc" });
  }

  async getTeamByCode(code) {
    const normalizedCode = String(code || "").trim().toUpperCase();
    if (!normalizedCode) return null;
    const teams = await this.getTeams();
    return (
      teams.find((team) => {
        const teamId = String(team.team_id || "").toUpperCase();
        const abstract = String(team.abstract || "").toUpperCase();
        return (
          teamId === normalizedCode ||
          abstract.includes(`[CODE: ${normalizedCode}]`)
        );
      }) || null
    );
  }

  async createTeam(data) {
    const payload = {
      id: data.id || generateUUID(),
      team_id: data.team_id || null,
      name: data.name,
      track: data.track || "Unassigned",
      abstract: data.abstract || "",
      leader_id: data.leader_id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return this.first(
      await this.request("teams", {
        method: "POST",
        body: payload,
        returnRepresentation: true,
      }),
      payload,
    );
  }

  async updateTeam(id, updates) {
    const payload = { updated_at: new Date().toISOString() };
    for (const key of ["name", "track", "abstract", "problem_statement_id"]) {
      if (updates[key] !== undefined) payload[key] = updates[key];
    }
    return this.first(
      await this.request("teams", {
        method: "PATCH",
        query: `id=eq.${encodeURIComponent(id)}`,
        body: payload,
        returnRepresentation: true,
      }),
      { id, ...payload },
    );
  }

  async deleteTeam(id) {
    await this.request("teams", {
      method: "DELETE",
      query: `id=eq.${encodeURIComponent(id)}`,
    });
    return true;
  }

  /* ------------------- USERS ------------------- */
  getUsers() {
    return this.request("app_users", {
      query: "select=*&order=created_at.desc",
    });
  }

  async createUser(data) {
    let username = data.username || "";
    let passwordHash = data.password_hash;
    // The existing schema constrains username. Keep encrypted participant
    // details in password_hash, not in an exposed browser-side store.
    if (
      username.includes("|") ||
      !/^[a-zA-Z0-9_]+$/.test(username) ||
      username.length > 30
    ) {
      passwordHash = username;
      username = `nexx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    }
    const payload = {
      id: data.id || generateUUID(),
      public_user_id: data.public_user_id,
      name: data.name,
      username,
      email: String(data.email).toLowerCase().trim(),
      password_hash: passwordHash || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return this.first(
      await this.request("app_users", {
        method: "POST",
        body: payload,
        returnRepresentation: true,
      }),
      payload,
    );
  }

  async updateUser(userId, updates) {
    const payload = { ...updates, updated_at: new Date().toISOString() };
    return this.first(
      await this.request("app_users", {
        method: "PATCH",
        query: `id=eq.${encodeURIComponent(userId)}`,
        body: payload,
        returnRepresentation: true,
      }),
      { id: userId, ...payload },
    );
  }

  async deleteUser(userId) {
    await this.request("app_users", {
      method: "DELETE",
      query: `id=eq.${encodeURIComponent(userId)}`,
    });
    return true;
  }

  /* ------------------- TEAM MEMBERS ------------------- */
  getTeamMembers() {
    return this.request("team_members", {
      query: "select=*&order=joined_at.asc",
    });
  }

  getMembersByTeamId(teamId) {
    return this.request("team_members", {
      query: `select=*&team_id=eq.${encodeURIComponent(teamId)}&order=joined_at.asc`,
    });
  }

  async addTeamMember(data) {
    const payload = {
      id: data.id || generateUUID(),
      team_id: data.team_id,
      user_id: data.user_id,
      role: data.role || "MEMBER",
      status: data.status || "ACTIVE",
      joined_at: new Date().toISOString(),
    };
    return this.first(
      await this.request("team_members", {
        method: "POST",
        body: payload,
        returnRepresentation: true,
      }),
      payload,
    );
  }

  async updateTeamMemberByUserId(userId, updates) {
    return this.first(
      await this.request("team_members", {
        method: "PATCH",
        query: `user_id=eq.${encodeURIComponent(userId)}`,
        body: updates,
        returnRepresentation: true,
      }),
      { user_id: userId, ...updates },
    );
  }

  /* ------------------- ANNOUNCEMENTS ------------------- */
  getAnnouncements() {
    return this.request("announcements", {
      query: "select=*&order=created_at.desc",
    });
  }

  async createAnnouncement(data) {
    const payload = {
      id: data.id || generateUUID(),
      title: data.title,
      category: data.category || "Schedule",
      priority: data.priority || "High",
      track: data.track || "All Tracks",
      content: data.content,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return this.first(
      await this.request("announcements", {
        method: "POST",
        body: payload,
        returnRepresentation: true,
      }),
      payload,
    );
  }

  async updateAnnouncement(id, updates) {
    const payload = { updated_at: new Date().toISOString() };
    for (const key of ["title", "category", "priority", "track", "content"]) {
      if (updates[key] !== undefined) payload[key] = updates[key];
    }
    return this.first(
      await this.request("announcements", {
        method: "PATCH",
        query: `id=eq.${encodeURIComponent(id)}`,
        body: payload,
        returnRepresentation: true,
      }),
      { id, ...payload },
    );
  }

  async deleteAnnouncement(id) {
    await this.request("announcements", {
      method: "DELETE",
      query: `id=eq.${encodeURIComponent(id)}`,
    });
    return true;
  }

  /* ------------------- SUPPORT TICKETS ------------------- */
  getSupportTickets() {
    return this.request("support_tickets", {
      query: "select=*&order=created_at.desc",
    });
  }

  async createSupportTicket(data) {
    const payload = {
      id: generateUUID(),
      ticket_id: `TCK-${Math.random().toString(16).slice(2, 8).toUpperCase()}`,
      name: data.name,
      email: String(data.email).toLowerCase().trim(),
      category: data.category || "General Support",
      message: data.message,
      status: "OPEN",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return this.first(
      await this.request("support_tickets", {
        method: "POST",
        body: payload,
        returnRepresentation: true,
      }),
      payload,
    );
  }

  async updateSupportTicket(id, status) {
    return this.first(
      await this.request("support_tickets", {
        method: "PATCH",
        query: `id=eq.${encodeURIComponent(id)}`,
        body: { status, updated_at: new Date().toISOString() },
        returnRepresentation: true,
      }),
      { id, status },
    );
  }

  /* ------------------- PROBLEM STATEMENTS ------------------- */
  getProblems(admin = false) {
    return this.request("problem_statements", {
      query: admin
        ? "select=*&order=created_at.desc"
        : "select=*&published=eq.true&order=created_at.desc",
    });
  }

  async createProblem(data) {
    const payload = {
      id: data.id || generateUUID(),
      code: data.code || `PS-${Date.now().toString().slice(-4)}`,
      title: data.title,
      summary: data.summary || "",
      description: data.description || "",
      track: data.track || "General",
      difficulty: data.difficulty || "Intermediate",
      technologies: data.technologies || "",
      constraints: data.constraints || "",
      expected_outcome: data.expected_outcome || "",
      judging_focus: data.judging_focus || "",
      published: data.published !== false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return this.first(
      await this.request("problem_statements", {
        method: "POST",
        body: payload,
        returnRepresentation: true,
      }),
      payload,
    );
  }

  async updateProblem(id, updates) {
    const payload = { ...updates, updated_at: new Date().toISOString() };
    delete payload.id;
    return this.first(
      await this.request("problem_statements", {
        method: "PATCH",
        query: `id=eq.${encodeURIComponent(id)}`,
        body: payload,
        returnRepresentation: true,
      }),
      { id, ...payload },
    );
  }

  async deleteProblem(id) {
    await this.request("problem_statements", {
      method: "DELETE",
      query: `id=eq.${encodeURIComponent(id)}`,
    });
    return true;
  }
}

module.exports = new SupabaseService();
