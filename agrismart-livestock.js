(() => {
  'use strict';

  const HERD_KEY = 'agrismart-livestock-herds-v1';
  const HEALTH_KEY = 'agrismart-livestock-health-v1';
  const PRODUCTION_KEY = 'agrismart-livestock-production-v1';
  const SPECIES = Object.freeze(['Cattle', 'Goats', 'Poultry', 'Sheep', 'Pigs', 'Rabbits', 'Fish', 'Other']);

  const read = key => {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  };

  const write = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent('agrismart:livestockchange', { detail: { key } }));
  };

  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));

  const id = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const today = () => new Date().toISOString().slice(0, 10);
  const number = value => Math.max(0, Number(value) || 0);

  function addHerd(record) {
    const item = {
      id: id(),
      species: SPECIES.includes(record.species) ? record.species : 'Other',
      breed: String(record.breed || '').trim(),
      groupName: String(record.groupName || '').trim(),
      quantity: number(record.quantity),
      location: String(record.location || '').trim(),
      purpose: String(record.purpose || 'Mixed production').trim(),
      acquiredDate: record.acquiredDate || today(),
      createdAt: new Date().toISOString()
    };
    const records = read(HERD_KEY);
    records.push(item);
    write(HERD_KEY, records);
    return item;
  }

  function addHealthRecord(record) {
    const item = {
      id: id(),
      herdId: String(record.herdId || ''),
      eventType: String(record.eventType || 'Health check').trim(),
      treatment: String(record.treatment || '').trim(),
      veterinarian: String(record.veterinarian || '').trim(),
      date: record.date || today(),
      nextDueDate: record.nextDueDate || '',
      notes: String(record.notes || '').trim(),
      createdAt: new Date().toISOString()
    };
    const records = read(HEALTH_KEY);
    records.push(item);
    write(HEALTH_KEY, records);
    return item;
  }

  function addProduction(record) {
    const item = {
      id: id(),
      herdId: String(record.herdId || ''),
      product: String(record.product || '').trim(),
      quantity: number(record.quantity),
      unit: String(record.unit || 'kg').trim(),
      date: record.date || today(),
      notes: String(record.notes || '').trim(),
      createdAt: new Date().toISOString()
    };
    const records = read(PRODUCTION_KEY);
    records.push(item);
    write(PRODUCTION_KEY, records);
    return item;
  }

  function remove(key, recordId) {
    const records = read(key);
    const updated = records.filter(item => item.id !== recordId);
    if (updated.length === records.length) return false;
    write(key, updated);
    return true;
  }

  function summary() {
    const herds = read(HERD_KEY);
    const health = read(HEALTH_KEY);
    const production = read(PRODUCTION_KEY);
    const totalAnimals = herds.reduce((sum, item) => sum + number(item.quantity), 0);
    const species = herds.reduce((totals, item) => {
      totals[item.species] = (totals[item.species] || 0) + number(item.quantity);
      return totals;
    }, {});
    const upcomingCare = health.filter(item => item.nextDueDate && item.nextDueDate >= today()).sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate));
    return { herds, health, production, totalAnimals, species, upcomingCare };
  }

  function ensureView() {
    const main = document.querySelector('.app-main');
    const nav = document.querySelector('.app-nav');
    if (!main || !nav) return null;

    let panel = document.querySelector('[data-view-panel="livestock"]');
    if (!panel) {
      panel = document.createElement('section');
      panel.className = 'view';
      panel.dataset.viewPanel = 'livestock';
      panel.innerHTML = `
        <div class="section-heading"><p class="eyebrow">Animal agriculture</p><h2>Livestock farming</h2><p>Manage cattle, goats, poultry and other livestock that provide meat, milk, eggs and household income across Nigeria and Africa.</p></div>
        <div data-livestock-panel></div>`;
      const settingsPanel = document.querySelector('[data-view-panel="settings"]');
      main.insertBefore(panel, settingsPanel || null);
    }

    if (!nav.querySelector('[data-view="livestock"]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.view = 'livestock';
      button.textContent = '🐄 Livestock';
      const analyticsButton = nav.querySelector('[data-view="analytics"]');
      nav.insertBefore(button, analyticsButton || nav.querySelector('[data-view="settings"]') || null);
    }
    return panel.querySelector('[data-livestock-panel]');
  }

  function render() {
    const root = ensureView();
    if (!root) return;
    const data = summary();
    const herdOptions = data.herds.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.groupName || item.species)} — ${escapeHtml(item.species)}</option>`).join('');
    const speciesCards = Object.entries(data.species).map(([species, quantity]) => `<article><strong>${quantity}</strong><p>${escapeHtml(species)}</p></article>`).join('');

    root.innerHTML = `
      <div class="result-list">
        <article><strong>${data.totalAnimals}</strong><p>Total animals and birds</p></article>
        <article><strong>${data.herds.length}</strong><p>Herds and flocks</p></article>
        <article><strong>${data.health.length}</strong><p>Health records</p></article>
        <article><strong>${data.production.length}</strong><p>Production entries</p></article>
        ${speciesCards}
      </div>
      <div class="dashboard-grid" style="margin-top:18px">
        <section class="panel"><div class="panel-head"><div><h3>Register herd or flock</h3><p>Track livestock groups by species, breed, purpose and location.</p></div></div>
          <form class="form-grid" data-livestock-herd-form>
            <label class="field"><span>Species</span><select name="species">${SPECIES.map(item => `<option>${item}</option>`).join('')}</select></label>
            <label class="field"><span>Breed</span><input name="breed" placeholder="e.g. White Fulani, Red Sokoto, Broiler"></label>
            <label class="field"><span>Herd or flock name</span><input name="groupName" required></label>
            <label class="field"><span>Number of animals</span><input name="quantity" type="number" min="0" required></label>
            <label class="field"><span>Location</span><input name="location"></label>
            <label class="field"><span>Purpose</span><select name="purpose"><option>Mixed production</option><option>Meat</option><option>Milk</option><option>Eggs</option><option>Breeding</option><option>Draft power</option></select></label>
            <label class="field"><span>Acquired or established</span><input name="acquiredDate" type="date" value="${today()}"></label>
            <button class="primary-btn" type="submit">Save livestock group</button>
          </form>
        </section>
        <section class="panel"><div class="panel-head"><div><h3>Health and veterinary care</h3><p>Record vaccinations, treatments, checks and future care dates.</p></div></div>
          <form class="form-grid" data-livestock-health-form>
            <label class="field"><span>Herd or flock</span><select name="herdId" required><option value="">Select group</option>${herdOptions}</select></label>
            <label class="field"><span>Event</span><select name="eventType"><option>Vaccination</option><option>Health check</option><option>Treatment</option><option>Deworming</option><option>Breeding</option><option>Mortality</option></select></label>
            <label class="field"><span>Treatment or vaccine</span><input name="treatment"></label>
            <label class="field"><span>Veterinarian</span><input name="veterinarian"></label>
            <label class="field"><span>Date</span><input name="date" type="date" value="${today()}"></label>
            <label class="field"><span>Next due date</span><input name="nextDueDate" type="date"></label>
            <label class="field"><span>Notes</span><textarea name="notes"></textarea></label>
            <button class="primary-btn" type="submit">Save health record</button>
          </form>
        </section>
        <section class="panel"><div class="panel-head"><div><h3>Production records</h3><p>Capture milk, eggs, meat, liveweight and other outputs.</p></div></div>
          <form class="form-grid" data-livestock-production-form>
            <label class="field"><span>Herd or flock</span><select name="herdId" required><option value="">Select group</option>${herdOptions}</select></label>
            <label class="field"><span>Product</span><select name="product"><option>Milk</option><option>Eggs</option><option>Meat</option><option>Liveweight</option><option>Manure</option><option>Hides and skins</option><option>Other</option></select></label>
            <label class="field"><span>Quantity</span><input name="quantity" type="number" min="0" step="0.01" required></label>
            <label class="field"><span>Unit</span><select name="unit"><option>litres</option><option>eggs</option><option>kg</option><option>tonnes</option><option>animals</option><option>bags</option></select></label>
            <label class="field"><span>Date</span><input name="date" type="date" value="${today()}"></label>
            <label class="field"><span>Notes</span><textarea name="notes"></textarea></label>
            <button class="primary-btn" type="submit">Save production</button>
          </form>
        </section>
        <section class="panel"><div class="panel-head"><div><h3>Livestock register</h3><p>Current herds and flocks.</p></div></div><div class="result-list">${data.herds.length ? data.herds.map(item => `<article><strong>${escapeHtml(item.groupName || item.species)} · ${item.quantity}</strong><p>${escapeHtml(item.species)} · ${escapeHtml(item.breed || 'Breed not specified')} · ${escapeHtml(item.location || 'Location not specified')}</p><button class="secondary-btn" type="button" data-remove-herd="${escapeHtml(item.id)}">Remove</button></article>`).join('') : '<div class="notice">No livestock groups registered yet.</div>'}</div></section>
      </div>`;

    root.querySelector('[data-livestock-herd-form]')?.addEventListener('submit', event => {
      event.preventDefault();
      addHerd(Object.fromEntries(new FormData(event.currentTarget)));
      render();
    });
    root.querySelector('[data-livestock-health-form]')?.addEventListener('submit', event => {
      event.preventDefault();
      addHealthRecord(Object.fromEntries(new FormData(event.currentTarget)));
      render();
    });
    root.querySelector('[data-livestock-production-form]')?.addEventListener('submit', event => {
      event.preventDefault();
      addProduction(Object.fromEntries(new FormData(event.currentTarget)));
      render();
    });
    root.querySelectorAll('[data-remove-herd]').forEach(button => button.addEventListener('click', () => {
      remove(HERD_KEY, button.dataset.removeHerd);
      render();
    }));
  }

  window.AgriSmartLivestock = Object.freeze({
    species: SPECIES,
    addHerd,
    addHealthRecord,
    addProduction,
    getHerds: () => read(HERD_KEY),
    getHealthRecords: () => read(HEALTH_KEY),
    getProduction: () => read(PRODUCTION_KEY),
    getSummary: summary
  });

  render();
  window.addEventListener('agrismart:livestockchange', () => queueMicrotask(render));
  window.addEventListener('agrismart:extendedmodulesready', () => queueMicrotask(render));
})();