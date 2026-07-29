(() => {
  'use strict';

  const KEY = 'agrismart-procurement-v1';
  const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
  const empty = () => ({ suppliers: [], requisitions: [], purchaseOrders: [], receipts: [] });
  const read = () => {
    try { return { ...empty(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
    catch { return empty(); }
  };
  const save = data => {
    localStorage.setItem(KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('agrismart:procurementchange'));
    return data;
  };

  function addSupplier(input) {
    const data = read();
    const supplier = {
      id: uid('supplier'), name: String(input.name || '').trim(),
      contact: String(input.contact || '').trim(), email: String(input.email || '').trim(),
      phone: String(input.phone || '').trim(), category: String(input.category || 'General'),
      paymentTerms: String(input.paymentTerms || '').trim(), rating: Number(input.rating || 0),
      status: 'Active', createdAt: new Date().toISOString()
    };
    if (!supplier.name) throw new Error('Supplier name is required.');
    data.suppliers.push(supplier); save(data); return supplier;
  }

  function createRequisition(input) {
    const data = read();
    const quantity = Number(input.quantity || 0);
    const unitPrice = Number(input.unitPrice || 0);
    if (!input.itemName || quantity <= 0) throw new Error('Enter a valid item and quantity.');
    const requisition = {
      id: uid('req'), number: `PR-${Date.now().toString().slice(-7)}`,
      itemName: String(input.itemName).trim(), quantity, unit: input.unit || 'units',
      unitPrice, estimatedTotal: quantity * unitPrice, neededBy: input.neededBy || '',
      department: String(input.department || '').trim(), justification: String(input.justification || '').trim(),
      status: 'Pending Approval', createdAt: new Date().toISOString()
    };
    data.requisitions.unshift(requisition); save(data); return requisition;
  }

  function approveRequisition(id) {
    const data = read();
    const item = data.requisitions.find(entry => entry.id === id);
    if (!item) throw new Error('Requisition not found.');
    item.status = 'Approved'; item.approvedAt = new Date().toISOString();
    save(data); return item;
  }

  function createPurchaseOrder(input) {
    const data = read();
    const supplier = data.suppliers.find(item => item.id === input.supplierId);
    const requisition = data.requisitions.find(item => item.id === input.requisitionId);
    if (!supplier || !requisition || requisition.status !== 'Approved') throw new Error('Select an approved requisition and supplier.');
    const order = {
      id: uid('po'), number: `PO-${Date.now().toString().slice(-7)}`,
      supplierId: supplier.id, requisitionId: requisition.id,
      itemName: requisition.itemName, quantity: requisition.quantity, unit: requisition.unit,
      unitPrice: Number(input.unitPrice || requisition.unitPrice || 0),
      total: requisition.quantity * Number(input.unitPrice || requisition.unitPrice || 0),
      expectedDate: input.expectedDate || '', status: 'Issued', createdAt: new Date().toISOString()
    };
    requisition.status = 'Ordered'; data.purchaseOrders.unshift(order); save(data); return order;
  }

  function receivePurchaseOrder(input) {
    const data = read();
    const order = data.purchaseOrders.find(item => item.id === input.purchaseOrderId);
    const quantity = Number(input.quantity || 0);
    if (!order || quantity <= 0 || quantity > order.quantity) throw new Error('Enter a valid received quantity.');
    const receipt = {
      id: uid('grn'), number: `GRN-${Date.now().toString().slice(-7)}`,
      purchaseOrderId: order.id, quantity, condition: input.condition || 'Accepted',
      notes: String(input.notes || '').trim(), receivedAt: new Date().toISOString()
    };
    order.receivedQuantity = Number(order.receivedQuantity || 0) + quantity;
    order.status = order.receivedQuantity >= order.quantity ? 'Received' : 'Partially Received';
    data.receipts.unshift(receipt); save(data); return receipt;
  }

  function supplierScore(supplierId) {
    const data = read();
    const orders = data.purchaseOrders.filter(item => item.supplierId === supplierId);
    const received = orders.filter(item => item.status === 'Received').length;
    return orders.length ? Math.round((received / orders.length) * 100) : 0;
  }

  function ensurePanel() {
    const main = document.querySelector('.app-main');
    if (!main) return null;
    let view = document.querySelector('[data-view-panel="procurement"]');
    if (!view) {
      view = document.createElement('section'); view.className = 'view'; view.dataset.viewPanel = 'procurement';
      view.innerHTML = '<div class="section-heading"><p class="eyebrow">Supply chain</p><h2>Procurement and suppliers</h2><p>Manage vendors, requisitions, approvals, purchase orders and goods receipts.</p></div><div data-procurement-panel></div>';
      main.insertBefore(view, document.querySelector('[data-view-panel="settings"]'));
    }
    const nav = document.querySelector('.app-nav');
    if (nav && !nav.querySelector('[data-view="procurement"]')) {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.view = 'procurement'; button.textContent = '▤ Procurement';
      nav.insertBefore(button, nav.querySelector('[data-view="settings"]'));
    }
    return view.querySelector('[data-procurement-panel]');
  }

  function render() {
    const root = ensurePanel(); if (!root) return;
    const data = read();
    const approved = data.requisitions.filter(item => item.status === 'Approved');
    const supplierOptions = data.suppliers.map(item => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join('');
    const requisitionOptions = approved.map(item => `<option value="${esc(item.id)}">${esc(item.number)} · ${esc(item.itemName)}</option>`).join('');
    const orderOptions = data.purchaseOrders.filter(item => item.status !== 'Received').map(item => `<option value="${esc(item.id)}">${esc(item.number)} · ${esc(item.itemName)}</option>`).join('');
    const pendingValue = data.requisitions.filter(item => item.status === 'Pending Approval').reduce((sum, item) => sum + item.estimatedTotal, 0);

    root.innerHTML = `
      <div class="metric-grid">
        <article class="metric-card"><span>Suppliers</span><strong>${data.suppliers.length}</strong><small>Active vendor records</small></article>
        <article class="metric-card"><span>Pending approvals</span><strong>${data.requisitions.filter(item => item.status === 'Pending Approval').length}</strong><small>${money(pendingValue)} estimated value</small></article>
        <article class="metric-card"><span>Open purchase orders</span><strong>${data.purchaseOrders.filter(item => item.status !== 'Received').length}</strong><small>Awaiting full receipt</small></article>
        <article class="metric-card"><span>Goods receipts</span><strong>${data.receipts.length}</strong><small>Completed GRN records</small></article>
      </div>
      <div class="dashboard-grid" style="margin-top:18px">
        <section class="panel"><div class="panel-head"><h3>Add supplier</h3></div><form class="form-grid" data-supplier-form>
          <label class="field"><span>Supplier name</span><input name="name" required></label><label class="field"><span>Contact</span><input name="contact"></label>
          <label class="field"><span>Email</span><input name="email" type="email"></label><label class="field"><span>Phone</span><input name="phone"></label>
          <label class="field"><span>Category</span><input name="category"></label><label class="field"><span>Payment terms</span><input name="paymentTerms"></label>
          <label class="field"><span>Rating</span><input name="rating" type="number" min="0" max="5" step="0.1"></label><button class="primary-btn" type="submit">Save supplier</button>
        </form></section>
        <section class="panel"><div class="panel-head"><h3>Create requisition</h3></div><form class="form-grid" data-requisition-form>
          <label class="field"><span>Item</span><input name="itemName" required></label><label class="field"><span>Quantity</span><input name="quantity" type="number" min="0.01" step="0.01" required></label>
          <label class="field"><span>Unit</span><input name="unit" value="units"></label><label class="field"><span>Estimated unit price</span><input name="unitPrice" type="number" min="0" step="0.01"></label>
          <label class="field"><span>Needed by</span><input name="neededBy" type="date"></label><label class="field"><span>Department</span><input name="department"></label>
          <label class="field full"><span>Justification</span><input name="justification"></label><button class="primary-btn" type="submit">Submit requisition</button>
        </form></section>
      </div>
      <div class="dashboard-grid" style="margin-top:18px">
        <section class="panel"><div class="panel-head"><h3>Create purchase order</h3></div><form class="form-grid" data-po-form>
          <label class="field"><span>Supplier</span><select name="supplierId" required><option value="">Select</option>${supplierOptions}</select></label>
          <label class="field"><span>Approved requisition</span><select name="requisitionId" required><option value="">Select</option>${requisitionOptions}</select></label>
          <label class="field"><span>Final unit price</span><input name="unitPrice" type="number" min="0" step="0.01"></label><label class="field"><span>Expected date</span><input name="expectedDate" type="date"></label>
          <button class="primary-btn" type="submit">Issue purchase order</button>
        </form></section>
        <section class="panel"><div class="panel-head"><h3>Receive goods</h3></div><form class="form-grid" data-receipt-form>
          <label class="field full"><span>Purchase order</span><select name="purchaseOrderId" required><option value="">Select</option>${orderOptions}</select></label>
          <label class="field"><span>Quantity received</span><input name="quantity" type="number" min="0.01" step="0.01" required></label>
          <label class="field"><span>Condition</span><select name="condition"><option>Accepted</option><option>Damaged</option><option>Rejected</option></select></label>
          <label class="field full"><span>Notes</span><input name="notes"></label><button class="primary-btn" type="submit">Create GRN</button>
        </form></section>
      </div>
      <section class="panel" style="margin-top:18px"><div class="panel-head"><h3>Requisitions and approvals</h3></div><div class="result-list">
        ${data.requisitions.length ? data.requisitions.map(item => `<article><strong>${esc(item.number)} · ${esc(item.itemName)}</strong><p>${esc(item.quantity)} ${esc(item.unit)} · ${money(item.estimatedTotal)} · ${esc(item.status)}</p>${item.status === 'Pending Approval' ? `<button class="secondary-btn" data-approve="${esc(item.id)}">Approve</button>` : ''}</article>`).join('') : '<div class="notice">No requisitions yet.</div>'}
      </div></section>
      <section class="panel" style="margin-top:18px"><div class="panel-head"><h3>Supplier performance</h3></div><div class="result-list">
        ${data.suppliers.length ? data.suppliers.map(item => `<article><strong>${esc(item.name)}</strong><p>${esc(item.category)} · Rating ${esc(item.rating || 'Not rated')}/5 · Fulfillment ${supplierScore(item.id)}%</p></article>`).join('') : '<div class="notice">No suppliers yet.</div>'}
      </div></section>`;

    const bind = (selector, handler) => root.querySelector(selector)?.addEventListener('submit', event => {
      event.preventDefault(); try { handler(Object.fromEntries(new FormData(event.currentTarget))); event.currentTarget.reset(); }
      catch (error) { alert(error.message); }
    });
    bind('[data-supplier-form]', addSupplier); bind('[data-requisition-form]', createRequisition);
    bind('[data-po-form]', createPurchaseOrder); bind('[data-receipt-form]', receivePurchaseOrder);
    root.querySelectorAll('[data-approve]').forEach(button => button.addEventListener('click', () => approveRequisition(button.dataset.approve)));
  }

  window.AgriSmartProcurement = Object.freeze({ read, addSupplier, createRequisition, approveRequisition, createPurchaseOrder, receivePurchaseOrder, supplierScore });
  window.addEventListener('agrismart:procurementchange', () => queueMicrotask(render));
  window.addEventListener('agrismart:extendedmodulesready', () => queueMicrotask(render));
  render();
})();