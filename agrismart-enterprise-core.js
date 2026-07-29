(() => {
  'use strict';

  const KEYS = Object.freeze({
    organizations: 'agrismart-enterprise-organizations-v1',
    users: 'agrismart-enterprise-users-v1',
    session: 'agrismart-enterprise-session-v1',
    audit: 'agrismart-enterprise-audit-v1'
  });

  const ROLE_PERMISSIONS = Object.freeze({
    super_admin: ['*'],
    organization_admin: ['organization.manage', 'users.manage', 'farms.*', 'inventory.*', 'warehouse.*', 'finance.*', 'procurement.*', 'reports.view', 'settings.manage', 'audit.view'],
    farm_manager: ['farms.*', 'inventory.view', 'inventory.update', 'warehouse.view', 'finance.view', 'reports.view', 'advisor.use'],
    agronomist: ['farms.view', 'farms.update', 'advisor.use', 'reports.view'],
    warehouse_officer: ['inventory.*', 'warehouse.*', 'procurement.view', 'reports.view'],
    accountant: ['finance.*', 'inventory.view', 'warehouse.view', 'procurement.view', 'reports.view'],
    procurement_officer: ['procurement.*', 'inventory.view', 'warehouse.view', 'finance.view'],
    auditor: ['farms.view', 'inventory.view', 'warehouse.view', 'finance.view', 'procurement.view', 'reports.view', 'audit.view'],
    read_only: ['farms.view', 'inventory.view', 'warehouse.view', 'finance.view', 'reports.view']
  });

  const roleLabels = Object.freeze({
    super_admin: 'Platform Super Admin', organization_admin: 'Organization Admin', farm_manager: 'Farm Manager',
    agronomist: 'Agronomist', warehouse_officer: 'Warehouse Officer', accountant: 'Accountant',
    procurement_officer: 'Procurement Officer', auditor: 'Auditor', read_only: 'Read-only User'
  });

  const id = prefix => `${prefix}-${crypto.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));

  function seed() {
    let organizations = read(KEYS.organizations, []);
    let users = read(KEYS.users, []);
    if (!organizations.length) {
      organizations = [{
        id: 'org-whsf-demo', name: 'WHSF AgriSmart Demonstration', code: 'WHSF-DEMO', country: 'NG',
        currency: 'NGN', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', status: 'active',
        createdAt: new Date().toISOString()
      }];
      write(KEYS.organizations, organizations);
    }
    if (!users.length) {
      users = [{
        id: 'user-demo-admin', organizationId: organizations[0].id, firstName: 'AgriSmart', lastName: 'Administrator',
        email: 'admin@agrismart.local', role: 'organization_admin', status: 'active', createdAt: new Date().toISOString()
      }];
      write(KEYS.users, users);
    }
    if (!read(KEYS.session, null)) write(KEYS.session, { userId: users[0].id, organizationId: users[0].organizationId, signedInAt: new Date().toISOString(), mode: 'local-prototype' });
  }

  seed();

  const getOrganizations = () => read(KEYS.organizations, []);
  const getUsers = () => read(KEYS.users, []);
  const getSession = () => read(KEYS.session, null);
  const getCurrentUser = () => getUsers().find(user => user.id === getSession()?.userId) || null;
  const getCurrentOrganization = () => getOrganizations().find(org => org.id === getSession()?.organizationId) || null;

  function audit(action, entityType, entityId, detail = {}) {
    const entries = read(KEYS.audit, []);
    const user = getCurrentUser();
    entries.unshift({ id: id('audit'), action, entityType, entityId, detail, userId: user?.id || null, organizationId: getSession()?.organizationId || null, createdAt: new Date().toISOString() });
    write(KEYS.audit, entries.slice(0, 1000));
    window.dispatchEvent(new CustomEvent('agrismart:audit', { detail: entries[0] }));
    return entries[0];
  }

  function hasPermission(permission) {
    const user = getCurrentUser();
    if (!user || user.status !== 'active') return false;
    const permissions = ROLE_PERMISSIONS[user.role] || [];
    if (permissions.includes('*') || permissions.includes(permission)) return true;
    const [resource] = permission.split('.');
    return permissions.includes(`${resource}.*`);
  }

  function requirePermission(permission) {
    if (!hasPermission(permission)) throw new Error(`Permission denied: ${permission}`);
  }

  function createOrganization(input) {
    requirePermission('organization.manage');
    const organizations = getOrganizations();
    const organization = {
      id: id('org'), name: String(input.name || '').trim(), code: String(input.code || '').trim().toUpperCase(),
      country: input.country || 'NG', currency: input.currency || 'NGN', timeZone: input.timeZone || 'UTC',
      status: 'active', createdAt: new Date().toISOString()
    };
    if (!organization.name || !organization.code) throw new Error('Organization name and code are required.');
    if (organizations.some(item => item.code === organization.code)) throw new Error('Organization code already exists.');
    organizations.push(organization); write(KEYS.organizations, organizations);
    audit('organization.created', 'organization', organization.id, { name: organization.name, code: organization.code });
    return organization;
  }

  function inviteUser(input) {
    requirePermission('users.manage');
    const users = getUsers();
    const organizationId = input.organizationId || getSession()?.organizationId;
    const email = String(input.email || '').trim().toLowerCase();
    if (!email || !organizationId || !ROLE_PERMISSIONS[input.role]) throw new Error('Email, organization and valid role are required.');
    if (users.some(user => user.email.toLowerCase() === email && user.organizationId === organizationId)) throw new Error('This user already exists in the organization.');
    const user = {
      id: id('user'), organizationId, firstName: String(input.firstName || '').trim(), lastName: String(input.lastName || '').trim(),
      email, role: input.role, status: 'invited', createdAt: new Date().toISOString()
    };
    users.push(user); write(KEYS.users, users);
    audit('user.invited', 'user', user.id, { email: user.email, role: user.role });
    return user;
  }

  function switchOrganization(organizationId) {
    const user = getCurrentUser();
    if (!user) throw new Error('No active session.');
    if (user.role !== 'super_admin' && user.organizationId !== organizationId) throw new Error('You cannot access this organization.');
    const organization = getOrganizations().find(item => item.id === organizationId);
    if (!organization) throw new Error('Organization not found.');
    write(KEYS.session, { ...getSession(), organizationId, switchedAt: new Date().toISOString() });
    audit('session.organization_switched', 'organization', organizationId, { name: organization.name });
    window.dispatchEvent(new CustomEvent('agrismart:organizationchange', { detail: organization }));
    return organization;
  }

  function scopedKey(baseKey, organizationId = getSession()?.organizationId) {
    if (!organizationId) throw new Error('Organization context is required.');
    return `${baseKey}::${organizationId}`;
  }

  const storage = Object.freeze({
    get(baseKey, fallback = null) { return read(scopedKey(baseKey), fallback); },
    set(baseKey, value) { write(scopedKey(baseKey), value); return value; },
    remove(baseKey) { localStorage.removeItem(scopedKey(baseKey)); }
  });

  function addEnterpriseView() {
    const main = document.querySelector('.app-main');
    const nav = document.querySelector('.app-nav');
    if (!main || !nav || document.querySelector('[data-view-panel="enterprise"]')) return;

    const view = document.createElement('section');
    view.className = 'view';
    view.dataset.viewPanel = 'enterprise';
    view.innerHTML = '<div class="section-heading"><p class="eyebrow">Enterprise core</p><h2>Organizations, users and access control</h2><p>Establish the secure operating structure that will support cloud authentication and multi-tenant data.</p></div><div data-enterprise-panel></div>';
    main.appendChild(view);

    const button = document.createElement('button');
    button.type = 'button'; button.dataset.view = 'enterprise'; button.textContent = '◆ Enterprise';
    nav.appendChild(button);
    button.addEventListener('click', () => showEnterpriseView());
    renderEnterprise();
  }

  function showEnterpriseView() {
    document.querySelectorAll('.view').forEach(item => item.classList.toggle('active', item.dataset.viewPanel === 'enterprise'));
    document.querySelectorAll('[data-view]').forEach(item => item.classList.toggle('active', item.dataset.view === 'enterprise'));
    const title = document.querySelector('[data-page-title]');
    const subtitle = document.querySelector('[data-page-subtitle]');
    if (title) title.textContent = 'Enterprise Administration';
    if (subtitle) subtitle.textContent = 'Manage organizations, users, roles, permissions and audit activity.';
    history.replaceState(null, '', '#enterprise');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderEnterprise() {
    const root = document.querySelector('[data-enterprise-panel]');
    if (!root) return;
    const organization = getCurrentOrganization();
    const user = getCurrentUser();
    const users = getUsers().filter(item => item.organizationId === organization?.id);
    const auditEntries = read(KEYS.audit, []).filter(item => item.organizationId === organization?.id).slice(0, 8);
    root.innerHTML = `
      <div class="metric-grid">
        <article class="metric-card"><span>Organization</span><strong>${escapeHtml(organization?.code || '—')}</strong><small>${escapeHtml(organization?.name || 'Not selected')}</small></article>
        <article class="metric-card"><span>Users</span><strong>${users.length}</strong><small>Active and invited accounts</small></article>
        <article class="metric-card"><span>Your role</span><strong>${escapeHtml(roleLabels[user?.role] || 'Unknown')}</strong><small>${hasPermission('users.manage') ? 'Administrative access' : 'Restricted access'}</small></article>
        <article class="metric-card"><span>Audit events</span><strong>${auditEntries.length}</strong><small>Recent organization activity</small></article>
      </div>
      <div class="dashboard-grid" style="margin-top:18px">
        <section class="panel"><div class="panel-head"><div><h3>Organization profile</h3><p>Current tenant context for all enterprise records.</p></div><span class="chip">${escapeHtml(organization?.status || 'unknown')}</span></div>
          <div class="result-list"><article><strong>${escapeHtml(organization?.name || '')}</strong><p>${escapeHtml(organization?.country || '')} · ${escapeHtml(organization?.currency || '')} · ${escapeHtml(organization?.timeZone || '')}</p></article></div>
          <div class="notice" style="margin-top:14px">This release establishes the tenant and permission model locally. Production authentication and database isolation will be connected to Supabase or PostgreSQL after deployment credentials are configured.</div>
        </section>
        <section class="panel"><div class="panel-head"><h3>Invite team member</h3></div>
          <form class="form-grid" data-invite-user-form>
            <label class="field"><span>First name</span><input name="firstName" required></label>
            <label class="field"><span>Last name</span><input name="lastName" required></label>
            <label class="field full"><span>Email</span><input name="email" type="email" required></label>
            <label class="field full"><span>Role</span><select name="role" required>${Object.entries(roleLabels).filter(([key]) => key !== 'super_admin').map(([key,label]) => `<option value="${key}">${escapeHtml(label)}</option>`).join('')}</select></label>
            <button class="primary-btn" type="submit" ${hasPermission('users.manage') ? '' : 'disabled'}>Create invitation</button>
          </form>
        </section>
      </div>
      <div class="dashboard-grid" style="margin-top:18px">
        <section class="panel"><div class="panel-head"><h3>Organization users</h3></div><div class="result-list">${users.map(item => `<article><strong>${escapeHtml(`${item.firstName} ${item.lastName}`.trim() || item.email)}</strong><p>${escapeHtml(item.email)} · ${escapeHtml(roleLabels[item.role] || item.role)} · ${escapeHtml(item.status)}</p></article>`).join('') || '<div class="notice">No users found.</div>'}</div></section>
        <section class="panel"><div class="panel-head"><h3>Recent audit trail</h3></div><div class="result-list">${auditEntries.map(item => `<article><strong>${escapeHtml(item.action)}</strong><p>${escapeHtml(item.entityType)} · ${new Date(item.createdAt).toLocaleString()}</p></article>`).join('') || '<div class="notice">No audit activity recorded yet.</div>'}</div></section>
      </div>`;

    root.querySelector('[data-invite-user-form]')?.addEventListener('submit', event => {
      event.preventDefault();
      try {
        inviteUser(Object.fromEntries(new FormData(event.currentTarget)));
        event.currentTarget.reset();
        renderEnterprise();
        window.dispatchEvent(new CustomEvent('agrismart:toast', { detail: { message: 'User invitation created.' } }));
      } catch (error) { alert(error.message); }
    });
  }

  function renderIdentityBadge() {
    const topActions = document.querySelector('.top-actions');
    if (!topActions || topActions.querySelector('[data-enterprise-identity]')) return;
    const user = getCurrentUser();
    const organization = getCurrentOrganization();
    const badge = document.createElement('button');
    badge.type = 'button'; badge.className = 'secondary-btn'; badge.dataset.enterpriseIdentity = '';
    badge.textContent = `${user?.firstName || 'User'} · ${organization?.code || 'ORG'}`;
    badge.title = `${roleLabels[user?.role] || user?.role} at ${organization?.name || ''}`;
    badge.addEventListener('click', showEnterpriseView);
    topActions.prepend(badge);
  }

  window.AgriSmartEnterprise = Object.freeze({
    roles: ROLE_PERMISSIONS, roleLabels, getOrganizations, getUsers, getSession, getCurrentUser,
    getCurrentOrganization, hasPermission, requirePermission, createOrganization, inviteUser,
    switchOrganization, audit, storage, scopedKey
  });

  addEnterpriseView();
  renderIdentityBadge();
  window.addEventListener('agrismart:organizationchange', () => { renderEnterprise(); renderIdentityBadge(); });
})();