/**
 * SRM HACKATHON 2026 - Announcements & Live Telemetry Feed
 * Displays real-time updates for student awareness with category and priority filtering.
 */

document.addEventListener('DOMContentLoaded', () => {
  renderAnnouncements();
  initAnnouncementFilters();
  initContactForm();
});

let currentCategory = 'ALL';
let searchQuery = '';

function renderAnnouncements() {
  const container = document.getElementById('announcements-feed');
  if (!container) return;

  const announcements = window.SupabaseDB.getAnnouncements();

  // Filter
  const filtered = announcements.filter(item => {
    const matchesCat = currentCategory === 'ALL' || item.category.toUpperCase() === currentCategory.toUpperCase();
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || 
      item.title.toLowerCase().includes(q) || 
      item.content.toLowerCase().includes(q) || 
      (item.track && item.track.toLowerCase().includes(q));
    return matchesCat && matchesSearch;
  });

  container.innerHTML = '';

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="cyber-card text-center" style="padding: 2.5rem 1rem;">
        <span class="material-symbols-outlined text-muted" style="font-size: 2.5rem;">satellite_alt</span>
        <p class="text-muted" style="margin-top: 0.5rem;">NO BROADCAST RECORDS FOUND FOR CURRENT FILTER</p>
      </div>
    `;
    return;
  }

  filtered.forEach(item => {
    const card = document.createElement('div');
    card.className = 'cyber-card';
    card.style.marginBottom = '1.25rem';
    card.style.borderLeft = item.priority === 'Critical' ? '3px solid var(--alert-red)' : '3px solid var(--primary)';

    const priorityBadge = item.priority === 'Critical' 
      ? '<span class="badge badge-red">CRITICAL ALERT</span>'
      : (item.priority === 'High' ? '<span class="badge badge-amber">HIGH PRIORITY</span>' : '<span class="badge badge-cyan">INFO</span>');

    const formattedDate = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + 
      ' • ' + new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.75rem;">
        <div>
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem;">
            ${priorityBadge}
            <span class="badge badge-purple">${item.category}</span>
            <span style="font-size: 0.75rem; color: var(--text-dim);">${item.track === 'All Tracks' ? 'All Tracks' : window.SupabaseDB.normalizeTrack(item.track)}</span>
          </div>
          <h3 style="color: var(--text-bright); font-size: 1.15rem;">${item.title}</h3>
        </div>
        <span style="font-size: 0.75rem; color: var(--text-dim); font-family: var(--font-mono);">${formattedDate}</span>
      </div>
      <p style="color: var(--text-main); font-size: 0.88rem; line-height: 1.6; margin-bottom: 0.75rem;">${item.content}</p>
      <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 0.6rem; font-size: 0.75rem; color: var(--text-dim);">
        <span>ID: <code style="color: var(--primary);">${item.id}</code></span>
        <span class="text-green" style="display: flex; align-items: center; gap: 0.25rem;">
          <span class="material-symbols-outlined" style="font-size: 0.9rem;">check_circle</span> VERIFIED BROADCAST
        </span>
      </div>
    `;

    container.appendChild(card);
  });
}

function initAnnouncementFilters() {
  const tabs = document.querySelectorAll('.announcement-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      tabs.forEach(t => t.classList.remove('active'));
      e.currentTarget.classList.add('active');
      currentCategory = e.currentTarget.dataset.category || 'ALL';
      renderAnnouncements();
    });
  });

  const searchInput = document.getElementById('announcements-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      renderAnnouncements();
    });
  }
}

// Contact Us & Helpdesk ticket submission
function initContactForm() {
  const contactForm = document.getElementById('form-contact-support');
  if (!contactForm) return;

  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = contactForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="material-symbols-outlined spin">progress_activity</span> TRANSMITTING TICKET...`;

    try {
      const name = document.getElementById('contact-name').value.trim();
      const email = document.getElementById('contact-email').value.trim();
      const category = document.getElementById('contact-category').value;
      const message = document.getElementById('contact-message').value.trim();

      if (!name || !email || !message) {
        window.showToast('Please provide your name, email, and message.', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
        return;
      }

      await window.SupabaseDB.createSupportTicket({
        name,
        email,
        category,
        message
      });

      contactForm.reset();
      window.showToast('Support ticket transmitted! The SRM Hackathon team will follow up via email.', 'success');
    } catch (err) {
      console.error('Contact error:', err);
      window.showToast('Failed to transmit ticket. Please retry.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });
}
