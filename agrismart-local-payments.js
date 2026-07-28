(() => {
  'use strict';

  const STORE_KEY = 'agrismart-payments-v1';
  const CONFIG_KEY = 'agrismart-payment-config-v1';
  const marketplace = () => window.AgriSmartMarketplace?.read?.() || { orders: [] };
  const settings = () => window.AgriSmartSettings?.get?.() || { country: 'NG' };
  const id = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char]));

  const methodsByCountry = Object.freeze({
    NG: [
      ['card', 'Debit/Credit Card', 'gateway'], ['bank_transfer', 'Bank Transfer', 'manual'],
      ['ussd', 'USSD', 'gateway'], ['mobile_money', 'Mobile Money', 'gateway'],
      ['cash_delivery', 'Cash on Delivery', 'manual']
    ],
    GH: [['mobile_money','Mobile Money','gateway'],['card','Card','gateway'],['bank_transfer','Bank Transfer','manual'],['cash_delivery','Cash on Delivery','manual']],
    MW: [['mobile_money','Airtel Money / TNM Mpamba','gateway'],['card','Card','gateway'],['bank_transfer','Bank Transfer','manual'],['cash_delivery','Cash on Delivery','manual']],
    SL: [['mobile_money','Orange Money / Afrimoney','gateway'],['card','Card','gateway'],['bank_transfer','Bank Transfer','manual'],['cash_delivery','Cash on Delivery','manual']],
    ZA: [['instant_eft','Instant EFT','gateway'],['card','Card','gateway'],['bank_transfer','Bank Transfer','manual'],['cash_delivery','Cash on Delivery','manual']],
    SN: [['mobile_money','Mobile Money','gateway'],['card','Card','gateway'],['bank_transfer','Bank Transfer','manual'],['cash_delivery','Cash on Delivery','manual']],
    CI: [['mobile_money','Mobile Money','gateway'],['card','Card','gateway'],['bank_transfer','Bank Transfer','manual'],['cash_delivery','Cash on Delivery','manual']],
    US: [['card','Card','gateway'],['bank_transfer','ACH / Bank Transfer','manual'],['digital_wallet','Digital Wallet','gateway'],['cash_delivery','Cash on Delivery','manual']],
    CA: [['card','Card','gateway'],['bank_transfer','Interac / Bank Transfer','manual'],['digital_wallet','Digital Wallet','gateway'],['cash_delivery','Cash on Delivery','manual']],
    GB: [['card','Card','gateway'],['bank_transfer','Bank Transfer','manual'],['digital_wallet','Digital Wallet','gateway'],['cash_delivery','Cash on Delivery','manual']],
    IE: [['card','Card','gateway'],['bank_transfer','SEPA Bank Transfer','manual'],['digital_wallet','Digital Wallet','gateway'],['cash_delivery','Cash on Delivery','manual']],
    AU: [['card','Card','gateway'],['bank_transfer','Bank Transfer','manual'],['digital_wallet','Digital Wallet','gateway'],['cash_delivery','Cash on Delivery','manual']]
  });

  const defaultMethods = [['card','Card','gateway'],['bank_transfer','Bank Transfer','manual'],['mobile_money','Mobile Money','gateway'],['cash_delivery','Cash on Delivery','manual']];

  const providerCatalog = Object.freeze({
    paystack: { name:'Paystack', countries:['NG','GH','ZA'], methods:['card','bank_transfer','ussd','mobile_money'] },
    flutterwave: { name:'Flutterwave', countries:['NG','GH','MW','SL','ZA','UG','TZ','RW'], methods:['card','bank_transfer','ussd','mobile_money'] },
    stripe: { name:'Stripe', countries:['US','CA','GB','IE','AU','ZA'], methods:['card','bank_transfer','digital_wallet'] },
    paypal: { name:'PayPal', countries:['US','CA','GB','IE','AU','NG','GH','MW','SL','ZA'], methods:['digital_wallet','card'] },
    manual: { name:'Manual / Offline', countries:['*'], methods:['bank_transfer','cash_delivery','mobile_money'] }
  });

  function readPayments() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
    catch { return []; }
  }

  function writePayments(payments) {
    localStorage.setItem(STORE_KEY, JSON.stringify(payments));
    window.dispatchEvent(new CustomEvent('agrismart:paymentchange'));
  }

  function readConfig() {
    try {
      return { provider:'manual', merchantName:'', bankName:'', accountName:'', accountNumber:'', mobileMoneyNumber:'', paymentInstructions:'', ...(JSON.parse(localStorage.getItem(CONFIG_KEY)) || {}) };
    } catch {
      return { provider:'manual', merchantName:'', bankName:'', accountName:'', accountNumber:'', mobileMoneyNumber:'', paymentInstructions:'' };
    }
  }

  function saveConfig(input) {
    const config = { ...readConfig(), ...input };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent('agrismart:paymentchange'));
    return config;
  }

  function methodsForCountry(country) {
    return methodsByCountry[country] || defaultMethods;
  }

  function createPayment(input) {
    const market = marketplace();
    const order = market.orders.find(item => item.id === input.orderId);
    if (!order) throw new Error('Select a valid order.');
    const methods = methodsForCountry(settings().country);
    const selected = methods.find(([code]) => code === input.method);
    if (!selected) throw new Error('Select a valid local payment method.');
    const config = readConfig();
    const isConfiguredGateway = selected[2] === 'gateway' && config.provider !== 'manual';
    const payment = {
      id:id('payment'), reference:`PAY-${Date.now().toString().slice(-10)}`,
      orderId:order.id, trackingCode:order.trackingCode, buyerName:order.buyerName,
      sellerName:order.sellerName, amount:order.total, currency:order.currency,
      country:settings().country, method:selected[0], methodLabel:selected[1],
      provider:isConfiguredGateway ? config.provider : 'manual',
      status:selected[0] === 'cash_delivery' ? 'Pay on delivery' : 'Pending verification',
      payerReference:String(input.payerReference || '').trim(), notes:String(input.notes || '').trim(),
      createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(),
      audit:[{ status:'Created', at:new Date().toISOString() }]
    };
    const payments = readPayments();
    payments.unshift(payment);
    writePayments(payments);
    return payment;
  }

  function updateStatus(paymentId, status) {
    const payments = readPayments();
    const payment = payments.find(item => item.id === paymentId);
    if (!payment) return;
    payment.status = status;
    payment.updatedAt = new Date().toISOString();
    payment.audit.push({ status, at:payment.updatedAt });
    writePayments(payments);
  }

  function money(value, code) {
    try { return new Intl.NumberFormat('en-US', { style:'currency', currency:code }).format(Number(value) || 0); }
    catch { return `${code} ${(Number(value) || 0).toFixed(2)}`; }
  }

  function ensureMount() {
    const marketplaceRoot = document.querySelector('[data-marketplace-panel]');
    if (!marketplaceRoot) return null;
    let mount = marketplaceRoot.querySelector('[data-local-payment-panel]');
    if (!mount) {
      mount = document.createElement('section');
      mount.className = 'panel';
      mount.style.marginTop = '18px';
      mount.dataset.localPaymentPanel = '';
      marketplaceRoot.appendChild(mount);
    }
    return mount;
  }

  function render() {
    const root = ensureMount();
    if (!root) return;
    const country = settings().country;
    const methods = methodsForCountry(country);
    const market = marketplace();
    const payments = readPayments();
    const config = readConfig();
    const provider = providerCatalog[config.provider] || providerCatalog.manual;
    const orderOptions = market.orders.map(order => `<option value="${escapeHtml(order.id)}">${escapeHtml(order.trackingCode)} — ${escapeHtml(order.productName)} — ${escapeHtml(money(order.total, order.currency))}</option>`).join('');

    root.innerHTML = `
      <div class="panel-head"><div><h3>Local payments</h3><p>Country-aware checkout methods for buyer orders.</p></div><span class="chip">${escapeHtml(country)}</span></div>
      <div class="notice"><strong>Payment safety:</strong> Live card, USSD, wallet and mobile-money processing requires server-side provider credentials and webhook verification. This release records payment requests and manual confirmations without storing card or mobile-money PIN details.</div>
      <div class="dashboard-grid" style="margin-top:16px">
        <form class="form-grid" data-payment-form>
          <label class="field full"><span>Order</span><select name="orderId" required><option value="">Select order</option>${orderOptions}</select></label>
          <label class="field"><span>Payment method</span><select name="method" required>${methods.map(([code,label]) => `<option value="${escapeHtml(code)}">${escapeHtml(label)}</option>`).join('')}</select></label>
          <label class="field"><span>Payer transaction reference</span><input name="payerReference" autocomplete="off" placeholder="Optional reference"></label>
          <label class="field full"><span>Notes</span><textarea name="notes" rows="2"></textarea></label>
          <button class="primary-btn" type="submit">Create payment request</button>
        </form>
        <form class="form-grid" data-payment-config-form>
          <label class="field"><span>Payment provider</span><select name="provider">${Object.entries(providerCatalog).map(([code,item]) => `<option value="${code}" ${config.provider === code ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</select></label>
          <label class="field"><span>Merchant or farm name</span><input name="merchantName" value="${escapeHtml(config.merchantName)}"></label>
          <label class="field"><span>Bank name</span><input name="bankName" value="${escapeHtml(config.bankName)}"></label>
          <label class="field"><span>Account name</span><input name="accountName" value="${escapeHtml(config.accountName)}"></label>
          <label class="field"><span>Account number / IBAN</span><input name="accountNumber" value="${escapeHtml(config.accountNumber)}" autocomplete="off"></label>
          <label class="field"><span>Mobile-money number</span><input name="mobileMoneyNumber" value="${escapeHtml(config.mobileMoneyNumber)}" autocomplete="off"></label>
          <label class="field full"><span>Payment instructions</span><textarea name="paymentInstructions" rows="2">${escapeHtml(config.paymentInstructions)}</textarea></label>
          <button class="secondary-btn" type="submit">Save payment settings</button>
        </form>
      </div>
      <div class="panel-head" style="margin-top:18px"><div><h3>Payment records</h3><p>Current provider: ${escapeHtml(provider.name)}</p></div></div>
      <div class="order-list">${payments.length ? payments.map(payment => `<div class="order-item"><div><strong>${escapeHtml(payment.reference)} · ${escapeHtml(payment.methodLabel)}</strong><div>${escapeHtml(payment.trackingCode)} · ${escapeHtml(payment.buyerName)} → ${escapeHtml(payment.sellerName)}</div><small>${escapeHtml(new Date(payment.createdAt).toLocaleString('en-US'))} · ${escapeHtml(payment.provider)}</small></div><div><strong>${escapeHtml(money(payment.amount,payment.currency))}</strong><br><select data-payment-status="${escapeHtml(payment.id)}"><option ${payment.status === 'Pending verification' ? 'selected' : ''}>Pending verification</option><option ${payment.status === 'Paid' ? 'selected' : ''}>Paid</option><option ${payment.status === 'Pay on delivery' ? 'selected' : ''}>Pay on delivery</option><option ${payment.status === 'Failed' ? 'selected' : ''}>Failed</option><option ${payment.status === 'Refunded' ? 'selected' : ''}>Refunded</option><option ${payment.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option></select></div></div>`).join('') : '<div class="notice">No payment requests recorded yet.</div>'}</div>`;

    root.querySelector('[data-payment-form]')?.addEventListener('submit', event => {
      event.preventDefault();
      try {
        const payment = createPayment(Object.fromEntries(new FormData(event.currentTarget)));
        alert(`Payment request created. Reference: ${payment.reference}`);
        render();
      } catch (error) { alert(error.message); }
    });
    root.querySelector('[data-payment-config-form]')?.addEventListener('submit', event => {
      event.preventDefault();
      saveConfig(Object.fromEntries(new FormData(event.currentTarget)));
      alert('Payment settings saved. Do not store secret API keys in the browser.');
      render();
    });
    root.querySelectorAll('[data-payment-status]').forEach(select => select.addEventListener('change', () => updateStatus(select.dataset.paymentStatus, select.value)));
  }

  window.AgriSmartPayments = Object.freeze({ methodsForCountry, providerCatalog, readPayments, readConfig, saveConfig, createPayment, updateStatus });
  window.addEventListener('agrismart:marketplacechange', render);
  window.addEventListener('agrismart:settingschange', render);
  window.addEventListener('agrismart:paymentchange', render);
  render();
})();