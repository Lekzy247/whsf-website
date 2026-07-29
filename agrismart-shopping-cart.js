(() => {
  'use strict';

  const MARKET_KEY = 'agrismart-marketplace-v1';
  const CART_KEY = 'agrismart-marketplace-cart-v1';
  const ACTIVE_PROFILE_KEY = 'agrismart-active-market-profile';

  const id = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const now = () => new Date().toISOString();
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));

  function readMarket() {
    try {
      const data = JSON.parse(localStorage.getItem(MARKET_KEY));
      return data && typeof data === 'object' ? data : { profiles: [], products: [], orders: [], messages: [], appointments: [] };
    } catch {
      return { profiles: [], products: [], orders: [], messages: [], appointments: [] };
    }
  }

  function writeMarket(data) {
    localStorage.setItem(MARKET_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('agrismart:marketplacechange'));
  }

  function readCart() {
    try {
      const cart = JSON.parse(localStorage.getItem(CART_KEY));
      return Array.isArray(cart) ? cart : [];
    } catch {
      return [];
    }
  }

  function writeCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    window.dispatchEvent(new CustomEvent('agrismart:cartchange'));
  }

  function activeBuyer(data) {
    const activeId = localStorage.getItem(ACTIVE_PROFILE_KEY);
    const profile = data.profiles?.find(item => item.id === activeId);
    return profile?.role === 'buyer' ? profile : null;
  }

  function money(value, currency) {
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(Number(value) || 0);
    } catch {
      return `${currency || ''} ${(Number(value) || 0).toFixed(2)}`.trim();
    }
  }

  function addToCart(productId, quantity = 1) {
    const data = readMarket();
    const product = data.products?.find(item => item.id === productId);
    const amount = Number(quantity);
    if (!product) throw new Error('Product not found.');
    if (!(amount > 0) || amount > Number(product.available || 0)) throw new Error('Choose a quantity within available stock.');
    const cart = readCart();
    const existing = cart.find(item => item.productId === productId);
    if (existing) existing.quantity = Math.min(Number(product.available || 0), Number(existing.quantity || 0) + amount);
    else cart.push({ productId, quantity: amount, addedAt: now() });
    writeCart(cart);
  }

  function updateQuantity(productId, quantity) {
    const data = readMarket();
    const product = data.products?.find(item => item.id === productId);
    const cart = readCart();
    const item = cart.find(entry => entry.productId === productId);
    if (!item || !product) return;
    const amount = Number(quantity);
    if (!(amount > 0)) return removeFromCart(productId);
    item.quantity = Math.min(amount, Number(product.available || 0));
    writeCart(cart);
  }

  function removeFromCart(productId) {
    writeCart(readCart().filter(item => item.productId !== productId));
  }

  function checkout(formData) {
    const data = readMarket();
    const buyer = activeBuyer(data);
    if (!buyer) throw new Error('Select or create a buyer profile before checkout.');
    const cart = readCart();
    if (!cart.length) throw new Error('Your cart is empty.');

    const groupedBySeller = new Map();
    cart.forEach(item => {
      const product = data.products?.find(entry => entry.id === item.productId);
      if (!product) throw new Error('A product in your cart is no longer available.');
      if (Number(item.quantity) > Number(product.available || 0)) throw new Error(`${product.name} no longer has enough stock.`);
      const key = product.sellerId || product.sellerName;
      if (!groupedBySeller.has(key)) groupedBySeller.set(key, []);
      groupedBySeller.get(key).push({ product, quantity: Number(item.quantity) });
    });

    const created = [];
    groupedBySeller.forEach(items => {
      const first = items[0].product;
      const currency = first.currency || 'USD';
      const total = items.reduce((sum, item) => sum + Number(item.product.price || 0) * item.quantity, 0);
      const order = {
        id: id('order'),
        trackingCode: `AGR-${Date.now().toString().slice(-8)}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
        buyerId: buyer.id,
        buyerName: buyer.business || buyer.name,
        sellerId: first.sellerId,
        sellerName: first.sellerName,
        productId: first.id,
        productName: items.length === 1 ? first.name : `${items.length} farm products`,
        quantity: items.reduce((sum, item) => sum + item.quantity, 0),
        unit: items.length === 1 ? first.unit : 'items',
        unitPrice: items.length === 1 ? Number(first.price || 0) : total,
        total,
        currency,
        items: items.map(item => ({
          productId: item.product.id,
          productName: item.product.name,
          quantity: item.quantity,
          unit: item.product.unit,
          unitPrice: Number(item.product.price || 0),
          total: Number(item.product.price || 0) * item.quantity
        })),
        deliveryMethod: formData.deliveryMethod || 'Pickup',
        deliveryAddress: String(formData.deliveryAddress || '').trim(),
        requestedDate: formData.requestedDate || '',
        notes: String(formData.notes || '').trim(),
        status: 'Placed',
        createdAt: now(),
        updatedAt: now(),
        history: [{ status: 'Placed', at: now(), note: 'Multi-product order submitted by buyer.' }]
      };
      items.forEach(item => { item.product.available = Number(item.product.available || 0) - item.quantity; });
      data.orders.unshift(order);
      created.push(order);
    });

    writeMarket(data);
    writeCart([]);
    return created;
  }

  function ensurePanel() {
    const root = document.querySelector('[data-marketplace-panel]');
    if (!root) return null;
    let panel = root.querySelector('[data-shopping-cart-panel]');
    if (!panel) {
      panel = document.createElement('section');
      panel.className = 'panel';
      panel.dataset.shoppingCartPanel = '';
      panel.style.marginTop = '18px';
      root.appendChild(panel);
    }
    return panel;
  }

  function render() {
    const panel = ensurePanel();
    if (!panel) return;
    const data = readMarket();
    const buyer = activeBuyer(data);
    const cart = readCart();
    const items = cart.map(entry => ({ ...entry, product: data.products?.find(product => product.id === entry.productId) })).filter(item => item.product);
    const total = items.reduce((sum, item) => sum + Number(item.product.price || 0) * Number(item.quantity || 0), 0);
    const currency = items[0]?.product.currency || 'USD';

    panel.innerHTML = `
      <div class="panel-head"><div><h3>Shopping cart and checkout</h3><p>Buy multiple farm products and submit grouped orders to each farmer or seller.</p></div><span class="chip">${items.length} product${items.length === 1 ? '' : 's'}</span></div>
      <div class="dashboard-grid">
        <div>
          <div class="order-list">${items.length ? items.map(item => `<div class="order-item"><div><strong>${escapeHtml(item.product.name)}</strong><div>${escapeHtml(item.product.sellerName)} · ${escapeHtml(money(item.product.price, item.product.currency))}/${escapeHtml(item.product.unit)}</div><small>${escapeHtml(item.product.available)} available</small></div><div><input aria-label="Quantity for ${escapeHtml(item.product.name)}" data-cart-quantity="${escapeHtml(item.productId)}" type="number" min="1" max="${escapeHtml(item.product.available)}" step="0.01" value="${escapeHtml(item.quantity)}" style="width:90px"><button class="secondary-btn" type="button" data-remove-cart="${escapeHtml(item.productId)}" style="margin-left:6px">Remove</button></div></div>`).join('') : '<div class="notice">Your shopping cart is empty. Add products from the marketplace listings.</div>'}</div>
          <div class="notice" style="margin-top:12px"><strong>Estimated total: ${escapeHtml(money(total, currency))}</strong><br>Orders are separated automatically when products come from different sellers.</div>
        </div>
        <form class="form-grid" data-cart-checkout-form>
          <label class="field"><span>Delivery method</span><select name="deliveryMethod"><option>Pickup</option><option>Seller delivery</option><option>Third-party logistics</option></select></label>
          <label class="field"><span>Requested delivery or pickup date</span><input name="requestedDate" type="date"></label>
          <label class="field full"><span>Delivery address</span><input name="deliveryAddress"></label>
          <label class="field full"><span>Order notes</span><textarea name="notes" rows="3"></textarea></label>
          <button class="primary-btn" type="submit" ${items.length && buyer ? '' : 'disabled'}>Checkout cart</button>
          <div class="notice">${buyer ? `Ordering as ${escapeHtml(buyer.business || buyer.name)}.` : 'Activate a buyer profile to complete checkout.'}</div>
        </form>
      </div>`;

    panel.querySelectorAll('[data-cart-quantity]').forEach(input => input.addEventListener('change', () => updateQuantity(input.dataset.cartQuantity, input.value)));
    panel.querySelectorAll('[data-remove-cart]').forEach(button => button.addEventListener('click', () => removeFromCart(button.dataset.removeCart)));
    panel.querySelector('[data-cart-checkout-form]')?.addEventListener('submit', event => {
      event.preventDefault();
      try {
        const orders = checkout(Object.fromEntries(new FormData(event.currentTarget)));
        alert(`Order submitted successfully. ${orders.map(order => order.trackingCode).join(', ')}`);
      } catch (error) {
        alert(error.message);
      }
    });

    document.querySelectorAll('[data-marketplace-panel] .market-card').forEach(card => {
      if (card.querySelector('[data-add-cart]')) return;
      const productName = card.querySelector('h4')?.textContent?.trim();
      const product = data.products?.find(item => item.name === productName);
      if (!product) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'secondary-btn';
      button.dataset.addCart = product.id;
      button.textContent = 'Add to cart';
      button.style.marginTop = '10px';
      button.addEventListener('click', () => {
        try { addToCart(product.id, 1); } catch (error) { alert(error.message); }
      });
      card.querySelector('.body')?.appendChild(button);
    });
  }

  window.AgriSmartShoppingCart = Object.freeze({ readCart, addToCart, updateQuantity, removeFromCart, checkout });
  window.addEventListener('agrismart:cartchange', () => queueMicrotask(render));
  window.addEventListener('agrismart:marketplacechange', () => queueMicrotask(render));
  window.addEventListener('agrismart:extendedmodulesready', () => queueMicrotask(render));
  render();
})();