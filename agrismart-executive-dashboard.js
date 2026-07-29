(() => {
  'use strict';

  const root = document.querySelector('[data-operations-dashboard]');
  if (!root) return;

  const read = (key, fallback = []) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return Array.isArray(value) ? value : fallback;
    } catch {
      return fallback;
    }
  };

  const money = value => {
    const settings = window.AgriSmartSettings?.get?.() || {};
    const currency = settings.currency || 'USD';
    try {
      return new Intl.NumberFormat(settings.locale || 'en-US', {
        style: 'currency', currency, maximumFractionDigits: 0
      }).format(Number(value) || 0);
    } catch {
      return `$${(Number(value) || 0).toLocaleString('en-US')}`;
    }
  };

  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));

  function build() {
    if (root.querySelector('[data-executive-dashboard]')) return;
    const section = document.createElement('section');
    section.dataset.executiveDashboard = '';
    section.innerHTML = `
      <div class="metric-grid" style="margin-top:18px">
        <article class="metric-card"><span>Registered farms</span><strong data-exec-farms>0</strong><small><span data-exec-area>0</span> hectares managed</small></article>
        <article class="metric-card"><span>Field activities</span><strong data-exec-activities>0</strong><small><span data-exec-upcoming>0</span> upcoming harvests</small></article>
        <article class="metric-card"><span>Marketplace requests</span><strong data-exec-market>0</strong><small>Supplier and service inquiries</small></article>
        <article class="metric-card"><span>Operational score</span><strong data-exec-score>0%</strong><small>Based on records and alerts</small></article>
      </div>
      <div class="dashboard-grid" style="margin-top:18px">
        <section class="panel">
          <div class="panel-head"><div><h3>Executive summary</h3><p>Current operational position across the enterprise.</p></div><span class="chip">Live</span></div>
          <div class="result-list" data-exec-summary></div>
        </section>
        <section class="panel">
          <div class="panel-head"><div><h3>Upcoming milestones</h3><p>Planting, harvest and operational dates.</p></div></div>
          <div class="order-list" data-exec-milestones></div>
        </section>
      </div>
      <section class="panel" style="margin-top:18px">
        <div class="panel-head"><div><h3>Financial performance</h3><p>Revenue, expenses and estimated profit at a glance.</p></div><button class="secondary-btn" type="button" data-exec-refresh>Refresh</button></div>
        <div data-exec-financial-bars></div>
      </section>`;
    root.appendChild(section);
  }

  function renderBars(revenue, expenses, profit) {
    const target = root.querySelector('[data-exec-financial-bars]');
    if (!target) return;
    const max = Math.max(revenue, expenses, Math.abs(profit), 1);
    const rows = [
      ['Revenue', revenue], ['Expenses', expenses], ['Profit', profit]
    ];
    target.innerHTML = rows.map(([label, value]) => {
      const width = Math.max(4, Math.min(100, Math.abs(value) / max * 100));
      return `<div style="display:grid;grid-template-columns:90px 1fr auto;gap:12px;align-items:center;margin:14px 0"><strong>${label}</strong><div style="height:12px;background:#edf3ef;border-radius:999px;overflow:hidden"><span style="display:block;height:100%;width:${width}%;background:#0d4d35;border-radius:999px"></span></div><span>${escapeHtml(money(value))}</span></div>`;
    }).join('');
  }

  function render() {
    const farms = read('agrismart-farms-v1');
    const activities = read('agrismart-farm-activities-v1');
    const market = read('agrismart-marketplace-requests-v1');
    const reports = window.AgriSmartReports;
    const inventory = window.AgriSmartInventory;
    const finance = reports?.getSummary?.() || { totalRevenue: 0, totalExpenses: 0, estimatedProfit: 0 };
    const stock = inventory?.getSummary?.() || { lowStockCount: 0, outOfStockCount: 0 };
    const area = farms.reduce((sum, farm) => sum + (Number(farm.size) || 0), 0);
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = farms.filter(farm => farm.expectedHarvest && farm.expectedHarvest >= today).sort((a, b) => a.expectedHarvest.localeCompare(b.expectedHarvest));

    const completionSignals = [farms.length > 0, activities.length > 0, finance.totalRevenue > 0, finance.totalExpenses > 0, stock.lowStockCount === 0, market.length > 0];
    const score = Math.round(completionSignals.filter(Boolean).length / completionSignals.length * 100);

    const values = {
      '[data-exec-farms]': farms.length,
      '[data-exec-area]': area.toFixed(area % 1 ? 1 : 0),
      '[data-exec-activities]': activities.length,
      '[data-exec-upcoming]': upcoming.length,
      '[data-exec-market]': market.length,
      '[data-exec-score]': `${score}%`
    };
    Object.entries(values).forEach(([selector, value]) => {
      const element = root.querySelector(selector);
      if (element) element.textContent = String(value);
    });

    const summary = root.querySelector('[data-exec-summary]');
    if (summary) {
      const messages = [
        { title: 'Financial position', copy: `${money(finance.totalRevenue)} revenue against ${money(finance.totalExpenses)} expenses.` },
        { title: 'Farm coverage', copy: `${farms.length} farms covering ${area.toFixed(1)} hectares are currently registered.` },
        { title: 'Inventory health', copy: `${stock.lowStockCount || 0} low-stock items and ${stock.outOfStockCount || 0} out-of-stock items require attention.` },
        { title: 'Marketplace activity', copy: `${market.length} supplier or service requests are awaiting follow-up.` }
      ];
      summary.innerHTML = messages.map(item => `<article><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.copy)}</p></article>`).join('');
    }

    const milestones = root.querySelector('[data-exec-milestones]');
    if (milestones) {
      milestones.innerHTML = upcoming.length ? upcoming.slice(0, 6).map(farm => `<div class="order-item"><div><strong>${escapeHtml(farm.name)}</strong><div>${escapeHtml(farm.crop || 'Crop')} expected harvest</div></div><span class="chip">${escapeHtml(farm.expectedHarvest)}</span></div>`).join('') : '<div class="notice">No upcoming harvest milestones have been recorded.</div>';
    }

    renderBars(finance.totalRevenue || 0, finance.totalExpenses || 0, finance.estimatedProfit || 0);
  }

  build();
  render();
  root.addEventListener('click', event => {
    if (event.target.closest('[data-exec-refresh]')) render();
  });
  ['agrismart:datachange', 'agrismart:inventorychange', 'agrismart:farmchange', 'agrismart:marketplacechange', 'storage'].forEach(name => window.addEventListener(name, render));
})();