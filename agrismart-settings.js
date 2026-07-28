(() => {
  'use strict';

  const SETTINGS_KEY = 'agrismart-settings-v1';
  const defaults = Object.freeze({
    country: 'NG',
    language: 'en',
    measurementSystem: 'metric',
    areaUnit: 'hectares',
    temperatureUnit: 'celsius',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  });

  const countries = Object.freeze([
    ['NG', 'Nigeria'], ['GH', 'Ghana'], ['MW', 'Malawi'], ['SL', 'Sierra Leone'],
    ['ZA', 'South Africa'], ['SN', 'Senegal'], ['CI', "Côte d'Ivoire"],
    ['GB', 'United Kingdom'], ['US', 'United States'], ['CA', 'Canada'],
    ['AU', 'Australia'], ['IE', 'Ireland']
  ]);

  const read = () => {
    try {
      const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY));
      const merged = { ...defaults, ...(stored && typeof stored === 'object' ? stored : {}) };
      if (merged.country === 'KE') merged.country = 'MW';
      return merged;
    } catch {
      return { ...defaults };
    }
  };

  const save = settings => {
    const normalized = { ...defaults, ...settings };
    if (normalized.country === 'KE') normalized.country = 'MW';
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent('agrismart:settingschange', { detail: normalized }));
    return normalized;
  };

  const areaLabel = settings => settings.areaUnit === 'acres' ? 'acres' : 'hectares';
  const temperatureLabel = settings => settings.temperatureUnit === 'fahrenheit' ? '°F' : '°C';

  function renderSettingsForm() {
    const root = document.querySelector('[data-settings-panel]');
    if (!root) return;
    const settings = read();

    root.innerHTML = `
      <div class="dashboard-grid">
        <section class="panel">
          <div class="panel-head"><div><h3>Country and regional profile</h3><p>Set the defaults used across farm records and reports.</p></div><span class="chip">International</span></div>
          <form class="form-grid" data-settings-form>
            <label class="field"><span>Country</span><select name="country">${countries.map(([code, name]) => `<option value="${code}">${name}</option>`).join('')}</select></label>
            <label class="field"><span>Language</span><select name="language"><option value="en">English</option><option value="fr">French</option><option value="pt">Portuguese</option><option value="sw">Swahili</option></select></label>
            <label class="field"><span>Measurement system</span><select name="measurementSystem"><option value="metric">Metric</option><option value="imperial">Imperial</option></select></label>
            <label class="field"><span>Farm area unit</span><select name="areaUnit"><option value="hectares">Hectares</option><option value="acres">Acres</option></select></label>
            <label class="field"><span>Temperature</span><select name="temperatureUnit"><option value="celsius">Celsius (°C)</option><option value="fahrenheit">Fahrenheit (°F)</option></select></label>
            <label class="field"><span>Time zone</span><input name="timeZone" autocomplete="off"></label>
            <button class="primary-btn" type="submit">Save preferences</button>
          </form>
        </section>
        <section class="panel">
          <div class="panel-head"><h3>Current configuration</h3></div>
          <div class="result-list" data-settings-summary></div>
          <div class="notice" style="margin-top:14px">Language preference is stored now. Full interface translation will be introduced incrementally in later releases.</div>
        </section>
      </div>`;

    const form = root.querySelector('[data-settings-form]');
    Object.entries(settings).forEach(([key, value]) => {
      const field = form.elements.namedItem(key);
      if (field) field.value = value;
    });

    form.addEventListener('submit', event => {
      event.preventDefault();
      const updated = save(Object.fromEntries(new FormData(form)));
      applySettings(updated);
      renderSummary(root, updated);
    });

    renderSummary(root, settings);
  }

  function renderSummary(root, settings) {
    const countryName = countries.find(([code]) => code === settings.country)?.[1] || settings.country;
    const languageNames = { en: 'English', fr: 'French', pt: 'Portuguese', sw: 'Swahili' };
    const summary = root.querySelector('[data-settings-summary]');
    if (!summary) return;
    summary.innerHTML = `
      <article><strong>${countryName}</strong><p>Country profile</p></article>
      <article><strong>${languageNames[settings.language] || settings.language}</strong><p>Preferred language</p></article>
      <article><strong>${areaLabel(settings)}</strong><p>Farm area unit</p></article>
      <article><strong>${temperatureLabel(settings)}</strong><p>Temperature display</p></article>
      <article><strong>${settings.timeZone}</strong><p>Time zone</p></article>`;
  }

  function applySettings(settings = read()) {
    document.documentElement.lang = settings.language || 'en';
    document.querySelectorAll('label.field span').forEach(label => {
      if (/^Size \(/.test(label.textContent)) label.textContent = `Size (${areaLabel(settings)})`;
      if (/^Temperature \(/.test(label.textContent)) label.textContent = `Temperature (${temperatureLabel(settings)})`;
    });
    document.querySelectorAll('[name="size"]').forEach(input => {
      input.dataset.areaUnit = settings.areaUnit;
      input.setAttribute('aria-description', `Farm area in ${areaLabel(settings)}`);
    });
  }

  function loadScript(src) {
    if (document.querySelector(`script[src="${src}"]`)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.defer = true;
      script.addEventListener('load', resolve, { once:true });
      script.addEventListener('error', () => reject(new Error(`Unable to load ${src}`)), { once:true });
      document.head.appendChild(script);
    });
  }

  async function enableExtendedModules() {
    const marketplacePanel = document.querySelector('[data-view-panel="marketplace"]');
    if (marketplacePanel) marketplacePanel.dataset.marketplacePanel = '';

    const main = document.querySelector('.app-main');
    const nav = document.querySelector('.app-nav');
    if (main && !document.querySelector('[data-view-panel="analytics"]')) {
      const analytics = document.createElement('section');
      analytics.className = 'view';
      analytics.dataset.viewPanel = 'analytics';
      analytics.innerHTML = '<div class="section-heading"><p class="eyebrow">Farm intelligence</p><h2>Analytics and performance</h2><p>Track financial trends, crop performance, inventory risk and operational data.</p></div><div data-analytics-panel></div>';
      const settingsPanel = document.querySelector('[data-view-panel="settings"]');
      main.insertBefore(analytics, settingsPanel || null);
    }
    if (nav && !nav.querySelector('[data-view="analytics"]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.view = 'analytics';
      button.textContent = '▥ Analytics';
      const settingsButton = nav.querySelector('[data-view="settings"]');
      nav.insertBefore(button, settingsButton || null);
    }

    try {
      await loadScript('/agrismart-analytics.js');
      await loadScript('/agrismart-marketplace-commerce.js');
      await loadScript('/agrismart-local-payments.js');
      window.dispatchEvent(new CustomEvent('agrismart:extendedmodulesready'));
    } catch (error) {
      console.error('AgriSmart extended modules failed to load.', error);
    }
  }

  window.AgriSmartSettings = Object.freeze({ get: read, save, countries });
  renderSettingsForm();
  applySettings();
  enableExtendedModules();
})();