(() => {
  'use strict';

  const KEY = 'agrismart-administration-v1';
  const AUDIT_KEY = 'agrismart-audit-log-v1';
  const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const defaults = () => ({
    organization: { name: 'World Humanitarian Support Foundation', code: 'WHSF', country: 'Nigeria' },
    roles: [
      { id: 'role-admin', name: 'Administrator', permissions: ['all'] },
      { id: 'role-manager', name: 'Manager', permissions: ['dashboard','farm','finance','inventory','procurement','warehouse','analytics'] },
      { id: 'role-user', name: 'Standard User', permissions: ['dashboard','farm','finance','inventory','advisor','academy'] }
    ],
    users: [],
    policies: { sessionTimeout: 30, requireApproval: true, auditEnabled: true }
  });
  const read = () => { try { return { ...defaults(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return defaults(); } };
  const save = data => { localStorage.setItem(KEY, JSON.stringify(data)); window.dispatchEvent(new CustomEvent('agrismart:administrationchange')); return data; };
  const audit = (action, detail = '') => {
    const items = (() => { try { return JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]'); } catch { return []; } })();
    items.unshift({ id: uid('audit'), action, detail, createdAt: new Date().toISOString() });
    localStorage.setItem(AUDIT_KEY, JSON.stringify(items.slice(0, 500)));
    window.dispatchEvent(new CustomEvent('agrismart:auditchange'));
  };

  function addUser(input) {
    const data = read();
    const user = { id: uid('user'), name: String(input.name || '').trim(), email: String(input.email || '').trim().toLowerCase(), roleId: String(input.roleId || 'role-user'), department: String(input.department || '').trim(), status: 'Active', createdAt: new Date().toISOString() };
    if (!user.name || !user.email) throw new Error('Name and email are required.');
    if (data.users.some(item => item.email === user.email)) throw new Error('A user with this email already exists.');
    data.users.push(user); save(data); audit('User created', `${user.name} (${user.email})`); return user;
  }

  function toggleUser(id) {
    const data = read();
    const user = data.users.find(item => item.id === id);
    if (!user) throw new Error('User not found.');
    user.status = user.status === 'Active' ? 'Inactive' : 'Active';
    save(data); audit('User status changed', `${user.email}: ${user.status}`); return user;
  }

  function addRole(input) {
    const data = read();
    const role = { id: uid('role'), name: String(input.name || '').trim(), permissions: String(input.permissions || '').split(',').map(item => item.trim()).filter(Boolean) };
    if (!role.name) throw new Error('Role name is required.');
    data.roles.push(role); save(data); audit('Role created', role.name); return role;
  }

  function updateOrganization(input) {
    const data = read();
    data.organization = { ...data.organization, name: String(input.name || '').trim(), code: String(input.code || '').trim().toUpperCase(), country: String(input.country || '').trim() };
    save(data); audit('Organization updated', data.organization.name); return data.organization;
  }

  function updatePolicies(input) {
    const data = read();
    data.policies = { sessionTimeout: Math.max(5, Number(input.sessionTimeout || 30)), requireApproval: input.requireApproval === 'on', auditEnabled: input.auditEnabled === 'on' };
    save(data); audit('Security policies updated', `Timeout ${data.policies.sessionTimeout} minutes`); return data.policies;
  }

  function ensurePanel() {
    const main = document.querySelector('.app-main');
    if (!main) return null;
    let view = document.querySelector('[data-view-panel="administration"]');
    if (!view) {
      view = document.createElement('section'); view.className = 'view'; view.dataset.viewPanel = 'administration';
      view.innerHTML = '<div class="section-heading"><p class="eyebrow">Enterprise control</p><h2>Administration</h2><p>Manage users, roles, organization settings, security policies and audit activity.</p></div><div data-administration-panel></div>';
      main.insertBefore(view, document.querySelector('[data-view-panel="settings"]'));
    }
    const nav = document.querySelector('.app-nav');
    if (nav && !nav.querySelector('[data-view="administration"]')) {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.view = 'administration'; button.textContent = '⚙ Administration';
      nav.insertBefore(button, nav.querySelector('[data-view="settings"]'));
    }
    return view.querySelector('[data-administration-panel]');
  }

  function render() {
    const root = ensurePanel(); if (!root) return;
    const data = read();
    const logs = (() => { try { return JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]'); } catch { return []; } })();
    const roleOptions = data.roles.map(role => `<option value="${esc(role.id)}">${esc(role.name)}</option>`).join('');
    root.innerHTML = `
      <div class="metric-grid">
        <article class="metric-card"><span>Users</span><strong>${data.users.length}</strong><small>${data.users.filter(item => item.status === 'Active').length} active</small></article>
        <article class="metric-card"><span>Roles</span><strong>${data.roles.length}</strong><small>Permission profiles</small></article>
        <article class="metric-card"><span>Audit events</span><strong>${logs.length}</strong><small>Recorded actions</small></article>
        <article class="metric-card"><span>Session timeout</span><strong>${data.policies.sessionTimeout} min</strong><small>Security policy</small></article>
      </div>
      <div class="dashboard-grid" style="margin-top:18px">
        <section class="panel"><div class="panel-head"><h3>Add user</h3></div><form class="form-grid" data-admin-user-form><label class="field"><span>Name</span><input name="name" required></label><label class="field"><span>Email</span><input name="email" type="email" required></label><label class="field"><span>Role</span><select name="roleId">${roleOptions}</select></label><label class="field"><span>Department</span><input name="department"></label><button class="primary-btn" type="submit">Create user</button></form></section>
        <section class="panel"><div class="panel-head"><h3>Organization</h3></div><form class="form-grid" data-admin-org-form><label class="field full"><span>Name</span><input name="name" value="${esc(data.organization.name)}" required></label><label class="field"><span>Code</span><input name="code" value="${esc(data.organization.code)}"></label><label class="field"><span>Country</span><input name="country" value="${esc(data.organization.country)}"></label><button class="primary-btn" type="submit">Save organization</button></form></section>
      </div>
      <div class="dashboard-grid" style="margin-top:18px">
        <section class="panel"><div class="panel-head"><h3>Create role</h3></div><form class="form-grid" data-admin-role-form><label class="field"><span>Role name</span><input name="name" required></label><label class="field full"><span>Permissions</span><input name="permissions" placeholder="dashboard, finance, inventory"></label><button class="primary-btn" type="submit">Create role</button></form></section>
        <section class="panel"><div class="panel-head"><h3>Security policies</h3></div><form class="form-grid" data-admin-policy-form><label class="field"><span>Session timeout (minutes)</span><input name="sessionTimeout" type="number" min="5" value="${esc(data.policies.sessionTimeout)}"></label><label class="field"><span><input name="requireApproval" type="checkbox" ${data.policies.requireApproval ? 'checked' : ''}> Require approvals</span></label><label class="field"><span><input name="auditEnabled" type="checkbox" ${data.policies.auditEnabled ? 'checked' : ''}> Enable audit log</span></label><button class="primary-btn" type="submit">Save policies</button></form></section>
      </div>
      <section class="panel" style="margin-top:18px"><div class="panel-head"><h3>Users</h3></div><div class="result-list">${data.users.length ? data.users.map(user => `<article><strong>${esc(user.name)}</strong><p>${esc(user.email)} · ${esc(data.roles.find(role => role.id === user.roleId)?.name || 'Unknown role')} · ${esc(user.department || 'No department')} · ${esc(user.status)}</p><button class="secondary-btn" data-toggle-user="${esc(user.id)}">${user.status === 'Active' ? 'Deactivate' : 'Activate'}</button></article>`).join('') : '<div class="notice">No users created yet.</div>'}</div></section>
      <section class="panel" style="margin-top:18px"><div class="panel-head"><h3>Audit log</h3></div><div class="result-list">${logs.length ? logs.slice(0, 25).map(item => `<article><strong>${esc(item.action)}</strong><p>${esc(item.detail)} · ${esc(new Date(item.createdAt).toLocaleString())}</p></article>`).join('') : '<div class="notice">No audit events recorded.</div>'}</div></section>`;

    const bind = (selector, handler) => root.querySelector(selector)?.addEventListener('submit', event => { event.preventDefault(); try { handler(Object.fromEntries(new FormData(event.currentTarget))); event.currentTarget.reset(); render(); } catch (error) { alert(error.message); } });
    bind('[data-admin-user-form]', addUser); bind('[data-admin-role-form]', addRole); bind('[data-admin-org-form]', updateOrganization); bind('[data-admin-policy-form]', updatePolicies);
    root.querySelectorAll('[data-toggle-user]').forEach(button => button.addEventListener('click', () => { toggleUser(button.dataset.toggleUser); render(); }));
  }

  window.AgriSmartAdministration = Object.freeze({ read, addUser, toggleUser, addRole, updateOrganization, updatePolicies, audit });
  ['agrismart:administrationchange','agrismart:auditchange','agrismart:extendedmodulesready'].forEach(name => window.addEventListener(name, () => queueMicrotask(render)));
  render();
})();