(() => {
  'use strict';

  const KEY = 'agrismart-approvals-v1';
  const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const read = () => {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch { return []; }
  };
  const save = items => {
    localStorage.setItem(KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('agrismart:approvalchange'));
    return items;
  };

  function submit(input) {
    const items = read();
    const item = {
      id: uid('approval'),
      module: String(input.module || 'General'),
      reference: String(input.reference || '').trim(),
      title: String(input.title || '').trim(),
      amount: Number(input.amount || 0),
      requester: String(input.requester || '').trim(),
      priority: String(input.priority || 'Normal'),
      status: 'Pending',
      comments: [],
      createdAt: new Date().toISOString()
    };
    if (!item.title) throw new Error('Approval title is required.');
    items.unshift(item); save(items); return item;
  }

  function act(id, action, comment = '') {
    const items = read();
    const item = items.find(entry => entry.id === id);
    if (!item) throw new Error('Approval request not found.');
    item.status = action;
    item.updatedAt = new Date().toISOString();
    if (comment) item.comments.push({ text: comment, createdAt: item.updatedAt });
    save(items); return item;
  }

  function importProcurement() {
    const existing = read();
    const known = new Set(existing.map(item => item.reference));
    let added = 0;
    try {
      const data = window.AgriSmartProcurement?.read?.();
      (data?.requisitions || []).filter(item => item.status === 'Pending Approval').forEach(req => {
        if (known.has(req.number)) return;
        existing.push({
          id: uid('approval'), module: 'Procurement', reference: req.number,
          title: `Purchase requisition: ${req.itemName}`, amount: Number(req.estimatedTotal || 0),
          requester: req.department || 'Procurement', priority: 'Normal', status: 'Pending',
          comments: [], createdAt: req.createdAt || new Date().toISOString(), sourceId: req.id
        });
        known.add(req.number); added += 1;
      });
      if (added) save(existing);
    } catch (error) {
      console.warn('Approval import skipped.', error);
    }
    return added;
  }

  function ensurePanel() {
    const main = document.querySelector('.app-main');
    if (!main) return null;
    let view = document.querySelector('[data-view-panel="approvals"]');
    if (!view) {
      view = document.createElement('section');
      view.className = 'view';
      view.dataset.viewPanel = 'approvals';
      view.innerHTML = '<div class="section-heading"><p class="eyebrow">Enterprise workflow</p><h2>Approval Center</h2><p>Review and manage requests requiring authorization.</p></div><div data-approval-panel></div>';
      main.insertBefore(view, document.querySelector('[data-view-panel="settings"]'));
    }
    const nav = document.querySelector('.app-nav');
    if (nav && !nav.querySelector('[data-view="approvals"]')) {
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.view = 'approvals'; button.textContent = '✓ Approvals';
      nav.insertBefore(button, nav.querySelector('[data-view="settings"]'));
    }
    return view.querySelector('[data-approval-panel]');
  }

  function render() {
    const root = ensurePanel(); if (!root) return;
    importProcurement();
    const items = read();
    const pending = items.filter(item => item.status === 'Pending');
    const approved = items.filter(item => item.status === 'Approved').length;
    const rejected = items.filter(item => item.status === 'Rejected').length;
    const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));

    root.innerHTML = `
      <div class="metric-grid">
        <article class="metric-card"><span>Pending</span><strong>${pending.length}</strong><small>Awaiting review</small></article>
        <article class="metric-card"><span>Approved</span><strong>${approved}</strong><small>Completed approvals</small></article>
        <article class="metric-card"><span>Rejected</span><strong>${rejected}</strong><small>Declined requests</small></article>
        <article class="metric-card"><span>Pending value</span><strong>${money(pending.reduce((sum, item) => sum + Number(item.amount || 0), 0))}</strong><small>Open authorization value</small></article>
      </div>
      <section class="panel" style="margin-top:18px">
        <div class="panel-head"><h3>Create approval request</h3></div>
        <form class="form-grid" data-approval-form>
          <label class="field"><span>Module</span><select name="module"><option>Procurement</option><option>Finance</option><option>Inventory</option><option>Farm</option><option>Administration</option><option>General</option></select></label>
          <label class="field"><span>Reference</span><input name="reference"></label>
          <label class="field full"><span>Title</span><input name="title" required></label>
          <label class="field"><span>Amount</span><input name="amount" type="number" min="0" step="0.01"></label>
          <label class="field"><span>Requester</span><input name="requester"></label>
          <label class="field"><span>Priority</span><select name="priority"><option>Low</option><option selected>Normal</option><option>High</option><option>Critical</option></select></label>
          <button class="primary-btn" type="submit">Submit request</button>
        </form>
      </section>
      <section class="panel" style="margin-top:18px"><div class="panel-head"><h3>Approval queue</h3></div><div class="result-list">
        ${items.length ? items.map(item => `<article><strong>${esc(item.title)}</strong><p>${esc(item.module)} · ${esc(item.reference || 'No reference')} · ${money(item.amount)} · ${esc(item.priority)} · ${esc(item.status)}</p>${item.status === 'Pending' ? `<button class="primary-btn" data-approve-id="${esc(item.id)}">Approve</button> <button class="secondary-btn" data-reject-id="${esc(item.id)}">Reject</button> <button class="secondary-btn" data-return-id="${esc(item.id)}">Return</button>` : ''}</article>`).join('') : '<div class="notice">No approval requests.</div>'}
      </div></section>`;

    root.querySelector('[data-approval-form]')?.addEventListener('submit', event => {
      event.preventDefault();
      try { submit(Object.fromEntries(new FormData(event.currentTarget))); event.currentTarget.reset(); }
      catch (error) { alert(error.message); }
    });
    root.querySelectorAll('[data-approve-id]').forEach(button => button.addEventListener('click', () => act(button.dataset.approveId, 'Approved', prompt('Approval comment (optional):', '') || '')));
    root.querySelectorAll('[data-reject-id]').forEach(button => button.addEventListener('click', () => act(button.dataset.rejectId, 'Rejected', prompt('Rejection reason:', '') || '')));
    root.querySelectorAll('[data-return-id]').forEach(button => button.addEventListener('click', () => act(button.dataset.returnId, 'Returned', prompt('Revision requested:', '') || '')));
  }

  window.AgriSmartApprovals = Object.freeze({ read, submit, act, importProcurement });
  window.addEventListener('agrismart:approvalchange', () => queueMicrotask(render));
  window.addEventListener('agrismart:procurementchange', () => queueMicrotask(render));
  window.addEventListener('agrismart:modulesready', () => queueMicrotask(render));
  render();
})();