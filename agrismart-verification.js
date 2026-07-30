(() => {
  'use strict';

  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
  let profiles = [];

  function isAdmin() {
    const role = window.AgriSmartAuth?.getCurrentUser?.()?.rawRole;
    return role === 'admin' || role === 'super_admin';
  }

  function ensureWorkspace() {
    const nav = document.querySelector('.app-nav');
    if (nav && !nav.querySelector('[data-view="verification"]')) {
      const button = document.createElement('button');
      button.dataset.view = 'verification';
      button.hidden = !isAdmin();
      button.textContent = '✓ Account Verification';
      nav.querySelector('[data-view="settings"]')?.before(button);
    }

    const main = document.querySelector('.app-main');
    if (main && !main.querySelector('[data-view-panel="verification"]')) {
      const section = document.createElement('section');
      section.className = 'view verification-workspace';
      section.dataset.viewPanel = 'verification';
      section.innerHTML = `
        <div class="verification-hero">
          <div><p class="eyebrow">TRUST &amp; SAFETY</p><h2>Account verification</h2><p>Review farmer, buyer, supplier, agronomist and cooperative profiles before granting a trusted status.</p></div>
          <button class="secondary-btn" type="button" data-verification-refresh>Refresh queue</button>
        </div>
        <div class="metric-grid verification-metrics">
          <article class="metric-card"><span>Pending review</span><strong data-verification-count="pending">0</strong></article>
          <article class="metric-card"><span>Verified</span><strong data-verification-count="verified">0</strong></article>
          <article class="metric-card"><span>Rejected</span><strong data-verification-count="rejected">0</strong></article>
          <article class="metric-card"><span>Suspended</span><strong data-verification-count="suspended">0</strong></article>
        </div>
        <section class="panel">
          <div class="panel-head"><div><h3>Profile review queue</h3><p>Decisions are stored in the AgriSmart cloud and protected by administrator permissions.</p></div></div>
          <div class="verification-filters">
            <label><span>Status</span><select data-verification-filter="status"><option value="all">All statuses</option><option value="pending">Pending</option><option value="verified">Verified</option><option value="rejected">Rejected</option><option value="suspended">Suspended</option><option value="draft">Draft</option></select></label>
            <label><span>Account type</span><select data-verification-filter="type"><option value="all">All account types</option><option value="farmer">Farmer</option><option value="buyer">Buyer</option><option value="supplier">Supplier</option><option value="agronomist">Agronomist</option><option value="cooperative">Cooperative</option></select></label>
            <label><span>Country</span><input data-verification-filter="country" placeholder="Search country"></label>
          </div>
          <div class="verification-list" data-verification-list><p class="notice">Open this page while signed in as an administrator to load the queue.</p></div>
        </section>`;
      main.querySelector('[data-view-panel="settings"]')?.before(section);
    }
  }

  function formatDate(value) {
    if (!value) return 'Not submitted';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Not submitted' : date.toLocaleString();
  }

  function filteredProfiles() {
    const panel = document.querySelector('[data-view-panel="verification"]');
    const status = panel?.querySelector('[data-verification-filter="status"]')?.value || 'all';
    const type = panel?.querySelector('[data-verification-filter="type"]')?.value || 'all';
    const country = panel?.querySelector('[data-verification-filter="country"]')?.value?.trim().toLowerCase() || '';
    return profiles.filter(profile =>
      (status === 'all' || profile.verification_status === status) &&
      (type === 'all' || profile.account_type === type) &&
      (!country || String(profile.country || '').toLowerCase().includes(country))
    );
  }

  function render() {
    ensureWorkspace();
    const panel = document.querySelector('[data-view-panel="verification"]');
    if (!panel) return;
    panel.querySelectorAll('[data-verification-count]').forEach(node => {
      node.textContent = profiles.filter(profile => profile.verification_status === node.dataset.verificationCount).length;
    });
    const list = panel.querySelector('[data-verification-list]');
    const items = filteredProfiles();
    if (!items.length) {
      list.innerHTML = '<p class="notice">No profiles match the current filters.</p>';
      return;
    }
    list.innerHTML = items.map(profile => {
      const status = profile.verification_status || 'draft';
      const evidence = /^https?:\/\//i.test(profile.verification_evidence_url || '')
        ? `<a href="${esc(profile.verification_evidence_url)}" target="_blank" rel="noopener noreferrer">Open evidence ↗</a>`
        : '<span>No evidence link</span>';
      return `<article class="verification-card" data-verification-id="${esc(profile.id)}">
        <div class="verification-card-head">
          <div><h4>${esc(profile.full_name || 'Unnamed account')}</h4><p>${esc(profile.business_name || profile.organization || 'Independent account')}</p></div>
          <span class="verification-badge status-${esc(status)}">${esc(status)}</span>
        </div>
        <dl>
          <div><dt>Account type</dt><dd>${esc(profile.account_type || 'farmer')}</dd></div>
          <div><dt>Country</dt><dd>${esc(profile.country || 'Not supplied')}</dd></div>
          <div><dt>Registration</dt><dd>${esc(profile.registration_number || 'Not supplied')}</dd></div>
          <div><dt>Submitted</dt><dd>${esc(formatDate(profile.verification_submitted_at))}</dd></div>
        </dl>
        ${profile.address ? `<p class="verification-address">${esc(profile.address)}</p>` : ''}
        <div class="verification-evidence">${evidence}</div>
        ${profile.verification_note ? `<p class="notice">${esc(profile.verification_note)}</p>` : ''}
        <label class="field full"><span>Review note</span><textarea rows="2" data-verification-note placeholder="Reason or internal review note"></textarea></label>
        <div class="verification-actions">
          <button class="primary-btn" type="button" data-verification-decision="verified">Verify</button>
          <button class="secondary-btn" type="button" data-verification-decision="rejected">Reject</button>
          <button class="secondary-btn danger-btn" type="button" data-verification-decision="suspended">Suspend</button>
        </div>
      </article>`;
    }).join('');
  }

  async function load() {
    ensureWorkspace();
    if (!isAdmin()) {
      profiles = [];
      render();
      return;
    }
    const list = document.querySelector('[data-verification-list]');
    if (list) list.innerHTML = '<p class="notice">Loading secure verification queue...</p>';
    try {
      profiles = await window.AgriSmartAuth.listVerificationQueue();
      render();
    } catch (error) {
      if (list) list.innerHTML = `<p class="notice verification-error">${esc(error.message)} The verified-accounts database migration may still need to be applied.</p>`;
    }
  }

  document.addEventListener('click', async event => {
    if (event.target.closest('[data-verification-refresh]')) {
      await load();
      return;
    }
    const decisionButton = event.target.closest('[data-verification-decision]');
    if (!decisionButton) return;
    const card = decisionButton.closest('[data-verification-id]');
    const decision = decisionButton.dataset.verificationDecision;
    const note = card.querySelector('[data-verification-note]').value.trim();
    if (decision !== 'verified' && !note) {
      window.AgriSmartApp?.toast?.('Add a review reason before rejecting or suspending an account.', true);
      return;
    }
    decisionButton.disabled = true;
    try {
      await window.AgriSmartAuth.reviewVerification(card.dataset.verificationId, decision, note);
      window.AgriSmartApp?.toast?.(`Account marked ${decision}.`);
      await load();
    } catch (error) {
      window.AgriSmartApp?.toast?.(error.message, true);
    } finally {
      decisionButton.disabled = false;
    }
  });

  document.addEventListener('input', event => {
    if (event.target.matches('[data-verification-filter]')) render();
  });
  document.addEventListener('change', event => {
    if (event.target.matches('[data-verification-filter]')) render();
  });
  window.addEventListener('agrismart:authchange', () => {
    ensureWorkspace();
    document.querySelectorAll('[data-view="verification"]').forEach(button => { button.hidden = !isAdmin(); });
    if (isAdmin()) load();
  });
  window.addEventListener('agrismart:viewchange', event => {
    if (event.detail?.view === 'verification') load();
  });

  const init = () => { ensureWorkspace(); if (isAdmin()) load(); };
  window.AgriSmartVerification = Object.freeze({ render, load });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
