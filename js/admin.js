/**
 * SRM HACKATHON 2026 - Admin Operations Command & CRUD Engine
 * Password protected with 'Muradnagar@1234'.
 * Full CRUD on student registry, team records, announcement broadcasts, and support tickets.
 */

const ADMIN_PASSWORD_HASH = 'Muradnagar@1234';
const AUTH_STORAGE_KEY = 'srm_admin_session_auth_token';

document.addEventListener('DOMContentLoaded', () => {
  initAdminSecurity();
});

let candidateRegistry = [];
let allTeams = [];
let currentFilterRole = 'ALL';
let currentSearchQuery = '';

// Security & Password Verification Gate
function initAdminSecurity() {
  const loginGate = document.getElementById('admin-login-gate');
  const dashboardContent = document.getElementById('admin-dashboard-content');
  const loginForm = document.getElementById('form-admin-login');
  const logoutBtn = document.getElementById('btn-admin-logout');

  // Check existing session
  if (sessionStorage.getItem(AUTH_STORAGE_KEY) === 'AUTHENTICATED_MURADNAGAR_SECURE') {
    unlockDashboard();
  } else {
    lockDashboard();
  }

  if (loginForm) {
    let failedAttempts = parseInt(sessionStorage.getItem('srm_failed_attempts') || '0', 10);

    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();

      if (failedAttempts >= 5) {
        window.showToast('Security Lockout: Too many failed login attempts. Please reload browser.', 'error');
        return;
      }

      const inputPass = document.getElementById('admin-pass-input').value;
      if (inputPass === ADMIN_PASSWORD_HASH) {
        sessionStorage.setItem(AUTH_STORAGE_KEY, 'AUTHENTICATED_MURADNAGAR_SECURE');
        sessionStorage.removeItem('srm_failed_attempts');
        window.showToast('ACCESS GRANTED: Welcome Operations Commander.', 'success');
        unlockDashboard();
      } else {
        failedAttempts++;
        sessionStorage.setItem('srm_failed_attempts', failedAttempts.toString());
        window.showToast(`ACCESS DENIED: Invalid Password. (${5 - failedAttempts} attempts remaining)`, 'error');
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
      window.showToast('Session terminated. Dashboard locked.', 'info');
      lockDashboard();
    });
  }
}

function unlockDashboard() {
  const loginGate = document.getElementById('admin-login-gate');
  const dashboardContent = document.getElementById('admin-dashboard-content');

  if (loginGate) loginGate.style.display = 'none';
  if (dashboardContent) {
    dashboardContent.style.display = 'block';
    loadAdminData();
    initAdminControls();
  }
}

function lockDashboard() {
  const loginGate = document.getElementById('admin-login-gate');
  const dashboardContent = document.getElementById('admin-dashboard-content');

  if (loginGate) loginGate.style.display = 'flex';
  if (dashboardContent) dashboardContent.style.display = 'none';
}

// Load Data from Supabase
async function loadAdminData() {
  try {
    const [candidates, teams, tickets] = await Promise.all([
      window.SupabaseDB.getFullCandidateRegistry(),
      window.SupabaseDB.getTeams(),
      window.SupabaseDB.getSupportTickets()
    ]);

    candidateRegistry = candidates;
    allTeams = teams;

    updateMetrics(candidates, teams, tickets);
    renderCandidateTable();
    renderBroadcastsList();
    renderTicketsList(tickets);

  } catch (err) {
    console.error('Error loading admin data:', err);
    window.showToast('Error syncing with Supabase registry.', 'error');
  }
}

// KPI Telemetry Cards
function updateMetrics(candidates, teams, tickets) {
  const totalStudents = candidates.length;
  const totalTeams = teams.length;
  const verifiedCount = candidates.filter(c => c.status === 'ACTIVE' || c.status === 'VERIFIED').length;
  const openTickets = tickets.filter(t => t.status === 'OPEN').length;

  const elStudents = document.getElementById('kpi-total-students');
  const elTeams = document.getElementById('kpi-total-teams');
  const elVerified = document.getElementById('kpi-verified-members');
  const elTickets = document.getElementById('kpi-open-tickets');

  if (elStudents) elStudents.textContent = totalStudents;
  if (elTeams) elTeams.textContent = totalTeams;
  if (elVerified) elVerified.textContent = verifiedCount;
  if (elTickets) elTickets.textContent = openTickets;
}

// Render Candidate Data Grid (READ)
function renderCandidateTable() {
  const tbody = document.getElementById('candidate-table-body');
  if (!tbody) return;

  const filtered = candidateRegistry.filter(c => {
    const matchesRole = currentFilterRole === 'ALL' || c.role.toUpperCase() === currentFilterRole.toUpperCase();
    const q = currentSearchQuery.toLowerCase();
    const matchesSearch = !q ||
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.team_name.toLowerCase().includes(q) ||
      c.team_code.toLowerCase().includes(q) ||
      c.track.toLowerCase().includes(q) ||
      c.rollNo.toLowerCase().includes(q) ||
      c.college.toLowerCase().includes(q);

    return matchesRole && matchesSearch;
  });

  tbody.innerHTML = '';

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding: 2rem;">NO CANDIDATE RECORDS LOCATED</td></tr>`;
    return;
  }

  filtered.forEach(c => {
    const tr = document.createElement('tr');

    const roleBadge = c.role === 'LEADER' 
      ? '<span class="badge badge-cyan">LEADER</span>' 
      : '<span class="badge badge-green">MEMBER</span>';

    const statusBadge = c.status === 'ACTIVE' || c.status === 'VERIFIED'
      ? '<span class="badge badge-green">ACTIVE</span>'
      : '<span class="badge badge-amber">PENDING</span>';

    const teamMemberCount = candidateRegistry.filter(x => x.team_id && x.team_id === c.team_id).length;
    const capacityBadge = c.team_id 
      ? (teamMemberCount >= 4 
          ? `<span class="badge badge-purple" style="font-size: 0.65rem; margin-left: 0.35rem;">4/4 FULL</span>` 
          : `<span class="badge badge-cyan" style="font-size: 0.65rem; margin-left: 0.35rem;">${teamMemberCount}/4</span>`)
      : '';

    tr.innerHTML = `
      <td>
        <div style="font-weight: 700; color: var(--text-bright);">${c.name}</div>
        <div style="font-size: 0.72rem; color: var(--text-dim);">${c.email}</div>
      </td>
      <td>
        <div style="font-size: 0.82rem; font-weight: 600; color: var(--text-bright);">
          <span class="text-cyan">${c.course || 'B.Tech'}</span> - ${c.branch || 'CSE'} (Sec ${c.section || 'A'})
        </div>
        <div style="font-size: 0.72rem; color: var(--secondary);">${c.rollNo || 'ROLL-N/A'}</div>
        <div style="font-size: 0.70rem; color: var(--text-dim);">${c.college}</div>
      </td>
      <td>
        <div style="font-weight: 600; color: var(--primary); display: flex; align-items: center; flex-wrap: wrap;">
          <span>${c.team_name}</span> ${capacityBadge}
        </div>
        <div style="font-size: 0.72rem; color: var(--text-dim); font-family: var(--font-mono);">${c.team_code}</div>
      </td>
      <td><span style="font-size: 0.78rem;">${window.SupabaseDB.normalizeTrack(c.track)}</span></td>
      <td>${roleBadge}</td>
      <td>${statusBadge}</td>
      <td>
        <div style="display: flex; gap: 0.4rem;">
          <button class="btn btn-outline-cyan btn-sm" onclick="openEditStudentModal('${c.id}')" title="Edit Student">
            <span class="material-symbols-outlined" style="font-size: 0.9rem;">edit</span>
          </button>
          <button class="btn btn-danger btn-sm" onclick="confirmDeleteStudent('${c.id}', '${c.name.replace(/'/g, "\\'")}')" title="Delete Student">
            <span class="material-symbols-outlined" style="font-size: 0.9rem;">delete</span>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Search & Filter Controls
function initAdminControls() {
  const searchInput = document.getElementById('candidate-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearchQuery = e.target.value.trim();
      renderCandidateTable();
    });
  }

  const roleFilter = document.getElementById('candidate-role-filter');
  if (roleFilter) {
    roleFilter.addEventListener('change', (e) => {
      currentFilterRole = e.target.value;
      renderCandidateTable();
    });
  }

  // Add Candidate Button
  const addBtn = document.getElementById('btn-add-candidate');
  if (addBtn) {
    addBtn.onclick = () => window.openModal('modal-add-candidate');
  }

  // Export CSV Button
  const exportBtn = document.getElementById('btn-export-csv');
  if (exportBtn) {
    exportBtn.onclick = exportCandidatesCSV;
  }

  // Delete All Students Button (Single Click with Warning Modal)
  const deleteAllBtn = document.getElementById('btn-delete-all-students');
  if (deleteAllBtn) {
    deleteAllBtn.onclick = () => {
      if (candidateRegistry.length === 0) {
        window.showToast('No student records to delete. Database is already clear.', 'info');
        return;
      }
      if (window.openModal) {
        window.openModal('modal-confirm-delete-all');
      } else {
        confirmPurgeAllStudents();
      }
    };
  }

  const confirmPurgeBtn = document.getElementById('btn-confirm-purge-all');
  if (confirmPurgeBtn) {
    confirmPurgeBtn.onclick = confirmPurgeAllStudents;
  }

  // Broadcast Form
  const broadcastForm = document.getElementById('form-admin-broadcast');
  if (broadcastForm) {
    broadcastForm.addEventListener('submit', handlePostBroadcast);
  }

  // Create Student Form
  const addStudentForm = document.getElementById('form-add-candidate-submit');
  if (addStudentForm) {
    addStudentForm.addEventListener('submit', handleCreateStudent);
  }

  // Edit Student Form
  const editStudentForm = document.getElementById('form-edit-candidate-submit');
  if (editStudentForm) {
    editStudentForm.addEventListener('submit', handleUpdateStudent);
  }
}

// CREATE Student Operation
async function handleCreateStudent(e) {
  e.preventDefault();

  const name = document.getElementById('add-student-name').value.trim();
  const email = document.getElementById('add-student-email').value.trim().toLowerCase();
  const college = document.getElementById('add-student-college').value.trim();
  const rollNo = document.getElementById('add-student-roll').value.trim();
  const course = document.getElementById('add-student-course') ? document.getElementById('add-student-course').value.trim() : 'B.Tech';
  const branch = document.getElementById('add-student-branch') ? document.getElementById('add-student-branch').value.trim() : 'CSE';
  const section = document.getElementById('add-student-section') ? document.getElementById('add-student-section').value.trim() : 'A';
  const teamName = document.getElementById('add-student-team').value.trim();
  const track = document.getElementById('add-student-track').value;
  const role = document.getElementById('add-student-role').value;

  if (!name || !email || !teamName || !rollNo) {
    window.showToast('Name, email, roll number, and team name are required.', 'error');
    return;
  }

  try {
    // 1. Create user with metadata: rollNo|college|phone|course|branch|section
    const username = `${rollNo}|${college}||${course}|${branch}|${section}`;
    const userRes = await window.SupabaseDB.createUser({ name, email, username });
    const userId = userRes.data.id;

    // 2. Find or create team
    let team = allTeams.find(t => t.name.toLowerCase() === teamName.toLowerCase());
    if (team) {
      // Check if squad already has 4 members
      const existingMembers = candidateRegistry.filter(c => c.team_id === team.id);
      if (existingMembers.length >= 4) {
        window.showToast(`Cannot add candidate: Team "${team.name}" already has the maximum allowed 4 members.`, 'error');
        return;
      }
    } else {
      const code = window.SupabaseDB.generateUniqueCode('SRM-2026');
      const teamRes = await window.SupabaseDB.createTeam({
        name: teamName,
        track: track,
        abstract: `[CODE: ${code}] Admin Provisioned Squad`,
        leader_id: userId
      });
      team = teamRes.data;
    }

    // 3. Add to team members
    await window.SupabaseDB.addTeamMember({
      team_id: team.id,
      user_id: userId,
      role: role,
      status: 'ACTIVE'
    });

    window.closeModal('modal-add-candidate');
    e.target.reset();
    window.showToast(`Candidate "${name}" registered successfully into Supabase!`, 'success');
    await loadAdminData();

  } catch (err) {
    console.error('Create student error:', err);
    window.showToast('Failed to create student record.', 'error');
  }
}

// UPDATE Student Operation
window.openEditStudentModal = function(studentId) {
  const student = candidateRegistry.find(c => c.id === studentId);
  if (!student) return;

  document.getElementById('edit-student-id').value = student.id;
  document.getElementById('edit-student-name').value = student.name;
  document.getElementById('edit-student-email').value = student.email;
  document.getElementById('edit-student-college').value = student.college;
  document.getElementById('edit-student-roll').value = student.rollNo;
  if (document.getElementById('edit-student-course')) document.getElementById('edit-student-course').value = student.course || 'B.Tech';
  if (document.getElementById('edit-student-branch')) document.getElementById('edit-student-branch').value = student.branch || 'CSE';
  if (document.getElementById('edit-student-section')) document.getElementById('edit-student-section').value = student.section || 'A';
  document.getElementById('edit-student-role').value = student.role;
  document.getElementById('edit-student-status').value = student.status;

  window.openModal('modal-edit-candidate');
};

async function handleUpdateStudent(e) {
  e.preventDefault();

  const id = document.getElementById('edit-student-id').value;
  const name = document.getElementById('edit-student-name').value.trim();
  const email = document.getElementById('edit-student-email').value.trim().toLowerCase();
  const college = document.getElementById('edit-student-college').value.trim();
  const rollNo = document.getElementById('edit-student-roll').value.trim();
  const course = document.getElementById('edit-student-course') ? document.getElementById('edit-student-course').value.trim() : 'B.Tech';
  const branch = document.getElementById('edit-student-branch') ? document.getElementById('edit-student-branch').value.trim() : 'CSE';
  const section = document.getElementById('edit-student-section') ? document.getElementById('edit-student-section').value.trim() : 'A';
  const role = document.getElementById('edit-student-role').value;
  const status = document.getElementById('edit-student-status').value;

  try {
    const username = `${rollNo}|${college}||${course}|${branch}|${section}`;
    await window.SupabaseDB.updateUser(id, { name, email, username });

    // Update member role and status
    const members = await window.SupabaseDB.getTeamMembers();
    const mem = members.find(m => m.user_id === id);
    if (mem) {
      mem.role = role;
      mem.status = status;
      window.SupabaseDB.updateLocalItem('team_members', mem.id, { role, status });
    }

    window.closeModal('modal-edit-candidate');
    window.showToast(`Candidate "${name}" updated successfully!`, 'success');
    await loadAdminData();

  } catch (err) {
    console.error('Update student error:', err);
    window.showToast('Failed to update student details.', 'error');
  }
}

// DELETE Student Operation
window.confirmDeleteStudent = async function(id, name) {
  if (confirm(`WARNING: Are you sure you want to permanently delete student "${name}" from the database?`)) {
    try {
      await window.SupabaseDB.deleteUser(id);
      window.showToast(`Record for "${name}" deleted.`, 'info');
      await loadAdminData();
    } catch (err) {
      console.error('Delete error:', err);
      window.showToast('Failed to delete student.', 'error');
    }
  }
};

// PURGE ALL STUDENTS & SQUADS OPERATION
window.confirmPurgeAllStudents = async function() {
  const confirmPurgeBtn = document.getElementById('btn-confirm-purge-all');
  const originalHtml = confirmPurgeBtn ? confirmPurgeBtn.innerHTML : '';

  if (confirmPurgeBtn) {
    confirmPurgeBtn.disabled = true;
    confirmPurgeBtn.innerHTML = `<span class="material-symbols-outlined spin">progress_activity</span> PURGING DATABASE...`;
  }

  try {
    const result = await window.SupabaseDB.deleteAllStudents();
    if (window.closeModal) {
      window.closeModal('modal-confirm-delete-all');
    }
    window.showToast('ALL student records, teams, and rosters successfully purged.', 'success');
    await loadAdminData();
  } catch (err) {
    console.error('Purge error:', err);
    window.showToast('Failed to purge student records. Please try again.', 'error');
  } finally {
    if (confirmPurgeBtn) {
      confirmPurgeBtn.disabled = false;
      confirmPurgeBtn.innerHTML = originalHtml;
    }
  }
};

// EXPORT TO CSV
function exportCandidatesCSV() {
  if (candidateRegistry.length === 0) {
    window.showToast('No student records to export.', 'error');
    return;
  }

  const headers = ['ID', 'Name', 'Email', 'College', 'Roll_No', 'Course', 'Branch', 'Section', 'Team_Name', 'Team_Code', 'Track', 'Role', 'Status', 'Registered_At'];
  const rows = candidateRegistry.map(c => [
    `"${c.public_user_id || c.id}"`,
    `"${c.name}"`,
    `"${c.email}"`,
    `"${c.college}"`,
    `"${c.rollNo}"`,
    `"${c.course || 'B.Tech'}"`,
    `"${c.branch || 'CSE'}"`,
    `"${c.section || 'A'}"`,
    `"${c.team_name}"`,
    `"${c.team_code}"`,
    `"${window.SupabaseDB.normalizeTrack(c.track)}"`,
    `"${c.role}"`,
    `"${c.status}"`,
    `"${c.created_at}"`
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `SRM_Hackathon_Registry_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.showToast('Candidate registry exported to CSV.', 'success');
}

// ANNOUNCEMENTS POSTING (CRUD on updates)
async function handlePostBroadcast(e) {
  e.preventDefault();

  const title = document.getElementById('broadcast-title').value.trim();
  const category = document.getElementById('broadcast-category').value;
  const priority = document.getElementById('broadcast-priority').value;
  const track = document.getElementById('broadcast-track').value;
  const content = document.getElementById('broadcast-content').value.trim();

  if (!title || !content) {
    window.showToast('Broadcast title and content are mandatory.', 'error');
    return;
  }

  const newAnn = window.SupabaseDB.createAnnouncement({
    title,
    category,
    priority,
    track,
    content
  });

  e.target.reset();
  window.showToast(`Broadcast "${title}" published across all student portals!`, 'success');
  renderBroadcastsList();

  // If on main page, re-render
  if (typeof renderAnnouncements === 'function') {
    renderAnnouncements();
  }
}

function renderBroadcastsList() {
  const container = document.getElementById('admin-broadcasts-list');
  if (!container) return;

  const announcements = window.SupabaseDB.getAnnouncements();
  container.innerHTML = '';

  if (announcements.length === 0) {
    container.innerHTML = `<div class="text-muted" style="padding: 1rem;">No recent broadcasts.</div>`;
    return;
  }

  announcements.slice(0, 8).forEach(item => {
    const div = document.createElement('div');
    div.className = 'cyber-card';
    div.style.background = 'var(--surface-high)';
    div.style.padding = '0.85rem 1rem';
    div.style.marginBottom = '0.75rem';

    div.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
        <div>
          <div style="display: flex; gap: 0.4rem; align-items: center; margin-bottom: 0.25rem;">
            <span class="badge ${item.priority === 'Critical' ? 'badge-red' : 'badge-cyan'}">${item.priority}</span>
            <span class="badge badge-purple">${item.category}</span>
          </div>
          <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-bright);">${item.title}</div>
          <p style="font-size: 0.78rem; color: var(--text-dim); margin-top: 0.25rem;">${item.content.substring(0, 100)}...</p>
        </div>
        <button class="btn btn-danger btn-sm" onclick="deleteBroadcast('${item.id}')" title="Delete Broadcast">
          <span class="material-symbols-outlined" style="font-size: 0.85rem;">delete</span>
        </button>
      </div>
    `;
    container.appendChild(div);
  });
}

window.deleteBroadcast = function(id) {
  if (confirm('Delete this broadcast announcement?')) {
    window.SupabaseDB.deleteAnnouncement(id);
    renderBroadcastsList();
    if (typeof renderAnnouncements === 'function') renderAnnouncements();
    window.showToast('Broadcast removed.', 'info');
  }
};

// SUPPORT TICKETS
function renderTicketsList(tickets) {
  const container = document.getElementById('admin-tickets-list');
  if (!container) return;

  container.innerHTML = '';
  if (tickets.length === 0) {
    container.innerHTML = `<div class="text-muted" style="padding: 1rem;">No support inquiries currently pending.</div>`;
    return;
  }

  tickets.forEach(t => {
    const div = document.createElement('div');
    div.className = 'cyber-card';
    div.style.background = 'var(--surface-high)';
    div.style.padding = '0.85rem 1rem';
    div.style.marginBottom = '0.75rem';

    const isResolved = t.status === 'RESOLVED';

    div.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
        <span class="badge ${isResolved ? 'badge-green' : 'badge-amber'}">${t.status}</span>
        <span style="font-size: 0.72rem; color: var(--text-dim);">${new Date(t.created_at).toLocaleDateString()}</span>
      </div>
      <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-bright);">${t.name} (${t.email})</div>
      <div style="font-size: 0.75rem; color: var(--primary); margin: 0.2rem 0;">${t.category}</div>
      <p style="font-size: 0.8rem; color: var(--text-main); margin-bottom: 0.5rem;">${t.message}</p>
      ${!isResolved ? `
        <button class="btn btn-outline-green btn-sm" onclick="resolveTicket('${t.id}')">
          <span class="material-symbols-outlined" style="font-size: 0.85rem;">done</span> MARK RESOLVED
        </button>
      ` : `<span class="text-green" style="font-size: 0.75rem;">Resolved</span>`}
    `;
    container.appendChild(div);
  });
}

window.resolveTicket = async function(id) {
  await window.SupabaseDB.updateTicketStatus(id, 'RESOLVED');
  window.showToast('Ticket marked as resolved.', 'success');
  loadAdminData();
};
