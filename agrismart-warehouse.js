(() => {
  'use strict';

  const KEY = 'agrismart-warehouse-v1';
  const id = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const read = () => {
    try { return { warehouses: [], stock: [], movements: [], ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
    catch { return { warehouses: [], stock: [], movements: [] }; }
  };
  const save = data => {
    localStorage.setItem(KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('agrismart:warehousechange'));
    return data;
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function addWarehouse(input) {
    const data = read();
    const warehouse = {
      id: id('wh'), name: String(input.name || '').trim(),
      code: String(input.code || `WH-${data.warehouses.length + 1}`).trim().toUpperCase(),
      location: String(input.location || '').trim(), manager: String(input.manager || '').trim(),
      capacity: Number(input.capacity || 0), coldStorage: input.coldStorage === 'on', createdAt: new Date().toISOString()
    };
    if (!warehouse.name) throw new Error('Warehouse name is required.');
    if (data.warehouses.some(item => item.code === warehouse.code)) throw new Error('Warehouse code already exists.');
    data.warehouses.push(warehouse);
    save(data);
    return warehouse;
  }

  function receiveStock(input) {
    const data = read();
    const quantity = Number(input.quantity || 0);
    if (!data.warehouses.some(item => item.id === input.warehouseId)) throw new Error('Select a warehouse.');
    if (!input.itemName || quantity <= 0) throw new Error('Enter an item and valid quantity.');
    const stock = {
      id: id('stock'), warehouseId: input.warehouseId, itemName: String(input.itemName).trim(),
      category: input.category || 'Produce', quantity, unit: input.unit || 'kg',
      batchNumber: String(input.batchNumber || `B-${Date.now().toString().slice(-6)}`).trim(),
      expiryDate: input.expiryDate || '', minimumLevel: Number(input.minimumLevel || 0),
      binLocation: String(input.binLocation || '').trim(), updatedAt: new Date().toISOString()
    };
    data.stock.push(stock);
    data.movements.unshift({ id: id('move'), type: 'Receipt', stockId: stock.id, quantity, createdAt: new Date().toISOString() });
    save(data);
    return stock;
  }

  function adjustStock(stockId, quantity, type, destinationId = '') {
    const data = read();
    const stock = data.stock.find(item => item.id === stockId);
    quantity = Number(quantity || 0);
    if (!stock || quantity <= 0 || quantity > stock.quantity) throw new Error('Invalid stock quantity.');
    const sourceWarehouseId = stock.warehouseId;
    stock.quantity -= quantity;
    if (type === 'Transfer') {
      if (!destinationId || destinationId === sourceWarehouseId) throw new Error('Select a different destination.');
      data.stock.push({ ...stock, id: id('stock'), warehouseId: destinationId, quantity, updatedAt: new Date().toISOString() });
    }
    data.movements.unshift({ id: id('move'), type, stockId, quantity, sourceWarehouseId, destinationId, createdAt: new Date().toISOString() });
    data.stock = data.stock.filter(item => item.quantity > 0);
    save(data);
  }

  function ensurePanel() {
    const main = document.querySelector('.app-main');
    if (!main) return null;
    let view = document.querySelector('[data-view-panel="warehouse"]');
    if (!view) {
      view = document.createElement('section');
      view.className = 'view';
      view.dataset.viewPanel = 'warehouse';
      view.innerHTML = '<div class="section-heading"><p class="eyebrow">Inventory control</p><h2>Warehouse management</h2><p>Manage facilities, batches, receipts, transfers and stock issues.</p></div><div data-warehouse-panel></div>';
      main.insertBefore(view, document.querySelector('[data-view-panel="settings"]'));
    }
    const nav = document.querySelector('.app-nav');
    if (nav && !nav.querySelector('[data-view="warehouse"]')) {
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.view = 'warehouse'; button.textContent = '▦ Warehouse';
      nav.insertBefore(button, nav.querySelector('[data-view="settings"]'));
    }
    return view.querySelector('[data-warehouse-panel]');
  }

  function render() {
    const root = ensurePanel();
    if (!root) return;
    const data = read();
    const warehouseOptions = data.warehouses.map(item => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join('');
    const stockOptions = data.stock.map(item => `<option value="${esc(item.id)}">${esc(item.itemName)} · ${esc(item.quantity)} ${esc(item.unit)}</option>`).join('');
    const lowStock = data.stock.filter(item => item.minimumLevel && item.quantity <= item.minimumLevel).length;

    root.innerHTML = `
      <div class="metric-grid">
        <article class="metric-card"><span>Warehouses</span><strong>${data.warehouses.length}</strong><small>Registered facilities</small></article>
        <article class="metric-card"><span>Stock batches</span><strong>${data.stock.length}</strong><small>Active inventory batches</small></article>
        <article class="metric-card"><span>Low stock</span><strong>${lowStock}</strong><small>At or below minimum level</small></article>
        <article class="metric-card"><span>Movements</span><strong>${data.movements.length}</strong><small>Receipts, transfers and issues</small></article>
      </div>
      <div class="dashboard-grid" style="margin-top:18px">
        <section class="panel"><div class="panel-head"><h3>Add warehouse</h3></div>
          <form class="form-grid" data-wh-form>
            <label class="field"><span>Name</span><input name="name" required></label>
            <label class="field"><span>Code</span><input name="code"></label>
            <label class="field"><span>Location</span><input name="location"></label>
            <label class="field"><span>Manager</span><input name="manager"></label>
            <label class="field"><span>Capacity</span><input name="capacity" type="number" min="0"></label>
            <label class="field"><span><input name="coldStorage" type="checkbox"> Cold storage</span></label>
            <button class="primary-btn" type="submit">Save warehouse</button>
          </form>
        </section>
        <section class="panel"><div class="panel-head"><h3>Receive stock</h3></div>
          <form class="form-grid" data-stock-form>
            <label class="field"><span>Warehouse</span><select name="warehouseId" required><option value="">Select</option>${warehouseOptions}</select></label>
            <label class="field"><span>Item</span><input name="itemName" required></label>
            <label class="field"><span>Category</span><select name="category"><option>Produce</option><option>Seed</option><option>Fertilizer</option><option>Feed</option><option>Packaging</option></select></label>
            <label class="field"><span>Quantity</span><input name="quantity" type="number" min="0.01" step="0.01" required></label>
            <label class="field"><span>Unit</span><select name="unit"><option>kg</option><option>tonnes</option><option>bags</option><option>crates</option><option>litres</option><option>units</option></select></label>
            <label class="field"><span>Batch</span><input name="batchNumber"></label>
            <label class="field"><span>Expiry date</span><input name="expiryDate" type="date"></label>
            <label class="field"><span>Minimum level</span><input name="minimumLevel" type="number" min="0"></label>
            <label class="field"><span>Bin location</span><input name="binLocation"></label>
            <button class="primary-btn" type="submit">Receive stock</button>
          </form>
        </section>
      </div>
      <div class="dashboard-grid" style="margin-top:18px">
        <section class="panel"><div class="panel-head"><h3>Transfer stock</h3></div>
          <form class="form-grid" data-transfer-form>
            <label class="field full"><span>Stock</span><select name="stockId" required><option value="">Select</option>${stockOptions}</select></label>
            <label class="field"><span>Destination</span><select name="destinationId" required><option value="">Select</option>${warehouseOptions}</select></label>
            <label class="field"><span>Quantity</span><input name="quantity" type="number" min="0.01" step="0.01" required></label>
            <button class="primary-btn" type="submit">Transfer</button>
          </form>
        </section>
        <section class="panel"><div class="panel-head"><h3>Issue stock</h3></div>
          <form class="form-grid" data-issue-form>
            <label class="field full"><span>Stock</span><select name="stockId" required><option value="">Select</option>${stockOptions}</select></label>
            <label class="field"><span>Quantity</span><input name="quantity" type="number" min="0.01" step="0.01" required></label>
            <button class="primary-btn" type="submit">Issue</button>
          </form>
        </section>
      </div>
      <section class="panel" style="margin-top:18px"><div class="panel-head"><h3>Current inventory</h3></div>
        <div class="result-list">${data.stock.length ? data.stock.map(item => `<article><strong>${esc(item.itemName)}</strong><p>${esc(item.batchNumber)} · ${esc(item.quantity)} ${esc(item.unit)} · ${esc(data.warehouses.find(w => w.id === item.warehouseId)?.name || '')}</p></article>`).join('') : '<div class="notice">No stock recorded.</div>'}</div>
      </section>`;

    const bind = (selector, handler) => root.querySelector(selector)?.addEventListener('submit', event => {
      event.preventDefault();
      try { handler(Object.fromEntries(new FormData(event.currentTarget))); event.currentTarget.reset(); }
      catch (error) { alert(error.message); }
    });
    bind('[data-wh-form]', addWarehouse);
    bind('[data-stock-form]', receiveStock);
    bind('[data-transfer-form]', input => adjustStock(input.stockId, input.quantity, 'Transfer', input.destinationId));
    bind('[data-issue-form]', input => adjustStock(input.stockId, input.quantity, 'Issue'));
  }

  window.AgriSmartWarehouse = Object.freeze({ read, addWarehouse, receiveStock, transferStock: (id, qty, destination) => adjustStock(id, qty, 'Transfer', destination), issueStock: (id, qty) => adjustStock(id, qty, 'Issue') });
  window.addEventListener('agrismart:warehousechange', () => queueMicrotask(render));
  window.addEventListener('agrismart:extendedmodulesready', () => queueMicrotask(render));
  render();
})();