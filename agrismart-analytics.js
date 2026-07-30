(() => {
  'use strict';

  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[character]));

  const localeByCurrency = {
    NGN:'en-NG', USD:'en-US', EUR:'en-IE', GBP:'en-GB', CAD:'en-CA', AUD:'en-AU',
    GHS:'en-GH', KES:'en-KE', ZAR:'en-ZA', XOF:'fr-SN'
  };

  const money = (value, currency = 'NGN') => new Intl.NumberFormat(localeByCurrency[currency] || 'en-US', {
    style:'currency', currency, maximumFractionDigits: currency === 'XOF' ? 0 : 2
  }).format(Number(value) || 0);

  const safeCall = (callback, fallback) => {
    try {
      const value = callback();
      return value == null ? fallback : value;
    } catch {
      return fallback;
    }
  };

  const asArray = value => {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== 'object') return [];
    for (const key of ['items','records','orders','requests','warehouses','locations','suppliers','movements','receipts']) {
      if (Array.isArray(value[key])) return value[key];
    }
    return [];
  };

  const monthKey = value => String(value || '').slice(0, 7);
  const monthLabel = key => {
    const [year, month] = key.split('-').map(Number);
    return Number.isFinite(year) && Number.isFinite(month)
      ? new Intl.DateTimeFormat('en-US', { month:'short', year:'2-digit' }).format(new Date(year, month - 1, 1))
      : key;
  };

  function financeData(currency) {
    const reports = window.AgriSmartReports;
    const expenses = safeCall(() => reports?.getExpenses?.(), []);
    const harvests = safeCall(() => reports?.getHarvests?.(), []);
    const summary = safeCall(() => reports?.getSummary?.(currency), null) || {};
    return { expenses: asArray(expenses), harvests: asArray(harvests), summary };
  }

  function inventoryData() {
    const api = window.AgriSmartInventory;
    const raw = safeCall(() => api?.read?.(), null);
    const items = asArray(raw);
    const summary = safeCall(() => api?.getSummary?.(), null) || {};
    return { items, summary };
  }

  function procurementData() {
    const api = window.AgriSmartProcurement;
    const raw = safeCall(() => api?.read?.(), null) || {};
    const orders = Array.isArray(raw.orders) ? raw.orders : asArray(raw);
    const requests = Array.isArray(raw.requests) ? raw.requests : [];
    const suppliers = Array.isArray(raw.suppliers) ? raw.suppliers : [];
    return { raw, orders, requests, suppliers };
  }

  function warehouseData() {
    const api = window.AgriSmartWarehouse;
    const raw = safeCall(() => api?.read?.(), null) || {};
    const warehouses = Array.isArray(raw.warehouses) ? raw.warehouses : asArray(raw);
    const receipts = Array.isArray(raw.receipts) ? raw.receipts : [];
    const issues = Array.isArray(raw.issues) ? raw.issues : [];
    const transfers = Array.isArray(raw.transfers) ? raw.transfers : [];
    return { raw, warehouses, receipts, issues, transfers };
  }

  function approvalData() {
    const raw = safeCall(() => window.AgriSmartApprovals?.read?.(), null) || {};
    const requests = Array.isArray(raw) ? raw : (Array.isArray(raw.requests) ? raw.requests : []);
    return { requests };
  }

  function monthlySeries(expenses, harvests, currency) {
    const map = new Map();
    const ensure = key => {
      if (!map.has(key)) map.set(key, { month:key, revenue:0, expenses:0 });
      return map.get(key);
    };
    expenses.forEach(item => {
      if ((item.currency || currency) !== currency) return;
      const key = monthKey(item.date || item.createdAt);
      if (key) ensure(key).expenses += Number(item.amount || item.total || 0);
    });
    harvests.forEach(item => {
      if ((item.currency || currency) !== currency) return;
      const key = monthKey(item.date || item.createdAt);
      if (key) ensure(key).revenue += Number(item.revenue || item.amount || 0);
    });
    return [...map.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
  }

  function cropPerformance(harvests, currency) {
    const map = new Map();
    harvests.forEach(item => {
      if ((item.currency || currency) !== currency) return;
      const crop = item.crop || 'Other';
      const current = map.get(crop) || { crop, quantity:0, revenue:0, records:0 };
      current.quantity += Number(item.quantity || 0);
      current.revenue += Number(item.revenue || 0);
      current.records += 1;
      map.set(crop, current);
    });
    return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 6);
  }

  function categorySpend(expenses) {
    const map = new Map();
    expenses.forEach(item => {
      const category = item.category || 'Other';
      map.set(category, (map.get(category) || 0) + Number(item.amount || 0));
    });
    return [...map.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount).slice(0, 6);
  }

  function financialChart(series, currency) {
    if (!series.length) return '<div class="notice">Add expense and harvest records to see financial trends.</div>';
    const max = Math.max(1, ...series.flatMap(item => [item.revenue, item.expenses]));
    return `<div style="display:grid;grid-template-columns:repeat(${series.length},minmax(58px,1fr));gap:14px;align-items:end;min-height:230px;padding-top:18px">${series.map(item => {
      const revenueHeight = Math.max(4, Math.round((item.revenue / max) * 160));
      const expenseHeight = Math.max(4, Math.round((item.expenses / max) * 160));
      return `<div style="display:grid;gap:8px;text-align:center;align-self:end"><div style="display:flex;align-items:end;justify-content:center;gap:6px;height:170px"><span title="Revenue: ${escapeHtml(money(item.revenue,currency))}" style="width:18px;height:${revenueHeight}px;border-radius:6px 6px 2px 2px;background:#1d8f5a"></span><span title="Expenses: ${escapeHtml(money(item.expenses,currency))}" style="width:18px;height:${expenseHeight}px;border-radius:6px 6px 2px 2px;background:#d69b34"></span></div><strong style="font-size:.78rem">${escapeHtml(monthLabel(item.month))}</strong></div>`;
    }).join('')}</div><div style="display:flex;gap:16px;margin-top:12px;font-size:.85rem"><span>● Revenue</span><span>● Expenses</span></div>`;
  }

  function horizontalBars(items, labelKey, valueKey, formatter) {
    if (!items.length) return '<div class="notice">No data available yet.</div>';
    const max = Math.max(1, ...items.map(item => Number(item[valueKey]) || 0));
    return `<div class="result-list">${items.map(item => {
      const value = Number(item[valueKey]) || 0;
      const width = Math.max(3, Math.round((value / max) * 100));
      return `<article><strong>${escapeHtml(item[labelKey])}</strong><p>${escapeHtml(formatter(value))}</p><div style="height:8px;border-radius:999px;background:rgba(0,0,0,.08);overflow:hidden"><span style="display:block;height:100%;width:${width}%;background:#1d8f5a"></span></div></article>`;
    }).join('')}</div>`;
  }

  function buildInsights(context) {
    const insights = [];
    if (context.margin < 10 && context.revenue > 0) insights.push(['Margin attention', 'Profit margin is below 10%. Review high-cost categories and selling prices.']);
    if (context.lowStock > 0) insights.push(['Reorder priority', `${context.lowStock} inventory item${context.lowStock === 1 ? '' : 's'} need replenishment attention.`]);
    if (context.pendingApprovals > 0) insights.push(['Approval backlog', `${context.pendingApprovals} request${context.pendingApprovals === 1 ? '' : 's'} are awaiting review.`]);
    if (context.openOrders > 0) insights.push(['Procurement follow-up', `${context.openOrders} purchase order${context.openOrders === 1 ? '' : 's'} remain open or in progress.`]);
    if (!context.harvestCount) insights.push(['Revenue visibility', 'No harvest income has been recorded. Add harvest records to improve financial reporting.']);
    if (!insights.length) insights.push(['Operations stable', 'No major exception was detected from the currently available records.']);
    return insights.slice(0, 5);
  }

  function exportCsv(snapshot, currency) {
    const rows = [
      ['Metric','Value'],
      ['Currency', currency],
      ['Revenue', snapshot.revenue],
      ['Expenses', snapshot.expenses],
      ['Net result', snapshot.profit],
      ['Profit margin', `${snapshot.margin.toFixed(1)}%`],
      ['Inventory items', snapshot.inventoryItems],
      ['Low-stock items', snapshot.lowStock],
      ['Open purchase orders', snapshot.openOrders],
      ['Pending approvals', snapshot.pendingApprovals],
      ['Warehouses', snapshot.warehouses],
      ['Registered farms', snapshot.farms]
    ];
    const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `agrismart-analytics-${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function ensurePanel() {
    let view = document.querySelector('[data-view-panel="analytics"]');
    const main = document.querySelector('.app-content') || document.querySelector('.app-main main') || document.querySelector('.app-main');
    if (!view && main) {
      view = document.createElement('section');
      view.className = 'view';
      view.dataset.viewPanel = 'analytics';
      view.innerHTML = '<div class="section-heading"><p class="eyebrow">Enterprise intelligence</p><h2>Analytics</h2><p>Review financial, farm, inventory and operational performance from one workspace.</p></div><div data-analytics-panel></div>';
      const settings = document.querySelector('[data-view-panel="settings"]');
      main.insertBefore(view, settings || null);
    }

    const nav = document.querySelector('.app-nav');
    if (nav && !nav.querySelector('[data-view="analytics"]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.view = 'analytics';
      button.textContent = '▥ Analytics';
      nav.insertBefore(button, nav.querySelector('[data-view="settings"]') || null);
    }
    return view?.querySelector('[data-analytics-panel]') || null;
  }

  function render() {
    const root = ensurePanel();
    if (!root) return;

    const reports = window.AgriSmartReports;
    const currency = safeCall(() => reports?.getCurrency?.(), 'NGN') || 'NGN';
    const finance = financeData(currency);
    const inventory = inventoryData();
    const procurement = procurementData();
    const warehouse = warehouseData();
    const approvals = approvalData();
    const summary = finance.summary;

    const revenue = Number(summary.totalRevenue || finance.harvests.reduce((sum, item) => sum + Number(item.revenue || 0), 0));
    const expenses = Number(summary.totalExpenses || finance.expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0));
    const profit = Number(summary.estimatedProfit ?? (revenue - expenses));
    const margin = revenue ? (profit / revenue) * 100 : 0;
    const inventoryItems = Number(inventory.summary.itemCount ?? inventory.items.length);
    const lowStock = Number(inventory.summary.lowStockCount ?? inventory.items.filter(item => Number(item.quantity) <= Number(item.reorderLevel || 0)).length);
    const outOfStock = Number(inventory.summary.outOfStockCount ?? inventory.items.filter(item => Number(item.quantity) <= 0).length);
    const openOrders = procurement.orders.filter(item => !['completed','received','cancelled','closed'].includes(String(item.status || '').toLowerCase())).length;
    const pendingApprovals = approvals.requests.filter(item => String(item.status || '').toLowerCase() === 'pending').length;
    const series = monthlySeries(finance.expenses, finance.harvests, currency);
    const crops = cropPerformance(finance.harvests, currency);
    const spend = categorySpend(finance.expenses);
    const farms = Number(summary.farms || safeCall(() => JSON.parse(localStorage.getItem('agrismart-farms-v1') || '[]').length, 0));
    const snapshot = { revenue, expenses, profit, margin, inventoryItems, lowStock, outOfStock, openOrders, pendingApprovals, warehouses: warehouse.warehouses.length, farms };
    const insights = buildInsights({ ...snapshot, harvestCount: finance.harvests.length });

    root.innerHTML = `
      <div class="panel-head" style="margin-bottom:18px"><div><h3>Executive performance dashboard</h3><p>Consolidated finance, farm, inventory, warehouse and procurement intelligence.</p></div><div class="hero-actions"><button class="secondary-btn" type="button" data-refresh-analytics>Refresh</button><button class="secondary-btn" type="button" data-export-analytics>Export CSV</button></div></div>
      <div class="metric-grid">
        <article class="metric-card"><span>Revenue</span><strong>${escapeHtml(money(revenue,currency))}</strong><small>${finance.harvests.length} harvest records</small></article>
        <article class="metric-card"><span>Expenses</span><strong>${escapeHtml(money(expenses,currency))}</strong><small>${finance.expenses.length} expense records</small></article>
        <article class="metric-card"><span>Net result</span><strong>${escapeHtml(money(profit,currency))}</strong><small>${margin.toFixed(1)}% margin</small></article>
        <article class="metric-card"><span>Operational exceptions</span><strong>${lowStock + pendingApprovals + openOrders}</strong><small>${lowStock} stock · ${pendingApprovals} approvals · ${openOrders} orders</small></article>
      </div>

      <div class="dashboard-grid" style="margin-top:18px">
        <section class="panel"><div class="panel-head"><div><h3>Six-month financial trend</h3><p>Revenue and expenses in ${escapeHtml(currency)}.</p></div></div>${financialChart(series,currency)}</section>
        <section class="panel"><div class="panel-head"><div><h3>AI management insights</h3><p>Rule-based recommendations from current operational records.</p></div><span class="chip">Live</span></div><div class="result-list">${insights.map(([title, text]) => `<article><strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p></article>`).join('')}</div></section>
      </div>

      <div class="dashboard-grid" style="margin-top:18px">
        <section class="panel"><div class="panel-head"><div><h3>Crop performance</h3><p>Top crops ranked by recorded revenue.</p></div></div><div class="order-list">${crops.length ? crops.map(item => `<div class="order-item"><div><strong>${escapeHtml(item.crop)}</strong><div>${item.records} record${item.records === 1 ? '' : 's'} · ${item.quantity.toLocaleString('en-US')} total units</div></div><strong>${escapeHtml(money(item.revenue,currency))}</strong></div>`).join('') : '<div class="notice">No crop performance data yet.</div>'}</div></section>
        <section class="panel"><div class="panel-head"><div><h3>Expense concentration</h3><p>Highest recorded expense categories.</p></div></div>${horizontalBars(spend,'category','amount',value => money(value,currency))}</section>
      </div>

      <div class="dashboard-grid" style="margin-top:18px">
        <section class="panel"><div class="panel-head"><h3>Enterprise operations</h3></div><div class="result-list">
          <article><strong>${farms}</strong><p>Registered farms</p></article>
          <article><strong>${inventoryItems}</strong><p>Inventory items · ${lowStock} low · ${outOfStock} out</p></article>
          <article><strong>${warehouse.warehouses.length}</strong><p>Warehouses · ${warehouse.receipts.length} receipts · ${warehouse.transfers.length} transfers</p></article>
          <article><strong>${procurement.suppliers.length}</strong><p>Suppliers · ${procurement.orders.length} purchase orders</p></article>
        </div></section>
        <section class="panel"><div class="panel-head"><h3>Workflow and data quality</h3></div><div class="result-list">
          <article><strong>${pendingApprovals}</strong><p>Pending approval requests</p></article>
          <article><strong>${openOrders}</strong><p>Open procurement orders</p></article>
          <article><strong>${finance.expenses.length + finance.harvests.length}</strong><p>Financial records available for analysis</p></article>
          <article><strong>${series.length}</strong><p>Months represented in trend data</p></article>
        </div></section>
      </div>`;

    root.querySelector('[data-refresh-analytics]')?.addEventListener('click', render);
    root.querySelector('[data-export-analytics]')?.addEventListener('click', () => exportCsv(snapshot, currency));
  }

  ['agrismart:datachange','agrismart:inventorychange','agrismart:currencychange','agrismart:restorecomplete','agrismart:warehousechange','agrismart:procurementchange','agrismart:approvalchange','agrismart:extendedmodulesready'].forEach(eventName => window.addEventListener(eventName, render));
  window.AgriSmartAnalytics = Object.freeze({ render });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render, { once:true }); else render();
})();
