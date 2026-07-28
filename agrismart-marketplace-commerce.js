(() => {
  'use strict';

  const KEY = 'agrismart-marketplace-v1';
  const reports = window.AgriSmartReports;
  const statuses = ['Placed', 'Confirmed', 'Preparing', 'Ready for pickup', 'In transit', 'Delivered', 'Cancelled'];
  const now = () => new Date().toISOString();
  const id = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char]));

  const seed = {
    profiles: [],
    products: [
      { id:'product-maize', sellerId:'demo-farmer', sellerName:'Green Valley Farm', name:'Fresh Maize', category:'Grains', unit:'50 kg bag', price:42000, currency:'NGN', available:30, location:'Ibadan, Nigeria', description:'Freshly harvested maize supplied in clean 50 kg bags.' },
      { id:'product-tomato', sellerId:'demo-farmer', sellerName:'Green Valley Farm', name:'Premium Tomatoes', category:'Vegetables', unit:'crate', price:18500, currency:'NGN', available:20, location:'Ibadan, Nigeria', description:'Farm-fresh tomatoes suitable for retailers, restaurants and food processors.' }
    ],
    orders: [],
    messages: [],
    appointments: []
  };

  function read() {
    try {
      const stored = JSON.parse(localStorage.getItem(KEY));
      return { ...seed, ...(stored && typeof stored === 'object' ? stored : {}) };
    } catch {
      return structuredClone(seed);
    }
  }

  function write(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('agrismart:marketplacechange'));
    return data;
  }

  function currency(value, code) {
    try {
      return new Intl.NumberFormat('en-US', { style:'currency', currency:code || reports?.getCurrency?.() || 'USD', maximumFractionDigits:2 }).format(Number(value) || 0);
    } catch {
      return `${code || ''} ${(Number(value) || 0).toFixed(2)}`.trim();
    }
  }

  function activeProfile(data) {
    const activeId = localStorage.getItem('agrismart-active-market-profile');
    return data.profiles.find(profile => profile.id === activeId) || data.profiles[0] || null;
  }

  function saveProfile(formData) {
    const data = read();
    const email = String(formData.email || '').trim().toLowerCase();
    if (!formData.name || !email || !formData.role) throw new Error('Name, email and profile type are required.');
    let profile = data.profiles.find(item => item.email === email);
    if (profile) Object.assign(profile, formData, { email, updatedAt:now() });
    else {
      profile = { id:id('profile'), ...formData, email, verified:false, createdAt:now() };
      data.profiles.push(profile);
    }
    localStorage.setItem('agrismart-active-market-profile', profile.id);
    write(data);
    return profile;
  }

  function addProduct(formData) {
    const data = read();
    const seller = activeProfile(data);
    if (!seller || seller.role !== 'seller') throw new Error('Select or create a seller profile first.');
    const product = {
      id:id('product'), sellerId:seller.id, sellerName:seller.business || seller.name,
      name:String(formData.name || '').trim(), category:formData.category || 'Produce',
      unit:String(formData.unit || '').trim(), price:Number(formData.price), currency:formData.currency,
      available:Number(formData.available), location:String(formData.location || seller.location || '').trim(),
      description:String(formData.description || '').trim(), createdAt:now()
    };
    if (!product.name || !product.unit || !(product.price >= 0) || !(product.available >= 0)) throw new Error('Complete the product name, unit, price and available quantity.');
    data.products.unshift(product);
    write(data);
  }

  function placeOrder(formData) {
    const data = read();
    const buyer = activeProfile(data);
    if (!buyer || buyer.role !== 'buyer') throw new Error('Select or create a buyer profile first.');
    const product = data.products.find(item => item.id === formData.productId);
    const quantity = Number(formData.quantity);
    if (!product) throw new Error('Product not found.');
    if (!(quantity > 0) || quantity > product.available) throw new Error('Enter a valid quantity within available stock.');
    const order = {
      id:id('order'), trackingCode:`AGR-${Date.now().toString().slice(-8)}`,
      buyerId:buyer.id, buyerName:buyer.business || buyer.name,
      sellerId:product.sellerId, sellerName:product.sellerName,
      productId:product.id, productName:product.name, quantity, unit:product.unit,
      unitPrice:product.price, total:product.price * quantity, currency:product.currency,
      deliveryMethod:formData.deliveryMethod, deliveryAddress:String(formData.deliveryAddress || '').trim(),
      notes:String(formData.notes || '').trim(), status:'Placed', createdAt:now(), updatedAt:now(),
      history:[{ status:'Placed', at:now(), note:'Order submitted by buyer.' }]
    };
    data.orders.unshift(order);
    product.available -= quantity;
    write(data);
    return order;
  }

  function updateOrder(orderId, status) {
    const data = read();
    const order = data.orders.find(item => item.id === orderId);
    if (!order || !statuses.includes(status)) return;
    order.status = status;
    order.updatedAt = now();
    order.history.push({ status, at:now(), note:`Order status changed to ${status}.` });
    write(data);
  }

  function sendMessage(formData) {
    const data = read();
    const sender = activeProfile(data);
    if (!sender) throw new Error('Create a buyer or seller profile first.');
    const recipient = data.profiles.find(item => item.id === formData.recipientId);
    if (!recipient) throw new Error('Choose a recipient.');
    const body = String(formData.body || '').trim();
    if (!body) throw new Error('Enter a message.');
    data.messages.push({ id:id('message'), senderId:sender.id, senderName:sender.name, recipientId:recipient.id, recipientName:recipient.name, orderId:formData.orderId || '', body, createdAt:now(), read:false });
    write(data);
  }

  function scheduleAppointment(formData) {
    const data = read();
    const organizer = activeProfile(data);
    if (!organizer) throw new Error('Create a buyer or seller profile first.');
    const participant = data.profiles.find(item => item.id === formData.participantId);
    if (!participant) throw new Error('Choose the buyer or seller for the appointment.');
    if (!formData.date || !formData.time) throw new Error('Appointment date and time are required.');
    data.appointments.push({
      id:id('appointment'), organizerId:organizer.id, organizerName:organizer.name,
      participantId:participant.id, participantName:participant.name,
      date:formData.date, time:formData.time, type:formData.type,
      location:String(formData.location || '').trim(), notes:String(formData.notes || '').trim(),
      status:'Scheduled', createdAt:now()
    });
    write(data);
  }

  function render() {
    const root = document.querySelector('[data-marketplace-panel]');
    if (!root) return;
    const data = read();
    const profile = activeProfile(data);
    const profileOptions = data.profiles.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} — ${escapeHtml(item.role)}</option>`).join('');
    const otherProfiles = data.profiles.filter(item => !profile || item.id !== profile.id);
    const productOptions = data.products.filter(item => item.available > 0).map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} — ${escapeHtml(item.sellerName)} — ${escapeHtml(currency(item.price,item.currency))}/${escapeHtml(item.unit)}</option>`).join('');

    root.innerHTML = `
      <div class="metric-grid">
        <article class="metric-card"><span>Products</span><strong>${data.products.length}</strong><small>Available marketplace listings</small></article>
        <article class="metric-card"><span>Orders</span><strong>${data.orders.length}</strong><small>Buyer orders recorded</small></article>
        <article class="metric-card"><span>Appointments</span><strong>${data.appointments.length}</strong><small>Buyer-seller meetings</small></article>
        <article class="metric-card"><span>Messages</span><strong>${data.messages.length}</strong><small>In-app conversations</small></article>
      </div>

      <section class="panel" style="margin-top:18px">
        <div class="panel-head"><div><h3>Buyer and seller profile</h3><p>Create a marketplace identity and switch between saved profiles.</p></div><span class="chip">${profile ? escapeHtml(profile.role) : 'No active profile'}</span></div>
        <div class="dashboard-grid">
          <form class="form-grid" data-profile-form>
            <label class="field"><span>Profile type</span><select name="role" required><option value="buyer">Buyer</option><option value="seller">Seller / Farmer</option></select></label>
            <label class="field"><span>Full name</span><input name="name" required></label>
            <label class="field"><span>Business or farm</span><input name="business"></label>
            <label class="field"><span>Email</span><input name="email" type="email" required></label>
            <label class="field"><span>Phone</span><input name="phone" type="tel"></label>
            <label class="field"><span>Location</span><input name="location"></label>
            <button class="primary-btn" type="submit">Save profile</button>
          </form>
          <div>
            <label class="field"><span>Active marketplace profile</span><select data-active-profile><option value="">Select profile</option>${profileOptions}</select></label>
            <div class="notice" style="margin-top:12px">${profile ? `<strong>${escapeHtml(profile.business || profile.name)}</strong><br>${escapeHtml(profile.email)} · ${escapeHtml(profile.location || 'Location not provided')}` : 'Create a buyer or seller profile to order, list products, message users and schedule appointments.'}</div>
          </div>
        </div>
      </section>

      <div class="dashboard-grid" style="margin-top:18px">
        <section class="panel"><div class="panel-head"><div><h3>Farm products</h3><p>Buy directly from participating farmers.</p></div></div><div class="market-grid">${data.products.map(item => `<article class="market-card"><div class="market-visual">🌾</div><div class="body"><h4>${escapeHtml(item.name)}</h4><p>${escapeHtml(item.description || item.category)}</p><div class="market-meta"><span>${escapeHtml(item.available)} ${escapeHtml(item.unit)} available</span><strong>${escapeHtml(currency(item.price,item.currency))}</strong></div><small>${escapeHtml(item.sellerName)} · ${escapeHtml(item.location)}</small></div></article>`).join('') || '<div class="notice">No products listed.</div>'}</div></section>
        <section class="panel"><div class="panel-head"><h3>Place an order</h3><span class="chip">Buyer</span></div><form class="form-grid" data-order-form><label class="field full"><span>Product</span><select name="productId" required><option value="">Select farm product</option>${productOptions}</select></label><label class="field"><span>Quantity</span><input name="quantity" type="number" min="0.01" step="0.01" required></label><label class="field"><span>Delivery method</span><select name="deliveryMethod"><option>Pickup</option><option>Seller delivery</option><option>Third-party logistics</option></select></label><label class="field full"><span>Delivery address</span><input name="deliveryAddress"></label><label class="field full"><span>Order notes</span><textarea name="notes" rows="2"></textarea></label><button class="primary-btn" type="submit">Submit order</button></form></section>
      </div>

      <div class="dashboard-grid" style="margin-top:18px">
        <section class="panel"><div class="panel-head"><h3>List a farm product</h3><span class="chip">Seller</span></div><form class="form-grid" data-product-form><label class="field"><span>Product name</span><input name="name" required></label><label class="field"><span>Category</span><select name="category"><option>Grains</option><option>Vegetables</option><option>Fruits</option><option>Livestock</option><option>Processed food</option><option>Other</option></select></label><label class="field"><span>Unit</span><input name="unit" placeholder="kg, crate, bag" required></label><label class="field"><span>Unit price</span><input name="price" type="number" min="0" step="0.01" required></label><label class="field"><span>Currency</span><select name="currency">${(reports?.supportedCurrencies || ['NGN','USD','EUR','GBP']).map(code => `<option>${code}</option>`).join('')}</select></label><label class="field"><span>Available quantity</span><input name="available" type="number" min="0" step="0.01" required></label><label class="field"><span>Location</span><input name="location"></label><label class="field full"><span>Description</span><textarea name="description" rows="2"></textarea></label><button class="primary-btn" type="submit">Publish product</button></form></section>
        <section class="panel"><div class="panel-head"><div><h3>Order tracking</h3><p>Follow each order from placement to delivery.</p></div></div><div class="order-list">${data.orders.map(order => `<div class="order-item"><div><strong>${escapeHtml(order.productName)}</strong><div>${escapeHtml(order.trackingCode)} · ${escapeHtml(order.quantity)} ${escapeHtml(order.unit)} · ${escapeHtml(order.buyerName)} → ${escapeHtml(order.sellerName)}</div><small>${escapeHtml(new Date(order.createdAt).toLocaleString())}</small></div><div><strong>${escapeHtml(currency(order.total,order.currency))}</strong><br><select data-order-status="${escapeHtml(order.id)}">${statuses.map(status => `<option ${status === order.status ? 'selected' : ''}>${status}</option>`).join('')}</select></div></div>`).join('') || '<div class="notice">No orders placed yet.</div>'}</div></section>
      </div>

      <div class="dashboard-grid" style="margin-top:18px">
        <section class="panel"><div class="panel-head"><h3>Messages</h3><span class="chip">Buyer ↔ Seller</span></div><form class="form-grid" data-message-form><label class="field full"><span>Recipient</span><select name="recipientId" required><option value="">Select buyer or seller</option>${otherProfiles.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} — ${escapeHtml(item.role)}</option>`).join('')}</select></label><label class="field"><span>Related order</span><select name="orderId"><option value="">General message</option>${data.orders.map(order => `<option value="${escapeHtml(order.id)}">${escapeHtml(order.trackingCode)} — ${escapeHtml(order.productName)}</option>`).join('')}</select></label><label class="field full"><span>Message</span><textarea name="body" rows="3" required></textarea></label><button class="primary-btn" type="submit">Send message</button></form><div class="order-list" style="margin-top:16px">${data.messages.slice().reverse().map(message => `<div class="order-item"><div><strong>${escapeHtml(message.senderName)} to ${escapeHtml(message.recipientName)}</strong><div>${escapeHtml(message.body)}</div></div><small>${escapeHtml(new Date(message.createdAt).toLocaleString())}</small></div>`).join('') || '<div class="notice">No messages yet.</div>'}</div></section>
        <section class="panel"><div class="panel-head"><h3>Appointment calendar</h3><span class="chip">Schedule</span></div><form class="form-grid" data-appointment-form><label class="field full"><span>Buyer or seller</span><select name="participantId" required><option value="">Select participant</option>${otherProfiles.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} — ${escapeHtml(item.role)}</option>`).join('')}</select></label><label class="field"><span>Date</span><input name="date" type="date" required></label><label class="field"><span>Time</span><input name="time" type="time" required></label><label class="field"><span>Appointment type</span><select name="type"><option>Farm visit</option><option>Product inspection</option><option>Pickup</option><option>Delivery</option><option>Video call</option><option>Business meeting</option></select></label><label class="field"><span>Location or link</span><input name="location"></label><label class="field full"><span>Notes</span><textarea name="notes" rows="2"></textarea></label><button class="primary-btn" type="submit">Schedule appointment</button></form><div class="order-list" style="margin-top:16px">${data.appointments.slice().sort((a,b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).map(item => `<div class="order-item"><div><strong>${escapeHtml(item.type)}</strong><div>${escapeHtml(item.organizerName)} with ${escapeHtml(item.participantName)} · ${escapeHtml(item.location || 'Location to be confirmed')}</div></div><span class="chip">${escapeHtml(item.date)} ${escapeHtml(item.time)}</span></div>`).join('') || '<div class="notice">No appointments scheduled.</div>'}</div></section>
      </div>`;

    root.querySelector('[data-active-profile]')?.addEventListener('change', event => {
      localStorage.setItem('agrismart-active-market-profile', event.target.value);
      render();
    });
    root.querySelector('[data-profile-form]')?.addEventListener('submit', event => { event.preventDefault(); try { saveProfile(Object.fromEntries(new FormData(event.currentTarget))); render(); } catch (error) { alert(error.message); } });
    root.querySelector('[data-product-form]')?.addEventListener('submit', event => { event.preventDefault(); try { addProduct(Object.fromEntries(new FormData(event.currentTarget))); render(); } catch (error) { alert(error.message); } });
    root.querySelector('[data-order-form]')?.addEventListener('submit', event => { event.preventDefault(); try { const order = placeOrder(Object.fromEntries(new FormData(event.currentTarget))); alert(`Order placed. Tracking code: ${order.trackingCode}`); render(); } catch (error) { alert(error.message); } });
    root.querySelector('[data-message-form]')?.addEventListener('submit', event => { event.preventDefault(); try { sendMessage(Object.fromEntries(new FormData(event.currentTarget))); render(); } catch (error) { alert(error.message); } });
    root.querySelector('[data-appointment-form]')?.addEventListener('submit', event => { event.preventDefault(); try { scheduleAppointment(Object.fromEntries(new FormData(event.currentTarget))); render(); } catch (error) { alert(error.message); } });
    root.querySelectorAll('[data-order-status]').forEach(select => select.addEventListener('change', () => updateOrder(select.dataset.orderStatus, select.value)));
  }

  window.AgriSmartMarketplace = Object.freeze({ read, saveProfile, addProduct, placeOrder, updateOrder, sendMessage, scheduleAppointment });
  window.addEventListener('agrismart:marketplacechange', render);
  window.addEventListener('agrismart:currencychange', render);
  render();
})();