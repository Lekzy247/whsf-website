(() => {
  'use strict';

  const pageMeta = {
    home: ['AgriSmart Dashboard', 'Manage farm operations and make informed decisions.'],
    scan: ['AI Crop Scanner', 'Upload a crop image for guided diagnostic support.'],
    farm: ['Farms', 'Manage farm records, fields and production activities.'],
    finance: ['Finance', 'Record expenses, harvest revenue and farm performance.'],
    inventory: ['Inventory', 'Manage stock levels, movements and reorder alerts.'],
    advisor: ['Smart Advisor', 'Generate practical recommendations from current farm conditions.'],
    marketplace: ['Marketplace', 'Request quotes and connect with agricultural suppliers and buyers.'],
    academy: ['AgriSmart Academy', 'Access practical agriculture and digital skills learning.'],
    analytics: ['Analytics', 'Review farm, finance, inventory and operational reports.'],
    warehouse: ['Warehouse', 'Manage facilities, batches, transfers, receipts and stock issues.'],
    procurement: ['Procurement', 'Manage suppliers, requisitions, purchase orders and goods receipts.'],
    approvals: ['Approval Center', 'Review enterprise requests requiring authorization.'],
    settings: ['Settings', 'Configure regional, measurement and application preferences.']
  };

  const enterpriseModules = [
    '/agrismart-farm-management.js',
    '/agrismart-marketplace-ui.js',
    '/agrismart-executive-dashboard.js',
    '/agrismart-procurement.js',
    '/agrismart-warehouse.js',
    '/agrismart-approval-center.js'
  ];

  function toast(message) {
    document.querySelector('.toast')?.remove();
    const node = document.createElement('div');
    node.className = 'toast';
    node.setAttribute('role', 'status');
    node.textContent = message;
    document.body.appendChild(node);
    setTimeout(() => node.remove(), 2800);
  }

  function ensureNavigationItems() {
    const nav = document.querySelector('.app-nav');
    if (!nav) return;
    const settings = nav.querySelector('[data-view="settings"]');
    const items = [
      ['analytics', '▥ Analytics'],
      ['warehouse', '▦ Warehouse'],
      ['procurement', '▤ Procurement'],
      ['approvals', '✓ Approvals']
    ];
    items.forEach(([view, label]) => {
      if (nav.querySelector(`[data-view="${view}"]`)) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.view = view;
      button.textContent = label;
      nav.insertBefore(button, settings || null);
    });
  }

  function showView(name, updateHash = true) {
    const panel = document.querySelector(`[data-view-panel="${CSS.escape(name)}"]`);
    if (!panel) {
      toast(`${pageMeta[name]?.[0] || 'Feature'} is still loading.`);
      return false;
    }
    document.querySelectorAll('[data-view-panel]').forEach(view => {
      view.classList.toggle('active', view === panel);
    });
    document.querySelectorAll('[data-view]').forEach(button => {
      button.classList.toggle('active', button.dataset.view === name);
      if (button.matches('button')) button.setAttribute('aria-current', button.dataset.view === name ? 'page' : 'false');
    });
    const meta = pageMeta[name] || [name.replace(/(^|-)\w/g, value => value.toUpperCase()), 'AgriSmart enterprise workspace.'];
    const title = document.querySelector('[data-page-title]');
    const subtitle = document.querySelector('[data-page-subtitle]');
    if (title) title.textContent = meta[0];
    if (subtitle) subtitle.textContent = meta[1];
    if (updateHash && location.hash !== `#${name}`) history.replaceState(null, '', `#${name}`);
    document.querySelector('.app-sidebar')?.classList.remove('open');
    document.querySelector('.mobile-overlay')?.classList.remove('open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return true;
  }

  function routeClick(event) {
    const trigger = event.target.closest('[data-view]');
    if (!trigger) return;
    const name = trigger.dataset.view;
    if (!name) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    showView(name);
  }

  function loadModule(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === 'true' || existing.readyState === 'complete') resolve();
        else {
          existing.addEventListener('load', resolve, { once: true });
          existing.addEventListener('error', reject, { once: true });
        }
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.dataset.agrismartEnterpriseModule = 'true';
      script.addEventListener('load', () => { script.dataset.loaded = 'true'; resolve(); }, { once: true });
      script.addEventListener('error', () => reject(new Error(`Unable to load ${src}`)), { once: true });
      document.head.appendChild(script);
    });
  }

  async function loadEnterpriseModules() {
    for (const src of enterpriseModules) {
      try { await loadModule(src); }
      catch (error) {
        console.error(error);
        window.dispatchEvent(new CustomEvent('agrismart:moduleerror', { detail: { modulePath: src, message: error.message } }));
      }
    }
    ensureNavigationItems();
    window.dispatchEvent(new CustomEvent('agrismart:extendedmodulesready', { detail: { modules: enterpriseModules.slice() } }));
    const requested = location.hash.slice(1);
    if (requested) showView(requested, false);
  }

  document.addEventListener('click', routeClick, true);
  window.addEventListener('hashchange', () => showView(location.hash.slice(1) || 'home', false));
  window.addEventListener('agrismart:modulesready', ensureNavigationItems);
  window.addEventListener('agrismart:extendedmodulesready', ensureNavigationItems);

  function init() {
    ensureNavigationItems();
    loadEnterpriseModules();
    showView(location.hash.slice(1) || 'home', false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  window.AgriSmartNavigation = Object.freeze({ showView, ensureNavigationItems, loadEnterpriseModules });
})();