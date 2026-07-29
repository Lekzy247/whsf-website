(() => {
  'use strict';

  const KEY = 'agrismart-marketplace-v1';
  const ACTIVE_PROFILE_KEY = 'agrismart-active-market-profile';
  const appointmentStatuses = ['Scheduled', 'Confirmed', 'Completed', 'Cancelled'];

  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));

  function read() {
    try {
      const data = JSON.parse(localStorage.getItem(KEY));
      return data && typeof data === 'object' ? data : { profiles: [], products: [], orders: [], messages: [], appointments: [] };
    } catch {
      return { profiles: [], products: [], orders: [], messages: [], appointments: [] };
    }
  }

  function write(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('agrismart:marketplacechange'));
  }

  function activeProfile(data) {
    const activeId = localStorage.getItem(ACTIVE_PROFILE_KEY);
    return data.profiles?.find(profile => profile.id === activeId) || null;
  }

  function formatDateTime(value) {
    if (!value) return 'Not available';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-US');
  }

  function orderProgress(order) {
    const steps = ['Placed', 'Confirmed', 'Preparing', 'Ready for pickup', 'In transit', 'Delivered'];
    if (order.status === 'Cancelled') return 0;
    const index = steps.indexOf(order.status);
    return index < 0 ? 0 : Math.round(((index + 1) / steps.length) * 100);
  }

  function trackOrder(code) {
    const normalized = String(code || '').trim().toUpperCase();
    return read().orders?.find(order => String(order.trackingCode || '').toUpperCase() === normalized) || null;
  }

  function updateAppointment(appointmentId, status) {
    if (!appointmentStatuses.includes(status)) return false;
    const data = read();
    const appointment = data.appointments?.find(item => item.id === appointmentId);
    if (!appointment) return false;
    appointment.status = status;
    appointment.updatedAt = new Date().toISOString();
    write(data);
    return true;
  }

  function markConversationRead(profileId) {
    if (!profileId) return;
    const data = read();
    let changed = false;
    (data.messages || []).forEach(message => {
      if (message.recipientId === profileId && !message.read) {
        message.read = true;
        changed = true;
      }
    });
    if (changed) write(data);
  }

  function calendarFile(appointment) {
    const start = `${appointment.date || ''}T${appointment.time || '09:00'}:00`;
    const startDate = new Date(start);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    const stamp = date => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const text = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AgriSmart//Marketplace//EN',
      'BEGIN:VEVENT', `UID:${appointment.id}@agrismart`, `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(startDate)}`, `DTEND:${stamp(endDate)}`,
      `SUMMARY:${appointment.type || 'AgriSmart appointment'}`,
      `DESCRIPTION:${appointment.organizerName || ''} with ${appointment.participantName || ''}${appointment.notes ? ` - ${appointment.notes}` : ''}`,
      `LOCATION:${appointment.location || ''}`, 'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');
    const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `agrismart-${appointment.date || 'appointment'}.ics`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function ensureExperiencePanel() {
    const root = document.querySelector('[data-marketplace-panel]');
    if (!root) return null;
    let panel = root.querySelector('[data-marketplace-experience]');
    if (!panel) {
      panel = document.createElement('section');
      panel.className = 'panel';
      panel.dataset.marketplaceExperience = '';
      panel.style.marginTop = '18px';
      root.prepend(panel);
    }
    return panel;
  }

  function render() {
    const panel = ensureExperiencePanel();
    if (!panel) return;
    const data = read();
    const profile = activeProfile(data);
    const relatedOrders = (data.orders || []).filter(order => !profile || order.buyerId === profile.id || order.sellerId === profile.id);
    const relatedAppointments = (data.appointments || []).filter(item => !profile || item.organizerId === profile.id || item.participantId === profile.id);
    const unread = (data.messages || []).filter(message => profile && message.recipientId === profile.id && !message.read).length;
    const directory = (data.profiles || []).filter(item => !profile || item.id !== profile.id);

    panel.innerHTML = `
      <div class="panel-head"><div><h3>Marketplace command center</h3><p>Manage orders, delivery tracking, buyer-seller appointments and direct communication from one place.</p></div><span class="chip">${unread} unread</span></div>
      <div class="metric-grid">
        <article class="metric-card"><span>My orders</span><strong>${relatedOrders.length}</strong><small>Orders connected to the active profile</small></article>
        <article class="metric-card"><span>In progress</span><strong>${relatedOrders.filter(order => !['Delivered','Cancelled'].includes(order.status)).length}</strong><small>Active fulfilment and delivery</small></article>
        <article class="metric-card"><span>Appointments</span><strong>${relatedAppointments.length}</strong><small>Farm visits, inspections and meetings</small></article>
        <article class="metric-card"><span>Unread messages</span><strong>${unread}</strong><small>Buyer and seller conversations</small></article>
      </div>
      <div class="dashboard-grid" style="margin-top:18px">
        <section class="panel"><div class="panel-head"><div><h3>Track an order</h3><p>Enter the AgriSmart tracking code received after checkout.</p></div></div>
          <form class="form-grid" data-tracking-form><label class="field full"><span>Tracking code</span><input name="trackingCode" placeholder="AGR-12345678" required></label><button class="primary-btn" type="submit">Track order</button></form>
          <div data-tracking-result style="margin-top:14px"></div>
        </section>
        <section class="panel"><div class="panel-head"><div><h3>Buyer and seller directory</h3><p>View marketplace contacts before sending a message or scheduling an appointment.</p></div></div>
          <div class="order-list">${directory.length ? directory.map(item => `<div class="order-item"><div><strong>${escapeHtml(item.business || item.name)}</strong><div>${escapeHtml(item.role)} · ${escapeHtml(item.location || 'Location not provided')}</div><small>${escapeHtml(item.email || '')}${item.phone ? ` · ${escapeHtml(item.phone)}` : ''}</small></div><span class="chip">${item.verified ? 'Verified' : 'Profile'}</span></div>`).join('') : '<div class="notice">Create additional buyer or seller profiles to build the directory.</div>'}</div>
        </section>
      </div>
      <div class="dashboard-grid" style="margin-top:18px">
        <section class="panel"><div class="panel-head"><div><h3>Delivery progress</h3><p>Current status and latest milestone for active orders.</p></div></div>
          <div class="order-list">${relatedOrders.length ? relatedOrders.map(order => `<div class="order-item"><div><strong>${escapeHtml(order.productName)} · ${escapeHtml(order.trackingCode)}</strong><div>${escapeHtml(order.buyerName)} → ${escapeHtml(order.sellerName)}</div><small>Updated ${escapeHtml(formatDateTime(order.updatedAt || order.createdAt))}</small><div style="margin-top:8px"><progress max="100" value="${orderProgress(order)}" style="width:100%"></progress></div></div><span class="chip">${escapeHtml(order.status)}</span></div>`).join('') : '<div class="notice">No orders are connected to the active profile.</div>'}</div>
        </section>
        <section class="panel"><div class="panel-head"><div><h3>Upcoming appointments</h3><p>Confirm meetings and add them to an external calendar.</p></div></div>
          <div class="order-list">${relatedAppointments.length ? relatedAppointments.slice().sort((a,b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).map(item => `<div class="order-item"><div><strong>${escapeHtml(item.type || 'Appointment')}</strong><div>${escapeHtml(item.date)} ${escapeHtml(item.time)} · ${escapeHtml(item.location || 'Location to be confirmed')}</div><small>${escapeHtml(item.organizerName)} with ${escapeHtml(item.participantName)}</small></div><div><select data-appointment-status="${escapeHtml(item.id)}">${appointmentStatuses.map(status => `<option ${status === (item.status || 'Scheduled') ? 'selected' : ''}>${status}</option>`).join('')}</select><button class="secondary-btn" type="button" data-calendar-id="${escapeHtml(item.id)}" style="margin-top:6px">Add to calendar</button></div></div>`).join('') : '<div class="notice">No appointments are connected to the active profile.</div>'}</div>
        </section>
      </div>`;

    panel.querySelector('[data-tracking-form]')?.addEventListener('submit', event => {
      event.preventDefault();
      const result = trackOrder(new FormData(event.currentTarget).get('trackingCode'));
      const target = panel.querySelector('[data-tracking-result]');
      target.innerHTML = result ? `<div class="notice"><strong>${escapeHtml(result.productName)} — ${escapeHtml(result.status)}</strong><br>${escapeHtml(result.trackingCode)} · ${escapeHtml(result.quantity)} ${escapeHtml(result.unit)}<br>${escapeHtml(result.buyerName)} → ${escapeHtml(result.sellerName)}<br>Last updated: ${escapeHtml(formatDateTime(result.updatedAt || result.createdAt))}</div>` : '<div class="notice">No order was found with that tracking code.</div>';
    });

    panel.querySelectorAll('[data-appointment-status]').forEach(select => select.addEventListener('change', () => updateAppointment(select.dataset.appointmentStatus, select.value)));
    panel.querySelectorAll('[data-calendar-id]').forEach(button => button.addEventListener('click', () => {
      const appointment = data.appointments.find(item => item.id === button.dataset.calendarId);
      if (appointment) calendarFile(appointment);
    }));

    if (profile) markConversationRead(profile.id);
  }

  window.AgriSmartMarketplaceExperience = Object.freeze({ trackOrder, updateAppointment, markConversationRead });
  window.addEventListener('agrismart:marketplacechange', () => queueMicrotask(render));
  window.addEventListener('agrismart:extendedmodulesready', () => queueMicrotask(render));
  render();
})();