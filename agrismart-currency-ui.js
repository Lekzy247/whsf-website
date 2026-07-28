(() => {
  'use strict';

  const reports = window.AgriSmartReports;
  if (!reports?.getCurrency || !reports?.setCurrency) return;

  const currencyNames = Object.freeze({
    NGN: 'Nigerian Naira',
    USD: 'US Dollar',
    EUR: 'Euro',
    GBP: 'British Pound',
    CAD: 'Canadian Dollar',
    AUD: 'Australian Dollar',
    GHS: 'Ghanaian Cedi',
    KES: 'Kenyan Shilling',
    ZAR: 'South African Rand',
    XOF: 'West African CFA Franc'
  });

  const localeByCurrency = Object.freeze({
    NGN: 'en-NG', USD: 'en-US', EUR: 'en-IE', GBP: 'en-GB', CAD: 'en-CA',
    AUD: 'en-AU', GHS: 'en-GH', KES: 'en-KE', ZAR: 'en-ZA', XOF: 'fr-SN'
  });

  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));

  const normalizeCurrency = value => reports.supportedCurrencies.includes(String(value || '').toUpperCase())
    ? String(value).toUpperCase()
    : reports.getCurrency();

  const money = (value, currency = reports.getCurrency()) => {
    const code = normalizeCurrency(currency);
    return new Intl.NumberFormat(localeByCurrency[code] || 'en-US', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: code === 'XOF' ? 0 : 2
    }).format(Number(value) || 0);
  };

  function ensureCurrencyControls() {
    if (document.querySelector('[data-currency-selector]')) return;
    const topActions = document.querySelector('.top-actions');
    if (!topActions) return;

    const label = document.createElement('label');
    label.className = 'currency-control';
    label.style.cssText = 'display:flex;align-items:center;gap:8px;padding:7px 10px;border:1px solid rgba(13,77,53,.18);border-radius:10px;background:#fff;font-weight:700;font-size:.85rem';
    label.innerHTML = `<span>Currency</span><select data-currency-selector aria-label="Financial currency" style="border:0;background:transparent;font:inherit;min-width:82px;cursor:pointer">${reports.supportedCurrencies.map(code => `<option value="${code}">${code}</option>`).join('')}</select>`;
    topActions.prepend(label);

    const selector = label.querySelector('select');
    selector.value = reports.getCurrency();
    selector.addEventListener('change', () => {
      const code = reports.setCurrency(selector.value);
      setFormCurrencies(code);
      renderCurrencyViews();
    });
  }

  function ensureFormCurrency(form) {
    if (!form || form.querySelector('[name="currency"]')) return;
    const amountField = form.querySelector('[name="amount"], [name="revenue"]');
    if (!amountField) return;

    const field = document.createElement('label');
    field.className = 'field';
    field.innerHTML = `<span>Currency</span><select name="currency" required>${reports.supportedCurrencies.map(code => `<option value="${code}">${code} — ${escapeHtml(currencyNames[code] || code)}</option>`).join('')}</select>`;
    amountField.closest('.field')?.insertAdjacentElement('afterend', field);
  }

  function setFormCurrencies(currency = reports.getCurrency()) {
    document.querySelectorAll('[data-expense-form], [data-harvest-form]').forEach(form => {
      ensureFormCurrency(form);
      const select = form.querySelector('[name="currency"]');
      if (select) select.value = currency;
    });
  }

  function renderCurrencyViews() {
    const selected = reports.getCurrency();
    const selector = document.querySelector('[data-currency-selector]');
    if (selector && selector.value !== selected) selector.value = selected;

    const summary = reports.getSummary(selected);
    const financeRoot = document.querySelector('[data-finance-dashboard]');
    const operationsRoot = document.querySelector('[data-operations-dashboard]');

    const setText = (root, selectorText, value) => {
      const element = root?.querySelector(selectorText);
      if (element) element.textContent = value;
    };

    setText(financeRoot, '[data-total-revenue]', money(summary.totalRevenue, selected));
    setText(financeRoot, '[data-total-expenses]', money(summary.totalExpenses, selected));
    setText(financeRoot, '[data-estimated-profit]', money(summary.estimatedProfit, selected));
    setText(financeRoot, '[data-harvest-count]', String(summary.harvests));

    setText(operationsRoot, '[data-ops-revenue]', money(summary.totalRevenue, selected));
    setText(operationsRoot, '[data-ops-expenses]', money(summary.totalExpenses, selected));
    setText(operationsRoot, '[data-ops-profit]', money(summary.estimatedProfit, selected));
    const margin = summary.totalRevenue ? (summary.estimatedProfit / summary.totalRevenue) * 100 : 0;
    setText(operationsRoot, '[data-ops-margin]', `${margin.toFixed(1)}%`);

    const expenses = reports.getExpenses().filter(item => normalizeCurrency(item.currency || selected) === selected).slice().reverse();
    const expenseList = financeRoot?.querySelector('[data-expense-list]');
    if (expenseList) expenseList.innerHTML = expenses.length ? expenses.map(item => `
      <div class="order-item">
        <div><strong>${escapeHtml(item.category)}</strong><div>${escapeHtml(item.description || 'Farm expense')} · ${escapeHtml(item.date)} · ${selected}</div></div>
        <div><strong>${money(item.amount, item.currency || selected)}</strong> <button class="secondary-btn" data-remove-expense="${escapeHtml(item.id)}" type="button">Remove</button></div>
      </div>`).join('') : `<div class="notice">No ${selected} expenses recorded.</div>`;

    const harvests = reports.getHarvests().filter(item => normalizeCurrency(item.currency || selected) === selected).slice().reverse();
    const harvestList = financeRoot?.querySelector('[data-harvest-list]');
    if (harvestList) harvestList.innerHTML = harvests.length ? harvests.map(item => `
      <div class="order-item">
        <div><strong>${escapeHtml(item.crop)}</strong><div>${escapeHtml(item.quantity)} ${escapeHtml(item.unit)} · ${escapeHtml(item.date)} · ${selected}</div></div>
        <div><strong>${money(item.revenue, item.currency || selected)}</strong> <button class="secondary-btn" data-remove-harvest="${escapeHtml(item.id)}" type="button">Remove</button></div>
      </div>`).join('') : `<div class="notice">No ${selected} harvest revenue recorded.</div>`;
  }

  ensureCurrencyControls();
  setFormCurrencies();
  renderCurrencyViews();

  window.addEventListener('agrismart:datachange', () => queueMicrotask(renderCurrencyViews));
  window.addEventListener('agrismart:restorecomplete', () => queueMicrotask(() => {
    setFormCurrencies();
    renderCurrencyViews();
  }));
  window.addEventListener('agrismart:currencychange', () => queueMicrotask(renderCurrencyViews));
})();