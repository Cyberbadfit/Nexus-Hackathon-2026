/**
 * SRM HACKATHON 2026 - Registration Status Check & ID Passcard Generator
 * Allows students and leaders to verify live team induction status and export passes.
 */

document.addEventListener('DOMContentLoaded', () => {
  initStatusCheck();
});

function initStatusCheck() {
  const form = document.getElementById('form-status-check');
  const resultCard = document.getElementById('status-result-card');
  if (!form || !resultCard) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const query = document.getElementById('status-query').value.trim();
    if (!query) {
      window.showToast('Please enter a team code, email, or student roll number.', 'error');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="material-symbols-outlined spin">progress_activity</span> SCANNING REGISTRY...`;

    try {
      const [teams, users, members] = await Promise.all([
        window.SupabaseDB.getTeams(),
        window.SupabaseDB.getUsers(),
        window.SupabaseDB.getTeamMembers()
      ]);

      const q = query.toLowerCase();

      // Find user if matching email, roll, or name
      const matchedUser = users.find(u => 
        (u.email && u.email.toLowerCase() === q) ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.username && u.username.toLowerCase().includes(q))
      );

      // Find team if query matches team_id, name, or abstract code
      let matchedTeam = teams.find(t => 
        (t.team_id && t.team_id.toLowerCase() === q) ||
        (t.name && t.name.toLowerCase().includes(q)) ||
        (t.abstract && t.abstract.toLowerCase().includes(q))
      );

      // If user found but not team, look up user's team
      if (matchedUser && !matchedTeam) {
        const userMembership = members.find(m => m.user_id === matchedUser.id);
        if (userMembership) {
          matchedTeam = teams.find(t => t.id === userMembership.team_id);
        }
      }

      if (!matchedTeam) {
        resultCard.style.display = 'none';
        window.showToast('No active registration found matching your query. Check details or register.', 'error');
        return;
      }

      // Gather team roster
      const teamMemberships = members.filter(m => m.team_id === matchedTeam.id);
      const userMap = new Map();
      users.forEach(u => userMap.set(u.id, u));

      const roster = teamMemberships.map(m => {
        const u = userMap.get(m.user_id) || {};
        let roll = 'ROLL-N/A';
        let college = 'SRM Institute of Science and Technology';
        let phone = '';
        let course = 'B.Tech';
        let branch = 'CSE';
        let section = 'A';
        if (u.username && u.username.includes('|')) {
          const parts = u.username.split('|');
          roll = parts[0] || roll;
          college = parts[1] || college;
          phone = parts[2] || phone;
          course = parts[3] || course;
          branch = parts[4] || branch;
          section = parts[5] || section;
        }
        return {
          name: u.name || 'Hacker',
          email: u.email || '',
          roll: roll,
          college: college,
          phone: phone,
          course: course,
          branch: branch,
          section: section,
          role: m.role || 'MEMBER',
          status: m.status || 'ACTIVE'
        };
      });

      renderStatusResult(matchedTeam, roster);
      resultCard.style.display = 'block';
      resultCard.scrollIntoView({ behavior: 'smooth' });
      window.showToast(`Found registration records for "${matchedTeam.name}"!`, 'success');

    } catch (err) {
      console.error('Status check error:', err);
      window.showToast('Error querying status registry. Please try again.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });
}

function renderStatusResult(team, roster) {
  document.getElementById('res-team-name').textContent = team.name;
  document.getElementById('res-team-track').textContent = window.SupabaseDB.normalizeTrack(team.track);
  document.getElementById('res-team-id').textContent = team.team_id || 'SRM-AUTO-GEN';
  
  // Extract custom verification code if present
  let uniqueCode = team.team_id;
  const match = team.abstract ? team.abstract.match(/\[CODE:\s*([^\]]+)\]/) : null;
  if (match && match[1]) {
    uniqueCode = match[1];
  }
  document.getElementById('res-unique-code').textContent = uniqueCode;

  // Render Squad Capacity (Max 4 members)
  const capacityEl = document.getElementById('res-team-capacity');
  if (capacityEl) {
    const count = roster.length;
    if (count >= 4) {
      capacityEl.innerHTML = `<span class="badge badge-purple">SQUAD CAPACITY: 4/4 (FULL)</span>`;
    } else {
      const remaining = 4 - count;
      capacityEl.innerHTML = `<span class="badge badge-cyan">SQUAD CAPACITY: ${count}/4 (${remaining} OPEN)</span>`;
    }
  }

  // Render Roster
  const rosterContainer = document.getElementById('res-roster-list');
  rosterContainer.innerHTML = '';

  if (roster.length === 0) {
    rosterContainer.innerHTML = `<div class="text-muted" style="padding: 1rem;">No members recorded yet.</div>`;
  } else {
    roster.forEach((m, idx) => {
      const isLeader = m.role === 'LEADER';
      const row = document.createElement('div');
      row.className = 'cyber-card';
      row.style.background = 'var(--surface-high)';
      row.style.padding = '0.85rem 1.25rem';
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.justifyContent = 'space-between';
      row.style.gap = '1rem';
      row.style.flexWrap = 'wrap';

      row.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.85rem;">
          <span class="badge ${isLeader ? 'badge-cyan' : 'badge-green'}">${m.role}</span>
          <div>
            <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">${m.name}</div>
            <div style="font-size: 0.75rem; color: var(--text-dim);">${m.roll} • <span class="text-cyan">${m.course}</span> (${m.branch} - Sec ${m.section}) • ${m.college}</div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="font-size: 0.78rem; color: var(--text-dim);">${m.email}</span>
          <span class="badge badge-green">VERIFIED</span>
        </div>
      `;
      rosterContainer.appendChild(row);
    });
  }

  // Print Pass button
  const printBtn = document.getElementById('btn-print-pass');
  if (printBtn) {
    printBtn.onclick = () => window.print();
  }
}
