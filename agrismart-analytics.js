(() => {
  'use strict';

  const reports = window.AgriSmartReports;
  const inventory = window.AgriSmartInventory;
  if (!reports) return;

  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[char]));

  const localeByCurrency = { NGN:'en-NG', USD:'en-US', EUR:'en-IE', GBP:'en-GB', CAD:'en-CA', AUD:'en-AU', GHS:'en-GH', KES:'en-KE', ZAR:'en-ZA', XOF:'fr-SN' };
  const money = (value, currency) => new Intl.NumberFormat(localeByCurrency[currency] || 'en-US', {
    style: 'currency', currency, maximumFractionDigits: currency === 'XOF' ? 0 : 2
  }).format(Number(value) || 0);

  const monthKey = value => String(value || '').slice(0, 7);
  const monthLabel = key => {
    const [year, month] = key.split('-').map(Number);
    return new Intl.DateTimeFormat('en-US', { month:'short', year:'2-digit' }).format(new Date(year, month - 1, 1));
  };

  function monthlySeries(currency) {
    const map = new Map();
    const ensure = key => {
      if (!map.has(key)) map.set(key, { month:key, revenue:0, expenses:0 });
      return map.get(key);
    };
    reports.getExpenses().forEach(item => {
      const code = item.currency || currency;
      if (code !== currency) return;
      ensure(monthKey(item.date)).expenses += Number(item.amount) || 0;
    });
    reports.getHarvests().forEach(item => {
      const code = item.currency || currency;
      if (code !== currency) return;
      ensure(monthKey(item.date)).revenue += Number(item.revenue) || 0;
    });
    return [...map.values()].filter(item => item.month).sort((a,b) => a.month.localeCompare(b.month)).slice(-6);
  }

  function barChart(series, currency) {
    if (!series.length) return '<div class="notice">Add expense and harvest records to see financial trends.</div>';
    const max = Math.max(1, ...series.flatMap(item => [item.revenue, item.expenses]));
    return `<div style="display:grid;grid-template-columns:repeat(${series.length},minmax(58px,1fr));gap:14px;align-items:end;min-height:230px;padding-top:18px">${series.map(item => {
      const revenueHeight = Math.max(4, Math.round((item.revenue / max) * 160));
      const expenseHeight = Math.max(4, Math.round((item.expenses / max) * 160));
      return `<div style="display:grid;gap:8px;text-align:center;align-self:end">
        <div style="display:flex;align-items:end;justify-content:center;gap:6px;height:170px">
          <span title="Revenue: ${escapeHtml(money(item.revenue,currency))}" style="width:18px;height:${revenueHeight}px;border-radius:6px 6px 2px 2px;background:#1d8f5a"></span>
          <span title="Expenses: ${escapeHtml(money(item.expenses,currency))}" style="width:18px;height:${expenseHeight}px;border-radius:6px 6px 2px 2px;background:#d69b34"></span>
        </div>
        <strong style="font-size:.78rem">${escapeHtml(monthLabel(item.month))}</strong>
      </div>`;
    }).join('')}</div><div style="display:flex;gap:16px;margin-top:12px;font-size:.85rem"><span>● Revenue</span><span>● Expenses</span></div>`;
  }

  function cropPerformance(currency) {
    const map = new Map();
    reports.getHarvests().forEach(item => {
      if ((item.currency || currency) !== currency) return;
      const crop = item.crop || 'Other';
      const current = map.get(crop) || { crop, quantity:0, revenue:0, records:0 };
      current.quantity += Number(item.quantity) || 0;
      current.revenue += Number(item.revenue) || 0;
      current.records += 1;
      map.set(crop, current);
    });
    return [...map.values()].sort((a,b) => b.revenue - a.revenue).slice(0, 6);
  }

  function render() {
    const root = document.querySelector('[data-analytics-panel]');
    if (!root) return;
    const currency = reports.getCurrency?.() || 'NGN';
    const summary = reports.getSummary(currency);
    const series = monthlySeries(currency);
    const crops = cropPerformance(currency);
    const stock = inventory?.getSummary?.() || { itemCount:0, lowStockCount:0, outOfStockCount:0 };
    const margin = summary.totalRevenue ? (summary.estimatedProfit / summary.totalRevenue) * 100 : 0;

    root.innerHTML = `
      <div class="metric-grid">
        <article class="metric-card"><span>Revenue</span><strong>${escapeHtml(money(summary.totalRevenue,currency))}</strong><small>${summary.harvests} harvest records</small></article>
        <article class="metric-card"><span>Expenses</span><strong>${escapeHtml(money(summary.totalExpenses,currency))}</strong><small>${summary.expenses} expense records</small></article>
        <article class="metric-card"><span>Net result</span><strong>${escapeHtml(money(summary.estimatedProfit,currency))}</strong><small>${margin.toFixed(1)}% margin</small></article>
        <article class="metric-card"><span>Stock risk</span><strong>${stock.lowStockCount || 0}</strong><small>${stock.outOfStockCount || 0} out of stock</small></article>
      </div>
      <div class="dashboard-grid" style="margin-top:18px">
        <section class="panel"><div class="panel-head"><div><h3>Six-month financial trend</h3><p>Revenue and expenses in ${currency}.</p></div></div>${barChart(series,currency)}</section>
        <section class="panel"><div class="panel-head"><div><h3>Crop performance</h3><p>Top crops ranked by recorded revenue.</p></div></div><div class="order-list">${crops.length ? crops.map(item => `<div class="order-item"><div><strong>${escapeHtml(item.crop)}</strong><div>${item.records} records · ${item.quantity.toLocaleString('en-US')} total units</div></div><strong>${escapeHtml(money(item.revenue,currency))}</strong></div>`).join('') : '<div class="notice">No crop performance data yet.</div>'}</div></section>
      </div>
      <div class="dashboard-grid" style="margin-top:18px">
        <section class="panel"><div class="panel-head"><h3>Operational snapshot</h3></div><div class="result-list"><article><strong>${summary.farms}</strong><p>Registered farms</p></article><article><strong>${summary.totalArea.toFixed(2)}</strong><p>Total recorded farm area</p></article><article><strong>${stock.itemCount || 0}</strong><p>Inventory items</p></article><article><strong>${summary.inventoryMovements || 0}</strong><p>Stock movements</p></article></div></section>
        <section class="panel"><div class="panel-head"><h3>Data quality</h3></div><div class="result-list"><article><strong>${summary.expenses + summary.harvests}</strong><p>Financial records available for analysis</p></article><article><strong>${currency}</strong><p>Active reporting currency</p></article><article><strong>${series.length}</strong><p>Months represented in trend data</p></article></div></section>
      </div>`;
  }

  window.addEventListener('agrismart:datachange', render);
  window.addEventListener('agrismart:inventorychange', render);
  window.addEventListener('agrismart:currencychange', render);
  window.addEventListener('agrismart:restorecomplete', render);
  render();
})();