/**
 * SRM HACKATHON 2026 - Registration Engine
 * Handles Leader Team Creation with Auto-Generated Unique Code, and Teammate Code Verification.
 */

document.addEventListener('DOMContentLoaded', () => {
  initLeaderRegistration();
  initTeammateRegistration();
});

// Team Leader Registration (Create Squad)
function initLeaderRegistration() {
  const form = document.getElementById('form-create-team');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="material-symbols-outlined spin">progress_activity</span> GENERATING SQUAD ID...`;

    try {
      // 1. Extract Form Values
      const teamName = document.getElementById('team-name').value.trim();
      const track = document.getElementById('team-track').value;
      const abstract = document.getElementById('team-abstract').value.trim();

      const leaderName = document.getElementById('leader-name').value.trim();
      const leaderEmail = document.getElementById('leader-email').value.trim().toLowerCase();
      const leaderCollege = document.getElementById('leader-college').value.trim();
      const leaderRoll = document.getElementById('leader-roll').value.trim();
      const leaderCourse = document.getElementById('leader-course').value.trim();
      const leaderBranch = document.getElementById('leader-branch').value.trim();
      const leaderSection = document.getElementById('leader-section').value.trim();
      const leaderPhone = document.getElementById('leader-phone').value.trim();

      if (!teamName || !track || !leaderName || !leaderEmail || !leaderRoll || !leaderCourse || !leaderBranch || !leaderSection || !leaderPhone) {
        window.showToast('Please fill in all mandatory fields (marked with *).', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
        return;
      }

      // 2. Generate Unique Verification Code
      const uniqueCode = window.SupabaseDB.generateUniqueCode('SRM-2026');
      const uniqueTeamId = `TEAM-2026-${Math.random().toString(16).substring(2, 10).toUpperCase()}`;

      // 3. Create Leader User in app_users
      // Pack extra student metadata: rollNo|college|phone|course|branch|section
      const metaUsername = `${leaderRoll}|${leaderCollege}|${leaderPhone}|${leaderCourse}|${leaderBranch}|${leaderSection}`;
      const userRes = await window.SupabaseDB.createUser({
        name: leaderName,
        email: leaderEmail,
        username: metaUsername
      });

      const leaderId = userRes.data.id;

      // 4. Create Team in teams (include uniqueCode in abstract/id)
      const teamRes = await window.SupabaseDB.createTeam({
        name: teamName,
        track: track,
        abstract: `[CODE: ${uniqueCode}] ${abstract}`,
        team_id: uniqueTeamId,
        leader_id: leaderId
      });

      const teamId = teamRes.data.id;

      // 5. Link Leader in team_members
      await window.SupabaseDB.addTeamMember({
        team_id: teamId,
        user_id: leaderId,
        role: 'LEADER',
        status: 'ACTIVE'
      });

      // 6. Display Success Modal with Generated Code
      showTeamCreatedModal({
        teamName,
        uniqueCode,
        teamId: uniqueTeamId,
        track,
        leaderName,
        leaderEmail
      });

      form.reset();
      window.showToast('Squad registered successfully! Share your unique code with teammates.', 'success');

    } catch (err) {
      console.error('Registration failed:', err);
      window.showToast('Failed to register squad. Please check details and try again.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });
}

// Display Team Created Modal with One-Click Copy
function showTeamCreatedModal(data) {
  const modal = document.getElementById('modal-team-created');
  if (!modal) return;

  document.getElementById('created-team-name').textContent = data.teamName;
  document.getElementById('created-team-track').textContent = window.SupabaseDB.normalizeTrack(data.track);
  document.getElementById('created-leader-name').textContent = data.leaderName;

  const codeEl = document.getElementById('created-unique-code');
  codeEl.textContent = data.uniqueCode;

  // Set up copy button
  const copyBtn = document.getElementById('btn-copy-code');
  if (copyBtn) {
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(data.uniqueCode);
      window.showToast(`Verification code ${data.uniqueCode} copied to clipboard!`, 'success');
      copyBtn.innerHTML = `<span class="material-symbols-outlined text-green">check</span> COPIED!`;
      setTimeout(() => {
        copyBtn.innerHTML = `<span class="material-symbols-outlined">content_copy</span> COPY CODE`;
      }, 2500);
    };
  }

  // Set up WhatsApp Share
  const shareBtn = document.getElementById('btn-share-whatsapp');
  if (shareBtn) {
    const normalizedTrack = window.SupabaseDB.normalizeTrack(data.track);
    const text = encodeURIComponent(
      `🚀 Join my team "${data.teamName}" for SRM Hackathon 2026 (${normalizedTrack})!\n` +
      `Use my unique student verification code: ${data.uniqueCode}\n` +
      `Register now on the SRM Hackathon Portal!`
    );
    shareBtn.href = `https://api.whatsapp.com/send?text=${text}`;
  }

  window.openModal('modal-team-created');
}

const MAX_MEMBERS_PER_TEAM = 4;

// Teammate Registration & Unique Code Verification
function initTeammateRegistration() {
  const verifyBtn = document.getElementById('btn-verify-team-code');
  const codeInput = document.getElementById('join-team-code');
  const previewBox = document.getElementById('team-verify-preview');
  const joinForm = document.getElementById('form-join-teammate');

  let verifiedTeam = null;

  if (verifyBtn && codeInput) {
    verifyBtn.addEventListener('click', async () => {
      const code = codeInput.value.trim().toUpperCase();
      if (!code) {
        window.showToast('Please enter a team verification code.', 'error');
        return;
      }

      verifyBtn.disabled = true;
      verifyBtn.innerHTML = `<span class="material-symbols-outlined spin">progress_activity</span> VERIFYING...`;

      try {
        const team = await window.SupabaseDB.getTeamByCode(code);
        if (!team) {
          window.showToast('Invalid or unrecognized team code. Please check with your team leader.', 'error');
          if (previewBox) previewBox.style.display = 'none';
          verifiedTeam = null;
        } else {
          // Check existing member count
          const members = await window.SupabaseDB.getTeamMembers();
          const teamMembers = members.filter(m => m.team_id === team.id);
          const currentCount = teamMembers.length;

          verifiedTeam = team;
          if (previewBox) {
            previewBox.style.display = 'block';
            document.getElementById('verify-team-name').textContent = team.name;
            document.getElementById('verify-team-track').textContent = window.SupabaseDB.normalizeTrack(team.track);
            document.getElementById('verify-team-id').textContent = team.team_id || code;

            const capacityEl = document.getElementById('verify-team-capacity');
            const submitBtn = joinForm ? joinForm.querySelector('button[type="submit"]') : null;

            if (currentCount >= MAX_MEMBERS_PER_TEAM) {
              previewBox.style.background = 'rgba(255, 0, 85, 0.08)';
              previewBox.style.borderColor = 'rgba(255, 0, 85, 0.4)';
              if (capacityEl) {
                capacityEl.innerHTML = `<span class="badge badge-red" style="font-size: 0.85rem;">SQUAD FULL: 4/4 SLOTS OCCUPIED</span>`;
              }
              if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.classList.remove('btn-outline-green');
                submitBtn.classList.add('btn-danger');
                submitBtn.innerHTML = `<span class="material-symbols-outlined">block</span> SQUAD FULL (MAX 4 REACHED)`;
              }
              window.showToast(`Team "${team.name}" has already reached the maximum limit of 4 members.`, 'error');
            } else {
              previewBox.style.background = 'rgba(0, 254, 102, 0.05)';
              previewBox.style.borderColor = 'rgba(0, 254, 102, 0.3)';
              const remaining = MAX_MEMBERS_PER_TEAM - currentCount;
              if (capacityEl) {
                capacityEl.innerHTML = `<span class="badge badge-green" style="font-size: 0.85rem;">${currentCount}/4 SLOTS FILLED (${remaining} OPEN)</span>`;
              }
              if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.classList.remove('btn-danger');
                submitBtn.classList.add('btn-outline-green');
                submitBtn.innerHTML = `<span class="material-symbols-outlined">how_to_reg</span> COMPLETE INDUCTION`;
              }
              window.showToast(`Team "${team.name}" verified! ${remaining} of 4 member slots available.`, 'success');
            }
          }
        }
      } catch (err) {
        console.error('Verification error:', err);
        window.showToast('Error validating team code.', 'error');
      } finally {
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = `<span class="material-symbols-outlined">verified</span> VERIFY CODE`;
      }
    });
  }

  // Submit Teammate Details
  if (joinForm) {
    joinForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!verifiedTeam) {
        window.showToast('Please verify your team code first before registering.', 'error');
        return;
      }

      const submitBtn = joinForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;

      // Double-check maximum 4 members limit from live database
      const liveMembers = await window.SupabaseDB.getTeamMembers();
      const currentTeamMembers = liveMembers.filter(m => m.team_id === verifiedTeam.id);
      if (currentTeamMembers.length >= MAX_MEMBERS_PER_TEAM) {
        window.showToast(`Registration blocked: Team "${verifiedTeam.name}" has already reached the maximum capacity of 4 members.`, 'error');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="material-symbols-outlined spin">progress_activity</span> REGISTERING MEMBER...`;

      try {
        const memberName = document.getElementById('member-name').value.trim();
        const memberEmail = document.getElementById('member-email').value.trim().toLowerCase();
        const memberCollege = document.getElementById('member-college').value.trim();
        const memberRoll = document.getElementById('member-roll').value.trim();
        const memberCourse = document.getElementById('member-course').value.trim();
        const memberBranch = document.getElementById('member-branch').value.trim();
        const memberSection = document.getElementById('member-section').value.trim();
        const memberPhone = document.getElementById('member-phone').value.trim();

        if (!memberName || !memberEmail || !memberRoll || !memberCourse || !memberBranch || !memberSection || !memberPhone) {
          window.showToast('Please fill in all mandatory fields (marked with *).', 'error');
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
          return;
        }

        // 1. Create Member in app_users
        // Pack student metadata: rollNo|college|phone|course|branch|section
        const metaUsername = `${memberRoll}|${memberCollege}|${memberPhone}|${memberCourse}|${memberBranch}|${memberSection}`;
        const userRes = await window.SupabaseDB.createUser({
          name: memberName,
          email: memberEmail,
          username: metaUsername
        });

        const memberId = userRes.data.id;

        // 2. Link Member to verified team
        await window.SupabaseDB.addTeamMember({
          team_id: verifiedTeam.id,
          user_id: memberId,
          role: 'MEMBER',
          status: 'ACTIVE'
        });

        window.showToast(`Success! You have officially joined team ${verifiedTeam.name}.`, 'success');

        // 3. Show Member Induction Modal
        showMemberInductionModal({
          memberName,
          memberRoll,
          teamName: verifiedTeam.name,
          track: verifiedTeam.track,
          teamCode: codeInput.value.trim().toUpperCase()
        });

        joinForm.reset();
        if (previewBox) previewBox.style.display = 'none';
        verifiedTeam = null;

      } catch (err) {
        console.error('Member join error:', err);
        window.showToast('Failed to join team. Please try again.', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }
}

// Show Member Induction Success Modal
function showMemberInductionModal(data) {
  const modal = document.getElementById('modal-member-joined');
  if (!modal) return;

  document.getElementById('joined-member-name').textContent = data.memberName;
  document.getElementById('joined-member-roll').textContent = data.memberRoll;
  document.getElementById('joined-team-name').textContent = data.teamName;
  document.getElementById('joined-team-track').textContent = window.SupabaseDB.normalizeTrack(data.track);

  window.openModal('modal-member-joined');
}
