(() => {
  'use strict';

  const SYNC_KEY = 'agrismart-enterprise-sync-v1';
  const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const readSync = () => { try { return JSON.parse(localStorage.getItem(SYNC_KEY) || '{}'); } catch { return {}; } };
  const saveSync = value => localStorage.setItem(SYNC_KEY, JSON.stringify(value));

  function notifyChange(source) {
    window.dispatchEvent(new CustomEvent('agrismart:enterprisechange', { detail: { source, at: new Date().toISOString() } }));
    window.dispatchEvent(new CustomEvent('agrismart:datachange'));
  }

  function syncProcurement() {
    const procurement = window.AgriSmartProcurement?.read?.();
    const reports = window.AgriSmartReports;
    const inventory = window.AgriSmartInventory;
    if (!procurement) return { expenses: 0, receipts: 0 };
    const state = readSync();
    state.procurementExpenses ||= [];
    state.procurementReceipts ||= [];
    let expenses = 0;
    let receipts = 0;

    (procurement.purchaseOrders || []).forEach(order => {
      if (!['Issued', 'Partially Received', 'Received'].includes(order.status) || state.procurementExpenses.includes(order.id)) return;
      if (reports?.addExpense) {
        reports.addExpense({ category: 'Procurement', amount: Number(order.total || 0), date: String(order.createdAt || new Date().toISOString()).slice(0, 10), description: `${order.number}: ${order.itemName}`, currency: reports.getCurrency?.() || 'USD' });
        state.procurementExpenses.push(order.id);
        expenses += 1;
      }
    });

    (procurement.receipts || []).forEach(receipt => {
      if (state.procurementReceipts.includes(receipt.id)) return;
      const order = (procurement.purchaseOrders || []).find(item => item.id === receipt.purchaseOrderId);
      if (!order || receipt.condition === 'Rejected') return;
      if (inventory?.addItem) {
        const existing = inventory.getItems?.().find(item => item.name.toLowerCase() === String(order.itemName).toLowerCase());
        if (existing && inventory.recordMovement) {
          inventory.recordMovement({ itemId: existing.id, type: 'in', quantity: Number(receipt.quantity || 0), reason: `Goods receipt ${receipt.number}` });
        } else {
          inventory.addItem({ name: order.itemName, category: 'Procurement', quantity: Number(receipt.quantity || 0), unit: order.unit || 'units', reorderLevel: 0, supplier: (procurement.suppliers || []).find(item => item.id === order.supplierId)?.name || '' });
        }
        state.procurementReceipts.push(receipt.id);
        receipts += 1;
      }
    });
    saveSync(state);
    if (expenses || receipts) notifyChange('procurement');
    return { expenses, receipts };
  }

  function syncWarehouse() {
    const warehouse = window.AgriSmartWarehouse?.read?.();
    const inventory = window.AgriSmartInventory;
    if (!warehouse || !inventory?.addItem) return 0;
    const state = readSync();
    state.warehouseStock ||= [];
    let count = 0;
    (warehouse.stock || []).forEach(stock => {
      if (state.warehouseStock.includes(stock.id)) return;
      const existing = inventory.getItems?.().find(item => item.name.toLowerCase() === String(stock.itemName).toLowerCase());
      if (existing && inventory.recordMovement) {
        inventory.recordMovement({ itemId: existing.id, type: 'in', quantity: Number(stock.quantity || 0), reason: `Warehouse batch ${stock.batchNumber}` });
      } else {
        inventory.addItem({ name: stock.itemName, category: stock.category || 'Warehouse', quantity: Number(stock.quantity || 0), unit: stock.unit || 'units', reorderLevel: Number(stock.minimumLevel || 0), supplier: '' });
      }
      state.warehouseStock.push(stock.id);
      count += 1;
    });
    saveSync(state);
    if (count) notifyChange('warehouse');
    return count;
  }

  function renderEnterpriseAnalytics() {
    const root = document.querySelector('[data-analytics-panel]');
    if (!root) return;
    let panel = root.querySelector('[data-enterprise-analytics]');
    if (!panel) {
      panel = document.createElement('section');
      panel.className = 'panel';
      panel.dataset.enterpriseAnalytics = '';
      panel.style.marginTop = '18px';
      root.appendChild(panel);
    }
    const procurement = window.AgriSmartProcurement?.read?.() || { suppliers: [], requisitions: [], purchaseOrders: [], receipts: [] };
    const warehouse = window.AgriSmartWarehouse?.read?.() || { warehouses: [], stock: [], movements: [] };
    const approvals = window.AgriSmartApprovals?.read?.() || [];
    const spend = procurement.purchaseOrders.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const stockQty = warehouse.stock.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    panel.innerHTML = `<div class="panel-head"><div><h3>Enterprise operations</h3><p>Procurement, warehouse and approval activity.</p></div></div><div class="metric-grid"><article class="metric-card"><span>Procurement spend</span><strong>${money(spend)}</strong><small>${procurement.purchaseOrders.length} purchase orders</small></article><article class="metric-card"><span>Warehouses</span><strong>${warehouse.warehouses.length}</strong><small>${stockQty.toLocaleString('en-US')} total stock units</small></article><article class="metric-card"><span>Pending approvals</span><strong>${approvals.filter(item => item.status === 'Pending').length}</strong><small>${approvals.length} total requests</small></article><article class="metric-card"><span>Suppliers</span><strong>${procurement.suppliers.length}</strong><small>${procurement.receipts.length} goods receipts</small></article></div>`;
  }

  function renderAdvisorInsights() {
    const target = document.querySelector('[data-advisor-results]');
    if (!target || target.querySelector('[data-live-insights]')) return;
    const reports = window.AgriSmartReports?.getSummary?.() || {};
    const inventory = window.AgriSmartInventory?.getSummary?.() || {};
    const procurement = window.AgriSmartProcurement?.read?.() || { requisitions: [], purchaseOrders: [] };
    const insights = [];
    if (inventory.lowStockCount) insights.push(`${inventory.lowStockCount} inventory item(s) need replenishment.`);
    if (Number(reports.totalExpenses || 0) > Number(reports.totalRevenue || 0)) insights.push('Recorded expenses exceed revenue; review procurement and operating costs.');
    if (procurement.requisitions.some(item => item.status === 'Pending Approval')) insights.push('Purchase requisitions are awaiting approval and may delay operations.');
    if (!insights.length) insights.push('No urgent enterprise risks were detected from current records.');
    target.insertAdjacentHTML('afterbegin', `<article data-live-insights><strong>Live enterprise insight</strong><p>${insights.map(esc).join(' ')}</p><span class="chip">Live data</span></article>`);
  }

  function runReadinessChecks() {
    const requiredViews = ['home','scan','farm','finance','inventory','advisor','marketplace','academy','analytics','warehouse','procurement','settings'];
    const missingViews = requiredViews.filter(name => !document.querySelector(`[data-view-panel="${name}"]`));
    const missingApis = ['AgriSmartReports','AgriSmartInventory','AgriSmartAdvisor','AgriSmartProcurement','AgriSmartWarehouse'].filter(name => !window[name]);
    const result = { passed: missingViews.length === 0 && missingApis.length === 0, missingViews, missingApis, checkedAt: new Date().toISOString() };
    localStorage.setItem('agrismart-readiness-v1', JSON.stringify(result));
    window.dispatchEvent(new CustomEvent('agrismart:readinesscomplete', { detail: result }));
    return result;
  }

  function refresh() {
    syncProcurement();
    syncWarehouse();
    renderEnterpriseAnalytics();
    renderAdvisorInsights();
    runReadinessChecks();
  }

  ['agrismart:extendedmodulesready','agrismart:procurementchange','agrismart:warehousechange','agrismart:approvalchange','agrismart:datachange','agrismart:inventorychange'].forEach(name => window.addEventListener(name, () => queueMicrotask(refresh)));
  window.addEventListener('storage', event => { if (event.key?.startsWith('agrismart-')) queueMicrotask(refresh); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(refresh, 100), { once: true });
  else setTimeout(refresh, 100);

  window.AgriSmartEnterprise = Object.freeze({ syncProcurement, syncWarehouse, renderEnterpriseAnalytics, renderAdvisorInsights, runReadinessChecks, refresh });
})();