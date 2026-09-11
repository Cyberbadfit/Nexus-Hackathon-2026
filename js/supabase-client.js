/**
 * SRM HACKATHON 2026 - Supabase Client & Resilient Data Layer
 * Handles live REST API queries, mutations, unique code verification, and offline sync.
 */

const SUPABASE_CONFIG = {
  url: 'https://xdgsuebdlmgtfuxtmotv.supabase.co/rest/v1',
  key: 'sb_secret_PPOwtbrs-4O-OX0x_F70wg_Wqf5SpoO',
  publishKey: 'sb_publishable_ww_KJfmvZuUUXSWEjt-b_Q_J8ZlCuSi',
  projectId: 'xdgsuebdlmgtfuxtmotv'
};

class SupabaseClient {
  constructor() {
    this.baseUrl = SUPABASE_CONFIG.url;
    this.apiKey = SUPABASE_CONFIG.key;
    this.cacheKey = 'srm_hackathon_local_cache_v1';
    this.announcementsKey = 'srm_hackathon_announcements_v1';
    this.initLocalCache();
  }

  getHeaders(preferReturn = false) {
    const headers = {
      'apikey': this.apiKey,
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
    if (preferReturn) {
      headers['Prefer'] = 'return=representation';
    }
    return headers;
  }

  initLocalCache() {
    if (!localStorage.getItem(this.cacheKey)) {
      const initialCache = {
        teams: [],
        app_users: [],
        team_members: [],
        team_invitations: [],
        support_tickets: []
      };
      localStorage.setItem(this.cacheKey, JSON.stringify(initialCache));
    }

    if (!localStorage.getItem(this.announcementsKey)) {
      const defaultAnnouncements = [
        {
          id: 'ann-1',
          title: 'Round 1 Problem Statements Released',
          category: 'Schedule',
          priority: 'Critical',
          track: 'All Tracks',
          content: 'The official problem statements across all 5 tracks have been unveiled. Teams have until 18:00 IST to submit their conceptual architecture abstracts.',
          created_at: new Date(Date.now() - 3600000 * 4).toISOString()
        },
        {
          id: 'ann-2',
          title: 'DevOps & Cloud Lab Benches & GPU Access',
          category: 'Workshop',
          priority: 'High',
          track: 'DEVOPS & CLOUD',
          content: 'Cloud infrastructure credits and cluster access in Tech Park Block 4 are now provisioned. Pick up your access tokens from the coordinator desk.',
          created_at: new Date(Date.now() - 3600000 * 12).toISOString()
        },
        {
          id: 'ann-3',
          title: 'Round 1 Submission Deadline Extension',
          category: 'Alert',
          priority: 'Critical',
          track: 'All Tracks',
          content: 'Due to network maintenance, abstract submission cutoff has been extended by 45 minutes. Ensure GitHub repos are set to public view.',
          created_at: new Date(Date.now() - 3600000 * 24).toISOString()
        },
        {
          id: 'ann-4',
          title: 'AI / Machine Learning & Data Science Mentorship',
          category: 'Judging',
          priority: 'Medium',
          track: 'AI / MACHINE LEARNING',
          content: 'Industry mentors from Google and leading tech labs are available on Discord Channel #mentor-room-3 for live architecture reviews until midnight.',
          created_at: new Date(Date.now() - 3600000 * 36).toISOString()
        }
      ];
      localStorage.setItem(this.announcementsKey, JSON.stringify(defaultAnnouncements));
    }
  }

  getLocalCache() {
    try {
      return JSON.parse(localStorage.getItem(this.cacheKey)) || {};
    } catch (e) {
      return {};
    }
  }

  setLocalCache(data) {
    try {
      localStorage.setItem(this.cacheKey, JSON.stringify(data));
    } catch (e) {
      console.warn('Local storage write failed:', e);
    }
  }

  // Generate unique verification code for student & team verification
  generateUniqueCode(prefix = 'SRM-2026') {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${prefix}-${code}`;
  }

  generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /* ------------------- TEAMS API ------------------- */
  async getTeams() {
    try {
      const response = await fetch(`${this.baseUrl}/teams?select=*&order=created_at.desc`, {
        headers: this.getHeaders()
      });
      if (response.ok) {
        const teams = await response.json();
        const cache = this.getLocalCache();
        cache.teams = teams;
        this.setLocalCache(cache);
        return teams;
      }
    } catch (e) {
      console.warn('Supabase fetch teams error, using cache:', e);
    }
    const cache = this.getLocalCache();
    return cache.teams || [];
  }

  async createTeam(teamData) {
    // teamData: { name, track, abstract, leader_id, team_id }
    const payload = {
      id: this.generateUUID(),
      team_id: teamData.team_id || `TEAM-2026-${Math.random().toString(16).substring(2, 12).toUpperCase()}`,
      name: teamData.name,
      track: teamData.track,
      abstract: teamData.abstract || '',
      leader_id: teamData.leader_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      const response = await fetch(`${this.baseUrl}/teams`, {
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        const result = await response.json();
        const created = Array.isArray(result) && result.length > 0 ? result[0] : payload;
        this.updateLocalList('teams', created);
        return { success: true, data: created };
      }
    } catch (e) {
      console.warn('Supabase team insert error, saving locally:', e);
    }

    // Resilient fallback
    this.updateLocalList('teams', payload);
    return { success: true, data: payload, localOnly: true };
  }

  async getTeamByCode(code) {
    if (!code) return null;
    const cleanCode = code.trim().toUpperCase();
    const teams = await this.getTeams();
    
    // Check match on team_id, name, or abstract containing the code
    const match = teams.find(t => 
      (t.team_id && t.team_id.toUpperCase() === cleanCode) ||
      (t.name && t.name.toUpperCase() === cleanCode) ||
      (t.abstract && t.abstract.toUpperCase().includes(cleanCode))
    );
    return match || null;
  }

  /* ------------------- USERS / STUDENTS API ------------------- */
  async getUsers() {
    try {
      const response = await fetch(`${this.baseUrl}/app_users?select=*&order=created_at.desc`, {
        headers: this.getHeaders()
      });
      if (response.ok) {
        const users = await response.json();
        const cache = this.getLocalCache();
        cache.app_users = users;
        this.setLocalCache(cache);
        return users;
      }
    } catch (e) {
      console.warn('Supabase fetch users error, using cache:', e);
    }
    const cache = this.getLocalCache();
    return cache.app_users || [];
  }

  async createUser(userData) {
    // userData: { name, email, username (stores roll/college metadata), password_hash }
    const payload = {
      id: userData.id || this.generateUUID(),
      public_user_id: userData.public_user_id || `USER-2026-${Math.random().toString(16).substring(2, 12).toUpperCase()}`,
      name: userData.name,
      username: userData.username || userData.email.split('@')[0],
      email: userData.email.toLowerCase().trim(),
      password_hash: userData.password_hash || 'hash_' + Math.random().toString(36).substring(2),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      const response = await fetch(`${this.baseUrl}/app_users`, {
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        const result = await response.json();
        const created = Array.isArray(result) && result.length > 0 ? result[0] : payload;
        this.updateLocalList('app_users', created);
        return { success: true, data: created };
      }
    } catch (e) {
      console.warn('Supabase user insert error, saving locally:', e);
    }

    this.updateLocalList('app_users', payload);
    return { success: true, data: payload, localOnly: true };
  }

  async updateUser(userId, updates) {
    updates.updated_at = new Date().toISOString();
    try {
      const response = await fetch(`${this.baseUrl}/app_users?id=eq.${userId}`, {
        method: 'PATCH',
        headers: this.getHeaders(true),
        body: JSON.stringify(updates)
      });
      if (response.ok) {
        const result = await response.json();
        this.updateLocalItem('app_users', userId, updates);
        return { success: true, data: result };
      }
    } catch (e) {
      console.warn('Supabase user update error:', e);
    }
    this.updateLocalItem('app_users', userId, updates);
    return { success: true, localOnly: true };
  }

  async deleteUser(userId) {
    try {
      await fetch(`${this.baseUrl}/app_users?id=eq.${userId}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });
      // Also delete related team_members
      await fetch(`${this.baseUrl}/team_members?user_id=eq.${userId}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });
    } catch (e) {
      console.warn('Supabase delete error:', e);
    }
    this.removeLocalItem('app_users', userId);
    this.removeLocalItem('team_members', userId, 'user_id');
    return { success: true };
  }

  async deleteTeam(teamId) {
    try {
      await fetch(`${this.baseUrl}/team_members?team_id=eq.${teamId}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });
      await fetch(`${this.baseUrl}/team_invitations?team_id=eq.${teamId}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });
      await fetch(`${this.baseUrl}/teams?id=eq.${teamId}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });
    } catch (e) {
      console.warn('Supabase team delete error:', e);
    }
    this.removeLocalItem('teams', teamId);
    this.removeLocalItem('team_members', teamId, 'team_id');
    return { success: true };
  }

  // Bulk Purge: Delete all student records, team members, invitations, and squads
  async deleteAllStudents() {
    const results = {
      team_members: false,
      team_invitations: false,
      teams: false,
      app_users: false,
      errors: []
    };

    // 1. Delete all team_members
    try {
      const resMembers = await fetch(`${this.baseUrl}/team_members?id=not.is.null`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });
      results.team_members = resMembers.ok;
    } catch (e) {
      console.warn('Supabase delete team_members error:', e);
      results.errors.push('team_members: ' + e.message);
    }

    // 2. Delete all team_invitations
    try {
      const resInv = await fetch(`${this.baseUrl}/team_invitations?id=not.is.null`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });
      results.team_invitations = resInv.ok;
    } catch (e) {
      console.warn('Supabase delete team_invitations error:', e);
      results.errors.push('team_invitations: ' + e.message);
    }

    // 3. Delete all teams
    try {
      const resTeams = await fetch(`${this.baseUrl}/teams?id=not.is.null`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });
      results.teams = resTeams.ok;
    } catch (e) {
      console.warn('Supabase delete teams error:', e);
      results.errors.push('teams: ' + e.message);
    }

    // 4. Delete all app_users (students)
    try {
      const resUsers = await fetch(`${this.baseUrl}/app_users?id=not.is.null`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });
      results.app_users = resUsers.ok;
    } catch (e) {
      console.warn('Supabase delete app_users error:', e);
      results.errors.push('app_users: ' + e.message);
    }

    // 5. Purge local cache for student & team entities
    try {
      const cache = this.getLocalCache();
      cache.app_users = [];
      cache.team_members = [];
      cache.teams = [];
      cache.team_invitations = [];
      this.setLocalCache(cache);
    } catch (e) {
      console.warn('Cache purge error:', e);
    }

    return {
      success: true,
      details: results
    };
  }

  // Normalizes any track name to the official 5 SRM Hackathon tracks
  normalizeTrack(track) {
    if (!track) return 'AI / MACHINE LEARNING';
    const t = track.trim();
    const lower = t.toLowerCase();

    // Exact matches
    if (t === 'AI / MACHINE LEARNING') return 'AI / MACHINE LEARNING';
    if (t === 'DATA SCIENCE') return 'DATA SCIENCE';
    if (t === 'DEVOPS & CLOUD') return 'DEVOPS & CLOUD';
    if (t === 'COMPUTER VISION') return 'COMPUTER VISION';
    if (t === 'FULL STACK DEVELOPMENT') return 'FULL STACK DEVELOPMENT';
    if (t === 'All Tracks') return 'All Tracks';

    // Legacy and alternative mappings
    if (lower.includes('autonomous') || lower.includes('machine learning') || lower === 'ai') {
      return 'AI / MACHINE LEARNING';
    }
    if (lower.includes('data science') || lower.includes('decentralized') || lower.includes('web3') || lower.includes('analytics')) {
      return 'DATA SCIENCE';
    }
    if (lower.includes('devops') || lower.includes('cloud') || lower.includes('open innovation')) {
      return 'DEVOPS & CLOUD';
    }
    if (lower.includes('vision') || lower.includes('smart healthcare') || lower.includes('iot')) {
      return 'COMPUTER VISION';
    }
    if (lower.includes('full stack') || lower.includes('cyber defense') || lower.includes('security')) {
      return 'FULL STACK DEVELOPMENT';
    }

    return t;
  }

  /* ------------------- TEAM MEMBERS API ------------------- */
  async getTeamMembers() {
    try {
      const response = await fetch(`${this.baseUrl}/team_members?select=*&order=joined_at.asc`, {
        headers: this.getHeaders()
      });
      if (response.ok) {
        const members = await response.json();
        const cache = this.getLocalCache();
        cache.team_members = members;
        this.setLocalCache(cache);
        return members;
      }
    } catch (e) {
      console.warn('Supabase fetch team_members error:', e);
    }
    const cache = this.getLocalCache();
    return cache.team_members || [];
  }

  async addTeamMember(memberData) {
    // memberData: { team_id, user_id, role: 'LEADER' | 'MEMBER', status: 'ACTIVE' }
    const payload = {
      id: this.generateUUID(),
      team_id: memberData.team_id,
      user_id: memberData.user_id,
      role: memberData.role || 'MEMBER',
      status: memberData.status || 'ACTIVE',
      joined_at: new Date().toISOString()
    };

    try {
      const response = await fetch(`${this.baseUrl}/team_members`, {
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        const result = await response.json();
        const created = Array.isArray(result) && result.length > 0 ? result[0] : payload;
        this.updateLocalList('team_members', created);
        return { success: true, data: created };
      }
    } catch (e) {
      console.warn('Supabase member insert error:', e);
    }

    this.updateLocalList('team_members', payload);
    return { success: true, data: payload, localOnly: true };
  }

  /* ------------------- FULL ENRICHED PARTICIPANTS ------------------- */
  async getFullCandidateRegistry() {
    const [users, teams, members] = await Promise.all([
      this.getUsers(),
      this.getTeams(),
      this.getTeamMembers()
    ]);

    const teamMap = new Map();
    teams.forEach(t => teamMap.set(t.id, t));

    const memberMap = new Map();
    members.forEach(m => {
      if (!memberMap.has(m.user_id)) {
        memberMap.set(m.user_id, []);
      }
      memberMap.get(m.user_id).push(m);
    });

    return users.map(user => {
      const userMemberships = memberMap.get(user.id) || [];
      const primaryMembership = userMemberships[0] || null;
      const team = primaryMembership ? teamMap.get(primaryMembership.team_id) : null;
      
      // Parse extra metadata if stored in username or object
      let college = 'SRM Institute of Science and Technology';
      let rollNo = '';
      let phone = '';
      let course = 'B.Tech';
      let branch = 'CSE';
      let section = 'A';
      try {
        if (user.username && user.username.includes('|')) {
          const parts = user.username.split('|');
          rollNo = parts[0] || '';
          college = parts[1] || 'SRM Institute of Science and Technology';
          phone = parts[2] || '';
          course = parts[3] || 'B.Tech';
          branch = parts[4] || 'CSE';
          section = parts[5] || 'A';
        }
      } catch (e) {}

      return {
        id: user.id,
        public_user_id: user.public_user_id,
        name: user.name,
        email: user.email,
        college: college,
        rollNo: rollNo,
        phone: phone,
        course: course,
        branch: branch,
        section: section,
        team_id: team ? team.id : null,
        team_name: team ? team.name : 'UNASSIGNED',
        team_code: team ? team.team_id : 'NONE',
        track: this.normalizeTrack(team ? team.track : 'AI / MACHINE LEARNING'),
        role: primaryMembership ? primaryMembership.role : 'SOLO',
        status: primaryMembership ? primaryMembership.status : 'PENDING',
        created_at: user.created_at
      };
    });
  }

  /* ------------------- ANNOUNCEMENTS API ------------------- */
  getAnnouncements() {
    try {
      return JSON.parse(localStorage.getItem(this.announcementsKey)) || [];
    } catch (e) {
      return [];
    }
  }

  createAnnouncement(data) {
    const announcements = this.getAnnouncements();
    const newAnn = {
      id: 'ann-' + Date.now(),
      title: data.title,
      category: data.category || 'Schedule',
      priority: data.priority || 'High',
      track: data.track || 'All Tracks',
      content: data.content,
      created_at: new Date().toISOString()
    };
    announcements.unshift(newAnn);
    localStorage.setItem(this.announcementsKey, JSON.stringify(announcements));
    return newAnn;
  }

  deleteAnnouncement(id) {
    let announcements = this.getAnnouncements();
    announcements = announcements.filter(a => a.id !== id);
    localStorage.setItem(this.announcementsKey, JSON.stringify(announcements));
    return true;
  }

  /* ------------------- SUPPORT TICKETS API ------------------- */
  async getSupportTickets() {
    try {
      const response = await fetch(`${this.baseUrl}/support_tickets?select=*&order=created_at.desc`, {
        headers: this.getHeaders()
      });
      if (response.ok) {
        const tickets = await response.json();
        const cache = this.getLocalCache();
        cache.support_tickets = tickets;
        this.setLocalCache(cache);
        return tickets;
      }
    } catch (e) {
      console.warn('Supabase fetch support_tickets error:', e);
    }
    const cache = this.getLocalCache();
    return cache.support_tickets || [];
  }

  async createSupportTicket(ticketData) {
    const payload = {
      id: this.generateUUID(),
      ticket_id: `TCK-${Math.random().toString(16).substring(2, 8).toUpperCase()}`,
      name: ticketData.name,
      email: ticketData.email,
      category: ticketData.category || 'General Support',
      message: ticketData.message,
      status: 'OPEN',
      created_at: new Date().toISOString()
    };

    try {
      const response = await fetch(`${this.baseUrl}/support_tickets`, {
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        const result = await response.json();
        const created = Array.isArray(result) && result.length > 0 ? result[0] : payload;
        this.updateLocalList('support_tickets', created);
        return { success: true, data: created };
      }
    } catch (e) {
      console.warn('Supabase ticket insert error:', e);
    }

    this.updateLocalList('support_tickets', payload);
    return { success: true, data: payload, localOnly: true };
  }

  async updateTicketStatus(id, newStatus) {
    try {
      await fetch(`${this.baseUrl}/support_tickets?id=eq.${id}`, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({ status: newStatus })
      });
    } catch (e) {}
    this.updateLocalItem('support_tickets', id, { status: newStatus });
    return { success: true };
  }

  /* ------------------- CACHE HELPERS ------------------- */
  updateLocalList(collection, item) {
    const cache = this.getLocalCache();
    if (!cache[collection]) cache[collection] = [];
    const index = cache[collection].findIndex(x => x.id === item.id);
    if (index >= 0) {
      cache[collection][index] = item;
    } else {
      cache[collection].unshift(item);
    }
    this.setLocalCache(cache);
  }

  updateLocalItem(collection, id, updates) {
    const cache = this.getLocalCache();
    if (!cache[collection]) return;
    const index = cache[collection].findIndex(x => x.id === id);
    if (index >= 0) {
      cache[collection][index] = { ...cache[collection][index], ...updates };
      this.setLocalCache(cache);
    }
  }

  removeLocalItem(collection, id, field = 'id') {
    const cache = this.getLocalCache();
    if (!cache[collection]) return;
    cache[collection] = cache[collection].filter(x => x[field] !== id);
    this.setLocalCache(cache);
  }
}

// Global Singleton Instance
window.SupabaseDB = new SupabaseClient();
