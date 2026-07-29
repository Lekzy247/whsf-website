(() => {
  'use strict';

  const STORAGE_KEY = 'agrismart-marketplace-requests-v1';
  const marketplace = document.querySelector('[data-view-panel="marketplace"]');
  if (!marketplace) return;

  const listings = [
    {
      id: 'maize-seed',
      name: 'Improved maize seed',
      category: 'Input',
      action: 'Request quote'
    },
    {
      id: 'solar-irrigation',
      name: 'Solar irrigation kit',
      category: 'Equipment',
      action: 'Request quote'
    },
    {
      id: 'produce-logistics',
      name: 'Produce logistics',
      category: 'Service',
      action: 'Connect'
    }
  ];

  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[character]));

  function readRequests() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function writeRequests(requests) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
    window.dispatchEvent(new CustomEvent('agrismart:marketplacechange', { detail: requests }));
  }

  function notify(message, type = 'success') {
    let container = document.querySelector('.agrismart-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'agrismart-toast-container';
      Object.assign(container.style, {
        position: 'fixed',
        right: '18px',
        bottom: '84px',
        zIndex: '9999',
        display: 'grid',
        gap: '10px',
        maxWidth: '360px'
      });
      document.body.appendChild(container);
    }

    const item = document.createElement('div');
    item.setAttribute('role', 'status');
    item.setAttribute('aria-live', 'polite');
    item.textContent = message;
    Object.assign(item.style, {
      padding: '13px 16px',
      borderRadius: '12px',
      color: '#fff',
      background: type === 'error' ? '#a52a2a' : '#0d4d35',
      boxShadow: '0 12px 32px rgba(0,0,0,.2)',
      fontWeight: '700'
    });
    container.appendChild(item);
    setTimeout(() => item.remove(), 3400);
  }

  function enhanceListings() {
    const cards = [...marketplace.querySelectorAll('.market-card')];
    cards.forEach((card, index) => {
      const listing = listings[index];
      if (!listing || card.querySelector('[data-marketplace-request]')) return;

      const meta = card.querySelector('.market-meta');
      if (!meta) return;

      const existingAction = meta.querySelector('strong');
      existingAction?.remove();

      const button = document.createElement('button');
      button.className = 'primary-btn';
      button.type = 'button';
      button.dataset.marketplaceRequest = listing.id;
      button.textContent = listing.action;
      meta.appendChild(button);
    });
  }

  function buildWorkspace() {
    if (marketplace.querySelector('[data-marketplace-workspace]')) return;

    const workspace = document.createElement('div');
    workspace.dataset.marketplaceWorkspace = '';
    workspace.className = 'dashboard-grid';
    workspace.style.marginTop = '18px';
    workspace.innerHTML = `
      <section class="panel">
        <div class="panel-head">
          <div>
            <h3>Send a marketplace request</h3>
            <p>Request a quote or ask a supplier or service provider to contact you.</p>
          </div>
          <span class="chip">Active</span>
        </div>
        <form class="form-grid" data-marketplace-form>
          <label class="field full">
            <span>Listing</span>
            <select name="listingId" required>
              <option value="">Select a listing</option>
              ${listings.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('')}
            </select>
          </label>
          <label class="field">
            <span>Your name</span>
            <input name="contactName" autocomplete="name" required>
          </label>
          <label class="field">
            <span>Phone or email</span>
            <input name="contact" autocomplete="email" required>
          </label>
          <label class="field">
            <span>Quantity or service need</span>
            <input name="quantity" placeholder="Example: 10 bags or 2-acre installation">
          </label>
          <label class="field">
            <span>Location</span>
            <input name="location" autocomplete="address-level2" required>
          </label>
          <label class="field full">
            <span>Message</span>
            <textarea name="message" rows="3" placeholder="Add delivery timing, specifications or questions."></textarea>
          </label>
          <button class="primary-btn" type="submit">Submit request</button>
        </form>
      </section>
      <section class="panel">
        <div class="panel-head">
          <div>
            <h3>Your requests</h3>
            <p>Saved on this device for follow-up.</p>
          </div>
          <button class="secondary-btn" type="button" data-marketplace-export>Export CSV</button>
        </div>
        <div class="order-list" data-marketplace-request-list></div>
      </section>
    `;
    marketplace.appendChild(workspace);
  }

  function renderRequests() {
    const target = marketplace.querySelector('[data-marketplace-request-list]');
    if (!target) return;

    const requests = readRequests();
    target.innerHTML = requests.length
      ? requests.slice().reverse().map(request => `
          <div class="order-item">
            <div>
              <strong>${escapeHtml(request.listingName)}</strong>
              <div>${escapeHtml(request.contactName)} · ${escapeHtml(request.location)} · ${escapeHtml(request.createdAt.slice(0, 10))}</div>
              <small>${escapeHtml(request.quantity || request.message || 'General inquiry')}</small>
            </div>
            <div>
              <span class="chip">${escapeHtml(request.status)}</span>
              <button class="secondary-btn" type="button" data-marketplace-remove="${escapeHtml(request.id)}">Remove</button>
            </div>
          </div>
        `).join('')
      : '<div class="notice">No marketplace requests submitted yet.</div>';
  }

  function selectListing(listingId) {
    const form = marketplace.querySelector('[data-marketplace-form]');
    const select = form?.elements?.listingId;
    if (!select) return;
    select.value = listingId;
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    select.focus();
  }

  function submitRequest(form) {
    const data = Object.fromEntries(new FormData(form));
    const listing = listings.find(item => item.id === data.listingId);
    if (!listing) {
      notify('Select a valid marketplace listing.', 'error');
      return;
    }

    const request = {
      id: `request-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      listingId: listing.id,
      listingName: listing.name,
      category: listing.category,
      contactName: String(data.contactName || '').trim(),
      contact: String(data.contact || '').trim(),
      quantity: String(data.quantity || '').trim(),
      location: String(data.location || '').trim(),
      message: String(data.message || '').trim(),
      status: 'Pending',
      createdAt: new Date().toISOString()
    };

    const requests = readRequests();
    requests.push(request);
    writeRequests(requests);
    form.reset();
    renderRequests();
    notify('Marketplace request saved for follow-up.');
  }

  function exportRequests() {
    const requests = readRequests();
    if (!requests.length) {
      notify('There are no marketplace requests to export.', 'error');
      return;
    }

    const headers = ['Listing', 'Category', 'Name', 'Contact', 'Quantity or need', 'Location', 'Message', 'Status', 'Created'];
    const rows = requests.map(item => [
      item.listingName,
      item.category,
      item.contactName,
      item.contact,
      item.quantity,
      item.location,
      item.message,
      item.status,
      item.createdAt
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `agrismart-marketplace-requests-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }

  enhanceListings();
  buildWorkspace();
  renderRequests();

  marketplace.addEventListener('submit', event => {
    const form = event.target.closest('[data-marketplace-form]');
    if (!form) return;
    event.preventDefault();
    submitRequest(form);
  });

  marketplace.addEventListener('click', event => {
    const requestButton = event.target.closest('[data-marketplace-request]');
    if (requestButton) selectListing(requestButton.dataset.marketplaceRequest);

    const removeButton = event.target.closest('[data-marketplace-remove]');
    if (removeButton && confirm('Remove this marketplace request?')) {
      writeRequests(readRequests().filter(item => item.id !== removeButton.dataset.marketplaceRemove));
      renderRequests();
      notify('Marketplace request removed.');
    }

    if (event.target.closest('[data-marketplace-export]')) exportRequests();
  });
})();