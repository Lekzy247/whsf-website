(() => {
  'use strict';

  const FARM_KEY = 'agrismart-farms-v1';
  const ACTIVITY_KEY = 'agrismart-farm-activities-v1';
  const farmView = document.querySelector('[data-view-panel="farm"]');
  const form = document.querySelector('#farm-form');
  const list = document.querySelector('[data-farm-list]');
  if (!farmView || !form || !list) return;

  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));
  const today = () => new Date().toISOString().slice(0, 10);
  const read = (key, fallback = []) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return Array.isArray(value) ? value : fallback;
    } catch {
      return fallback;
    }
  };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));

  let editingId = null;
  let searchTerm = '';

  function toast(message, type = 'success') {
    let container = document.querySelector('.agrismart-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'agrismart-toast-container';
      Object.assign(container.style, { position: 'fixed', right: '18px', bottom: '84px', zIndex: '9999', display: 'grid', gap: '10px', maxWidth: '360px' });
      document.body.appendChild(container);
    }
    const item = document.createElement('div');
    item.setAttribute('role', 'status');
    item.textContent = message;
    Object.assign(item.style, { padding: '13px 16px', borderRadius: '12px', color: '#fff', background: type === 'error' ? '#a52a2a' : '#0d4d35', boxShadow: '0 12px 32px rgba(0,0,0,.2)', fontWeight: '700' });
    container.appendChild(item);
    setTimeout(() => item.remove(), 3200);
  }

  function normalizeFarm(farm) {
    return {
      id: farm.id || `farm-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: String(farm.name || farm.farmName || '').trim(),
      crop: String(farm.crop || '').trim(),
      size: Number(farm.size) || 0,
      location: String(farm.location || '').trim(),
      notes: String(farm.notes || '').trim(),
      status: String(farm.status || 'Active'),
      plantingDate: String(farm.plantingDate || ''),
      expectedHarvest: String(farm.expectedHarvest || ''),
      createdAt: farm.createdAt || new Date().toISOString(),
      updatedAt: farm.updatedAt || new Date().toISOString()
    };
  }

  function getFarms() {
    return read(FARM_KEY).map(normalizeFarm);
  }

  function saveFarms(farms) {
    write(FARM_KEY, farms);
    window.dispatchEvent(new CustomEvent('agrismart:farmchange', { detail: farms }));
  }

  function buildWorkspace() {
    if (farmView.querySelector('[data-farm-management-tools]')) return;

    const metrics = document.createElement('div');
    metrics.className = 'metric-grid';
    metrics.dataset.farmManagementTools = '';
    metrics.style.marginBottom = '18px';
    metrics.innerHTML = `
      <article class="metric-card"><span>Total farms</span><strong data-farm-count>0</strong><small>Registered operations</small></article>
      <article class="metric-card"><span>Total area</span><strong data-farm-area>0 ha</strong><small>Combined farm size</small></article>
      <article class="metric-card"><span>Active crops</span><strong data-farm-crops>0</strong><small>Unique crop types</small></article>
      <article class="metric-card"><span>Activities</span><strong data-farm-activities>0</strong><small>Recorded field actions</small></article>`;
    farmView.prepend(metrics);

    const searchPanel = document.createElement('section');
    searchPanel.className = 'panel';
    searchPanel.style.marginTop = '18px';
    searchPanel.innerHTML = `
      <div class="panel-head"><div><h3>Farm workspace</h3><p>Search, edit, export and manage field activities.</p></div><button class="secondary-btn" type="button" data-export-farms>Export CSV</button></div>
      <div class="form-grid">
        <label class="field full"><span>Search farms</span><input type="search" data-farm-search placeholder="Search by farm, crop or location"></label>
      </div>`;
    list.closest('.panel')?.insertAdjacentElement('beforebegin', searchPanel);

    const extraFields = `
      <label class="field"><span>Status</span><select name="status"><option>Active</option><option>Planning</option><option>Fallow</option><option>Completed</option></select></label>
      <label class="field"><span>Planting date</span><input name="plantingDate" type="date"></label>
      <label class="field"><span>Expected harvest</span><input name="expectedHarvest" type="date"></label>`;
    const notes = form.querySelector('[name="notes"]')?.closest('label');
    notes?.insertAdjacentHTML('beforebegin', extraFields);

    const submit = form.querySelector('button[type="submit"]');
    if (submit) {
      submit.dataset.farmSubmit = '';
      const cancel = document.createElement('button');
      cancel.className = 'secondary-btn';
      cancel.type = 'button';
      cancel.dataset.cancelFarmEdit = '';
      cancel.textContent = 'Cancel edit';
      cancel.hidden = true;
      submit.insertAdjacentElement('afterend', cancel);
    }

    const activityPanel = document.createElement('section');
    activityPanel.className = 'panel';
    activityPanel.style.marginTop = '18px';
    activityPanel.innerHTML = `
      <div class="panel-head"><div><h3>Field activity log</h3><p>Record planting, irrigation, fertilizer, spraying, inspection and harvest work.</p></div><span class="chip">Operations</span></div>
      <form class="form-grid" data-farm-activity-form>
        <label class="field"><span>Farm</span><select name="farmId" data-activity-farm required><option value="">Select farm</option></select></label>
        <label class="field"><span>Activity</span><select name="type" required><option>Planting</option><option>Irrigation</option><option>Fertilizer</option><option>Spraying</option><option>Inspection</option><option>Harvest</option><option>Other</option></select></label>
        <label class="field"><span>Date</span><input name="date" type="date" required value="${today()}"></label>
        <label class="field"><span>Cost</span><input name="cost" type="number" min="0" step="0.01" value="0"></label>
        <label class="field full"><span>Notes</span><input name="notes" placeholder="Work completed, inputs used or observations"></label>
        <button class="primary-btn" type="submit">Save activity</button>
      </form>
      <div class="order-list" data-farm-activity-list style="margin-top:18px"></div>`;
    farmView.appendChild(activityPanel);
  }

  function renderMetrics(farms) {
    const activities = read(ACTIVITY_KEY);
    const area = farms.reduce((sum, farm) => sum + (Number(farm.size) || 0), 0);
    const crops = new Set(farms.map(farm => farm.crop).filter(Boolean));
    const values = {
      '[data-farm-count]': farms.length,
      '[data-farm-area]': `${area.toFixed(area % 1 ? 1 : 0)} ha`,
      '[data-farm-crops]': crops.size,
      '[data-farm-activities]': activities.length
    };
    Object.entries(values).forEach(([selector, value]) => {
      const element = farmView.querySelector(selector);
      if (element) element.textContent = String(value);
    });
  }

  function renderFarmOptions(farms) {
    const select = farmView.querySelector('[data-activity-farm]');
    if (!select) return;
    const current = select.value;
    select.innerHTML = '<option value="">Select farm</option>' + farms.map(farm => `<option value="${escapeHtml(farm.id)}">${escapeHtml(farm.name)}</option>`).join('');
    if (farms.some(farm => farm.id === current)) select.value = current;
  }

  function renderFarms() {
    const farms = getFarms();
    const visible = farms.filter(farm => [farm.name, farm.crop, farm.location, farm.status].join(' ').toLowerCase().includes(searchTerm));
    renderMetrics(farms);
    renderFarmOptions(farms);

    list.innerHTML = visible.length ? visible.map(farm => `
      <div class="order-item" data-farm-id="${escapeHtml(farm.id)}">
        <div>
          <strong>${escapeHtml(farm.name)}</strong>
          <div>${escapeHtml(farm.crop)} · ${escapeHtml(farm.size)} hectares · ${escapeHtml(farm.location)}</div>
          <small>${escapeHtml(farm.status)}${farm.plantingDate ? ` · Planted ${escapeHtml(farm.plantingDate)}` : ''}${farm.expectedHarvest ? ` · Harvest ${escapeHtml(farm.expectedHarvest)}` : ''}</small>
        </div>
        <div>
          <span class="chip">${escapeHtml(farm.status)}</span>
          <button class="secondary-btn" type="button" data-edit-farm="${escapeHtml(farm.id)}">Edit</button>
          <button class="secondary-btn" type="button" data-remove-farm="${escapeHtml(farm.id)}">Remove</button>
        </div>
      </div>`).join('') : '<div class="notice">No farms match your search.</div>';
  }

  function renderActivities() {
    const farms = getFarms();
    const byId = new Map(farms.map(farm => [farm.id, farm]));
    const activities = read(ACTIVITY_KEY).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const target = farmView.querySelector('[data-farm-activity-list]');
    if (!target) return;
    target.innerHTML = activities.length ? activities.map(activity => `
      <div class="order-item">
        <div><strong>${escapeHtml(activity.type)} · ${escapeHtml(byId.get(activity.farmId)?.name || 'Removed farm')}</strong><div>${escapeHtml(activity.notes || 'No notes')} · ${escapeHtml(activity.date)}</div></div>
        <div><span class="chip">${Number(activity.cost || 0).toLocaleString()}</span><button class="secondary-btn" type="button" data-remove-activity="${escapeHtml(activity.id)}">Remove</button></div>
      </div>`).join('') : '<div class="notice">No farm activities recorded yet.</div>';
  }

  function resetForm() {
    editingId = null;
    form.reset();
    const submit = form.querySelector('[data-farm-submit]');
    if (submit) submit.textContent = 'Save farm';
    const cancel = form.querySelector('[data-cancel-farm-edit]');
    if (cancel) cancel.hidden = true;
  }

  function editFarm(id) {
    const farm = getFarms().find(item => String(item.id) === String(id));
    if (!farm) return;
    editingId = farm.id;
    form.elements.farmName.value = farm.name;
    form.elements.crop.value = farm.crop;
    form.elements.size.value = farm.size;
    form.elements.location.value = farm.location;
    form.elements.notes.value = farm.notes;
    if (form.elements.status) form.elements.status.value = farm.status;
    if (form.elements.plantingDate) form.elements.plantingDate.value = farm.plantingDate;
    if (form.elements.expectedHarvest) form.elements.expectedHarvest.value = farm.expectedHarvest;
    const submit = form.querySelector('[data-farm-submit]');
    if (submit) submit.textContent = 'Update farm';
    const cancel = form.querySelector('[data-cancel-farm-edit]');
    if (cancel) cancel.hidden = false;
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    const data = Object.fromEntries(new FormData(form));
    const farms = getFarms();
    const record = normalizeFarm({
      id: editingId || undefined,
      name: data.farmName,
      crop: data.crop,
      size: data.size,
      location: data.location,
      notes: data.notes,
      status: data.status,
      plantingDate: data.plantingDate,
      expectedHarvest: data.expectedHarvest,
      createdAt: editingId ? farms.find(item => item.id === editingId)?.createdAt : undefined,
      updatedAt: new Date().toISOString()
    });
    if (!record.name || !record.crop || !record.size || !record.location) {
      toast('Complete all required farm fields.', 'error');
      return;
    }
    const next = editingId ? farms.map(item => item.id === editingId ? record : item) : [...farms, record];
    saveFarms(next);
    toast(editingId ? 'Farm updated.' : 'Farm saved.');
    resetForm();
    renderFarms();
  }, true);

  farmView.addEventListener('submit', event => {
    const activityForm = event.target.closest('[data-farm-activity-form]');
    if (!activityForm) return;
    event.preventDefault();
    const data = Object.fromEntries(new FormData(activityForm));
    const activities = read(ACTIVITY_KEY);
    activities.push({ id: `activity-${Date.now()}`, farmId: data.farmId, type: data.type, date: data.date, cost: Number(data.cost) || 0, notes: String(data.notes || '').trim(), createdAt: new Date().toISOString() });
    write(ACTIVITY_KEY, activities);
    activityForm.reset();
    activityForm.elements.date.value = today();
    toast('Farm activity saved.');
    renderMetrics(getFarms());
    renderActivities();
  });

  farmView.addEventListener('click', event => {
    const edit = event.target.closest('[data-edit-farm]');
    if (edit) editFarm(edit.dataset.editFarm);

    const remove = event.target.closest('[data-remove-farm]');
    if (remove && confirm('Remove this farm and keep its historical activities?')) {
      saveFarms(getFarms().filter(farm => String(farm.id) !== remove.dataset.removeFarm));
      if (String(editingId) === remove.dataset.removeFarm) resetForm();
      renderFarms();
      renderActivities();
      toast('Farm removed.');
    }

    const removeActivity = event.target.closest('[data-remove-activity]');
    if (removeActivity && confirm('Remove this activity record?')) {
      write(ACTIVITY_KEY, read(ACTIVITY_KEY).filter(item => item.id !== removeActivity.dataset.removeActivity));
      renderMetrics(getFarms());
      renderActivities();
      toast('Activity removed.');
    }

    if (event.target.closest('[data-cancel-farm-edit]')) resetForm();
    if (event.target.closest('[data-export-farms]')) exportFarms();
  });

  farmView.querySelector('[data-farm-search]')?.addEventListener('input', event => {
    searchTerm = event.target.value.trim().toLowerCase();
    renderFarms();
  });

  function exportFarms() {
    const farms = getFarms();
    if (!farms.length) return toast('There are no farms to export.', 'error');
    const rows = [['Farm', 'Crop', 'Size (ha)', 'Location', 'Status', 'Planting date', 'Expected harvest', 'Notes'], ...farms.map(farm => [farm.name, farm.crop, farm.size, farm.location, farm.status, farm.plantingDate, farm.expectedHarvest, farm.notes])];
    const csv = rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `agrismart-farms-${today()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  buildWorkspace();
  renderFarms();
  renderActivities();
  window.addEventListener('agrismart:farmchange', event => {
    if (event.detail?.source !== 'cloud') return;
    renderFarms();
    renderActivities();
  });
})();
