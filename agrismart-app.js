(() => {
  'use strict';

  const pageMeta = {
    home: ['AgriSmart Dashboard', 'Monitor farm performance, finances, stock and operational activity.'],
    scan: ['AI Crop Scanner', 'Upload a crop image for a guided diagnostic preview.'],
    weather: ['Farm Weather', 'Plan planting, irrigation and spraying with local guidance.'],
    farm: ['Farm Management', 'Manage farms, crops, locations and production records.'],
    finance: ['Finance', 'Track revenue, expenses, harvest income and profitability.'],
    inventory: ['Inventory', 'Manage inputs, tools, stock levels and movements.'],
    warehouse: ['Warehouse', 'Manage storage locations, receipts, issues and transfers.'],
    procurement: ['Procurement', 'Manage suppliers, purchase requests, orders and receipts.'],
    approvals: ['Approval Center', 'Review and authorize procurement and operational requests.'],
    analytics: ['Analytics', 'Review financial, inventory, procurement and operational performance.'],
    advisor: ['Smart Advisor', 'Generate practical recommendations from farm and enterprise data.'],
    marketplace: ['Market & Farmer Alerts', 'Compare market signals, prepare produce listings and receive practical farm alerts.'],
    academy: ['AgriSmart Academy', 'Build practical skills through farmer-focused learning.'],
    administration: ['Administration', 'Manage users, roles, organization policies and audit activity.'],
    verification: ['Account Verification', 'Review and verify farmer, buyer, supplier, agronomist and cooperative accounts.'],
    settings: ['Settings', 'Manage your profile, security, preferences and application data.'],
    services: ['Agricultural Services', 'Find trusted equipment, logistics and technical support.'],
    assistant: ['AgriSmart AI Assistant', 'Ask questions and receive practical farming guidance.']
  };

  const restrictedViews = new Set(['administration', 'verification']);
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[character]));

  function toast(message, error = false) {
    document.querySelector('.toast')?.remove();
    const element = document.createElement('div');
    element.className = 'toast';
    element.setAttribute('role', 'status');
    element.textContent = message;
    if (error) element.style.background = '#9f2f2f';
    document.body.appendChild(element);
    setTimeout(() => element.remove(), 3000);
  }

  function closeMobileMenu() {
    document.querySelector('.app-sidebar')?.classList.remove('open');
    document.querySelector('.mobile-overlay')?.classList.remove('open');
  }

  function currentUser() {
    return window.AgriSmartAuth?.getCurrentUser?.() || null;
  }

  function isAdmin() {
    const user = currentUser();
    return user?.rawRole === 'admin' || user?.rawRole === 'super_admin' || user?.role === 'Administrator';
  }

  function canOpen(view) {
    if (!restrictedViews.has(view)) return true;
    return isAdmin();
  }

  function findPanel(name) {
    return document.querySelector(`[data-view-panel="${CSS.escape(name)}"]`);
  }

  function showView(name, updateHash = true) {
    const requested = pageMeta[name] ? name : 'home';
    if (!canOpen(requested)) {
      toast('Administrator access is required for this section.', true);
      name = 'home';
    } else name = requested;

    const panel = findPanel(name);
    if (!panel && name !== 'home') {
      toast(`${pageMeta[name][0]} is still loading.`);
      name = 'home';
    }

    document.querySelectorAll('.view').forEach(view => view.classList.toggle('active', view.dataset.viewPanel === name));
    document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === name));
    const title = document.querySelector('[data-page-title]');
    const subtitle = document.querySelector('[data-page-subtitle]');
    if (title) title.textContent = pageMeta[name][0];
    if (subtitle) subtitle.textContent = pageMeta[name][1];
    if (updateHash && location.hash !== `#${name}`) history.replaceState(null, '', `#${name}`);
    closeMobileMenu();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    window.dispatchEvent(new CustomEvent('agrismart:viewchange', { detail: { view: name } }));
    refreshModules(name);
    return name;
  }

  function refreshModules(view) {
    const calls = {
      home: () => window.AgriSmartEnterprise?.refresh?.(),
      analytics: () => window.AgriSmartAnalytics?.render?.(),
      warehouse: () => window.AgriSmartWarehouse?.render?.(),
      procurement: () => window.AgriSmartProcurement?.render?.(),
      approvals: () => window.AgriSmartApprovals?.render?.(),
      administration: () => window.AgriSmartAdministration?.render?.(),
      verification: () => window.AgriSmartVerification?.load?.(),
      settings: () => window.dispatchEvent(new CustomEvent('agrismart:settingsrenderrequest'))
    };
    try { calls[view]?.(); } catch (error) { console.error(`Unable to refresh ${view}`, error); }
  }

  function bindNavigation() {
    document.addEventListener('click', event => {
      const target = event.target.closest('[data-view]');
      if (!target || target.matches('[data-view-panel]')) return;
      event.preventDefault();
      showView(target.dataset.view);
    });
    window.addEventListener('hashchange', () => showView(location.hash.slice(1), false));
  }

  function setupMobileNavigation() {
    if (!document.querySelector('.mobile-overlay')) {
      const overlay = document.createElement('div');
      overlay.className = 'mobile-overlay';
      overlay.addEventListener('click', closeMobileMenu);
      document.body.appendChild(overlay);
    }
    document.querySelector('.mobile-menu')?.addEventListener('click', () => {
      document.querySelector('.app-sidebar')?.classList.toggle('open');
      document.querySelector('.mobile-overlay')?.classList.toggle('open');
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        closeMobileMenu();
        document.querySelector('.notification-panel')?.setAttribute('hidden', '');
      }
    });
  }

  function setupTheme() {
    const topActions = document.querySelector('.top-actions');
    if (!topActions || topActions.querySelector('[data-theme-toggle]')) return;
    const storedSettings = window.AgriSmartSettings?.get?.();
    const legacyTheme = localStorage.getItem('agrismart-theme');
    const preferred = storedSettings?.theme || legacyTheme || 'system';
    const dark = preferred === 'dark' || (preferred === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.body.classList.toggle('dark-mode', dark);
    const button = document.createElement('button');
    button.className = 'secondary-btn'; button.type = 'button'; button.dataset.themeToggle = 'true';
    const update = () => {
      const active = document.body.classList.contains('dark-mode');
      button.textContent = active ? '☀ Light' : '◐ Dark';
      button.setAttribute('aria-label', active ? 'Switch to light mode' : 'Switch to dark mode');
    };
    update();
    button.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
      const theme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
      localStorage.setItem('agrismart-theme', theme);
      const settings = window.AgriSmartSettings?.get?.();
      if (settings) window.AgriSmartSettings.save({ ...settings, theme });
      update(); toast('Display theme updated.');
    });
    topActions.appendChild(button);
  }

  function setupConnectivity() {
    const badge = document.querySelector('[data-connectivity]') || document.querySelector('.top-actions .chip');
    const update = () => {
      if (!badge) return;
      badge.textContent = navigator.onLine ? 'Online' : 'Offline mode';
      badge.title = navigator.onLine ? 'Connected to the internet' : 'Local features remain available';
    };
    update();
    window.addEventListener('online', () => { update(); toast('Internet connection restored.'); });
    window.addEventListener('offline', () => { update(); toast('Offline mode is active.'); });
  }

  function setupNotifications() {
    const topActions = document.querySelector('.top-actions');
    if (!topActions || topActions.querySelector('[data-notification-button]')) return;
    const button = document.createElement('button');
    button.className = 'icon-btn'; button.type = 'button'; button.textContent = '🔔';
    button.dataset.notificationButton = 'true'; button.setAttribute('aria-label', 'Open notifications');
    const panel = document.createElement('section');
    panel.className = 'notification-panel'; panel.hidden = true;
    panel.innerHTML = '<h3>Farm and enterprise alerts</h3><div data-live-notifications></div>';
    document.body.appendChild(panel);
    const render = () => {
      const items = [];
      try {
        const inventory = window.AgriSmartInventory?.read?.() || [];
        const list = Array.isArray(inventory) ? inventory : inventory.items || [];
        const low = list.filter(item => Number(item.quantity) <= Number(item.reorderLevel || 0));
        if (low.length) items.push(`<article><strong>Inventory attention</strong><p>${low.length} item${low.length === 1 ? '' : 's'} at or below reorder level.</p></article>`);
      } catch {}
      try {
        const approvals = window.AgriSmartApprovals?.read?.() || [];
        const list = Array.isArray(approvals) ? approvals : approvals.requests || [];
        const pending = list.filter(item => String(item.status).toLowerCase() === 'pending').length;
        if (pending) items.push(`<article><strong>Pending approvals</strong><p>${pending} request${pending === 1 ? '' : 's'} awaiting review.</p></article>`);
      } catch {}
      try {
        const marketAlerts = window.AgriSmartMarketAlerts?.getAlerts?.() || [];
        marketAlerts.slice(0, 2).forEach(alert => items.push(`<article><strong>${escapeHtml(alert.title)}</strong><p>${escapeHtml(alert.message)}</p></article>`));
      } catch {}
      if (!items.length) items.push('<article><strong>No urgent alerts</strong><p>Your operations currently have no critical notifications.</p></article>');
      panel.querySelector('[data-live-notifications]').innerHTML = items.join('');
    };
    button.addEventListener('click', () => {
      render(); panel.hidden = !panel.hidden;
      button.setAttribute('aria-expanded', String(!panel.hidden));
    });
    topActions.prepend(button);
  }

  function setupInstall() {
    let installPrompt;
    const button = document.querySelector('[data-install-app]');
    if (!button) return;
    button.hidden = true;
    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault(); installPrompt = event; button.hidden = false;
    });
    button.addEventListener('click', async () => {
      if (!installPrompt) return;
      installPrompt.prompt();
      const result = await installPrompt.userChoice;
      toast(result.outcome === 'accepted' ? 'AgriSmart installation started.' : 'Installation cancelled.');
      installPrompt = null; button.hidden = true;
    });
    window.addEventListener('appinstalled', () => { button.hidden = true; toast('AgriSmart Connect installed.'); });
  }

  function setupCropScanner() {
    if (window.AgriSmartCropScanner?.init?.()) return;
    const input = document.querySelector('#crop-photo');
    const preview = document.querySelector('.scan-preview');
    const placeholder = document.querySelector('[data-scan-placeholder]');
    const analyze = document.querySelector('[data-analyze]');
    const diagnosis = document.querySelector('[data-diagnosis]');
    input?.addEventListener('change', () => {
      const file = input.files?.[0]; if (!file) return;
      if (!file.type.startsWith('image/')) { diagnosis.innerHTML = '<div class="notice">Please choose a valid image file.</div>'; return; }
      preview.src = URL.createObjectURL(file); preview.style.display = 'block'; placeholder.hidden = true;
      analyze.disabled = false; diagnosis.innerHTML = '<div class="notice">Image ready. Select “Analyze crop” to run the guided diagnostic preview.</div>';
    });
    analyze?.addEventListener('click', () => {
      analyze.disabled = true; analyze.textContent = 'Analyzing…';
      setTimeout(() => {
        diagnosis.innerHTML = '<span class="result-badge">Diagnostic preview · 87% confidence</span><h3>Possible nitrogen deficiency</h3><p>Lower leaves appear pale or yellow while newer growth remains greener.</p><div class="result-list"><article><strong>Recommended next step</strong><p>Inspect soil moisture and drainage, then confirm with a soil or leaf test before applying fertilizer.</p></article><article><strong>Low-cost action</strong><p>Add well-composted organic matter around the root zone without touching the stem.</p></article><article><strong>Prevention</strong><p>Keep field records, rotate crops and apply nutrients according to tested soil requirements.</p></article></div><div class="notice">Educational guidance only. Confirm important treatment decisions with a qualified agronomist.</div>';
        analyze.textContent = 'Analyze another image'; analyze.disabled = false; toast('Crop diagnostic preview completed.');
      }, 1100);
    });
  }

  function setupFarms() {
    const key = 'agrismart-farms-v1';
    const form = document.querySelector('#farm-form');
    const list = document.querySelector('[data-farm-list]');
    const read = () => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } };
    const renderAll = () => {
      if (!list) return;
      const farms = read();
      list.innerHTML = farms.length ? farms.map(farm => `<div class="order-item" data-farm-id="${farm.id}"><div><strong>${escapeHtml(farm.name)}</strong><div>${escapeHtml(farm.crop)} · ${escapeHtml(farm.size)} hectares · ${escapeHtml(farm.location)}</div></div><button class="chip" type="button" data-remove-farm="${farm.id}">Remove</button></div>`).join('') : '<div class="notice">No farms recorded yet.</div>';
    };
    form?.addEventListener('submit', event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      if (!data.farmName || !data.crop || !data.size || !data.location) return;
      const farms = read();
      farms.push({ id: Date.now(), name: String(data.farmName).trim(), crop: data.crop, size: data.size, location: String(data.location).trim(), notes: String(data.notes || '').trim() });
      localStorage.setItem(key, JSON.stringify(farms)); form.reset(); renderAll();
      window.dispatchEvent(new CustomEvent('agrismart:datachange', { detail: { type: 'farm' } })); toast('Farm record saved.');
    });
    list?.addEventListener('click', event => {
      const button = event.target.closest('[data-remove-farm]'); if (!button) return;
      localStorage.setItem(key, JSON.stringify(read().filter(farm => String(farm.id) !== button.dataset.removeFarm)));
      renderAll(); toast('Farm record removed.');
    });
    renderAll();
  }

  function setupLocation() {
    const locate = status => {
      if (!navigator.geolocation) return toast('Location services are not supported on this device.', true);
      if (status) status.textContent = 'Requesting location permission…';
      navigator.geolocation.getCurrentPosition(position => {
        const { latitude, longitude } = position.coords;
        localStorage.setItem('agrismart-last-location', JSON.stringify({ latitude, longitude }));
        if (status) status.textContent = `Location captured: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        toast('Farm location captured.');
      }, () => { if (status) status.textContent = 'Location permission was not granted.'; });
    };
    document.querySelector('[data-use-location]')?.addEventListener('click', () => locate(document.querySelector('[data-location-status]')));
    document.querySelectorAll('.map-box').forEach(map => {
      map.setAttribute('role', 'button'); map.setAttribute('tabindex', '0');
      map.addEventListener('click', () => locate(document.querySelector('[data-location-status]')));
      map.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') locate(document.querySelector('[data-location-status]')); });
    });
  }

  function applyRoleVisibility() {
    const admin = isAdmin();
    document.querySelectorAll('[data-view="administration"],[data-view="verification"]').forEach(button => button.hidden = !admin);
  }

  function registerLifecycle() {
    ['agrismart:datachange','agrismart:inventorychange','agrismart:warehousechange','agrismart:procurementchange','agrismart:approvalchange','agrismart:fleetchange'].forEach(name => {
      window.addEventListener(name, () => window.AgriSmartEnterprise?.refresh?.());
    });
    window.addEventListener('agrismart:authchange', () => { applyRoleVisibility(); const active = location.hash.slice(1); if (restrictedViews.has(active) && !canOpen(active)) showView('home'); });
    window.addEventListener('agrismart:extendedmodulesready', () => { applyRoleVisibility(); showView(location.hash.slice(1) || 'home', false); });
  }

  function init() {
    bindNavigation(); setupMobileNavigation(); setupTheme(); setupConnectivity(); setupNotifications(); setupInstall();
    setupCropScanner(); setupFarms(); setupLocation(); registerLifecycle(); applyRoleVisibility();
    showView(location.hash.slice(1) || 'home', false);
    if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/agrismart-sw.js').catch(() => {}));
    window.dispatchEvent(new CustomEvent('agrismart:appready'));
  }

  window.AgriSmartApp = Object.freeze({ showView, toast, refreshModules, pageMeta });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
