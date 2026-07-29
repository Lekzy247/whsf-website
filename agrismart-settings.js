(() => {
  'use strict';

  const SETTINGS_KEY = 'agrismart-settings-v2';
  const LEGACY_KEY = 'agrismart-settings-v1';
  const defaults = Object.freeze({
    country: 'NG', language: 'en', measurementSystem: 'metric', areaUnit: 'hectares',
    temperatureUnit: 'celsius', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    theme: 'system', emailNotifications: true, inventoryAlerts: true, approvalAlerts: true,
    weeklyDigest: false, compactMode: false
  });

  const countries = Object.freeze([
    ['NG','Nigeria'],['GH','Ghana'],['MW','Malawi'],['SL','Sierra Leone'],['ZA','South Africa'],
    ['SN','Senegal'],['CI',"Côte d'Ivoire"],['GB','United Kingdom'],['US','United States'],
    ['CA','Canada'],['AU','Australia'],['IE','Ireland']
  ]);

  const readJSON = key => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
  const read = () => {
    const stored = readJSON(SETTINGS_KEY) || readJSON(LEGACY_KEY) || {};
    const merged = { ...defaults, ...(stored && typeof stored === 'object' ? stored : {}) };
    if (merged.country === 'KE') merged.country = 'MW';
    return merged;
  };

  const save = settings => {
    const normalized = { ...defaults, ...settings };
    ['emailNotifications','inventoryAlerts','approvalAlerts','weeklyDigest','compactMode'].forEach(key => normalized[key] = normalized[key] === true || normalized[key] === 'true' || normalized[key] === 'on');
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent('agrismart:settingschange', { detail: normalized }));
    return normalized;
  };

  const areaLabel = s => s.areaUnit === 'acres' ? 'acres' : 'hectares';
  const temperatureLabel = s => s.temperatureUnit === 'fahrenheit' ? '°F' : '°C';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function download(filename, content, type = 'application/json') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportAllData() {
    const data = {};
    Object.keys(localStorage).filter(key => key.startsWith('agrismart-')).forEach(key => {
      const raw = localStorage.getItem(key); try { data[key] = JSON.parse(raw); } catch { data[key] = raw; }
    });
    download(`agrismart-backup-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), data }, null, 2));
  }

  async function importAllData(file) {
    const parsed = JSON.parse(await file.text());
    if (!parsed?.data || typeof parsed.data !== 'object') throw new Error('This is not a valid AgriSmart backup file.');
    Object.entries(parsed.data).forEach(([key, value]) => {
      if (key.startsWith('agrismart-')) localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    });
    location.reload();
  }

  function renderSettingsForm() {
    const root = document.querySelector('[data-settings-panel]');
    if (!root) return;
    const settings = read();
    root.innerHTML = `
      <div class="dashboard-grid">
        <section class="panel">
          <div class="panel-head"><div><h3>Regional preferences</h3><p>Set defaults used across farm records and reports.</p></div><span class="chip">International</span></div>
          <form class="form-grid" data-settings-form>
            <label class="field"><span>Country</span><select name="country">${countries.map(([c,n]) => `<option value="${c}">${n}</option>`).join('')}</select></label>
            <label class="field"><span>Language</span><select name="language"><option value="en">English</option><option value="fr">French</option><option value="pt">Portuguese</option><option value="sw">Swahili</option></select></label>
            <label class="field"><span>Measurement system</span><select name="measurementSystem"><option value="metric">Metric</option><option value="imperial">Imperial</option></select></label>
            <label class="field"><span>Farm area unit</span><select name="areaUnit"><option value="hectares">Hectares</option><option value="acres">Acres</option></select></label>
            <label class="field"><span>Temperature</span><select name="temperatureUnit"><option value="celsius">Celsius (°C)</option><option value="fahrenheit">Fahrenheit (°F)</option></select></label>
            <label class="field"><span>Time zone</span><input name="timeZone" autocomplete="off"></label>
            <label class="field"><span>Appearance</span><select name="theme"><option value="system">Use device setting</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
            <label class="field"><span>Layout</span><select name="compactMode"><option value="false">Comfortable</option><option value="true">Compact</option></select></label>
            <button class="primary-btn" type="submit">Save preferences</button>
          </form>
        </section>
        <section class="panel">
          <div class="panel-head"><h3>Notifications</h3><span class="chip">Preferences</span></div>
          <form class="form-grid" data-notification-form>
            ${[['emailNotifications','Email notifications'],['inventoryAlerts','Low-stock alerts'],['approvalAlerts','Approval alerts'],['weeklyDigest','Weekly performance digest']].map(([key,label]) => `<label class="field full" style="display:flex;align-items:center;gap:10px"><input name="${key}" type="checkbox" style="width:auto"><span>${label}</span></label>`).join('')}
            <button class="primary-btn" type="submit">Save notifications</button>
          </form>
          <div class="result-list" data-settings-summary style="margin-top:16px"></div>
        </section>
      </div>
      <div class="dashboard-grid" style="margin-top:18px">
        <section class="panel">
          <div class="panel-head"><div><h3>Data management</h3><p>Back up or restore application data stored on this device.</p></div></div>
          <div class="hero-actions"><button class="secondary-btn" type="button" data-export-all>Export backup</button><label class="secondary-btn" for="settings-import" style="cursor:pointer">Import backup</label><input id="settings-import" type="file" accept="application/json" hidden><button class="secondary-btn" type="button" data-clear-data>Clear local data</button></div>
          <p class="notice" data-data-status style="margin-top:14px">Backups include AgriSmart data stored in this browser.</p>
        </section>
        <section class="panel">
          <div class="panel-head"><div><h3>System readiness</h3><p>Confirm that enterprise modules are available.</p></div><span class="chip">v1.0</span></div>
          <button class="secondary-btn" type="button" data-system-check>Run system check</button>
          <div class="result-list" data-system-results style="margin-top:14px"><article><strong>Not checked</strong><p>Run the system check after all modules finish loading.</p></article></div>
        </section>
      </div>`;

    const form = root.querySelector('[data-settings-form]');
    ['country','language','measurementSystem','areaUnit','temperatureUnit','timeZone','theme'].forEach(key => { if (form.elements[key]) form.elements[key].value = String(settings[key]); });
    form.elements.compactMode.value = String(settings.compactMode);
    const notifications = root.querySelector('[data-notification-form]');
    ['emailNotifications','inventoryAlerts','approvalAlerts','weeklyDigest'].forEach(key => notifications.elements[key].checked = !!settings[key]);

    form.addEventListener('submit', event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      const updated = save({ ...read(), ...data }); applySettings(updated); renderSummary(root, updated);
    });
    notifications.addEventListener('submit', event => {
      event.preventDefault();
      const updated = { ...read() };
      ['emailNotifications','inventoryAlerts','approvalAlerts','weeklyDigest'].forEach(key => updated[key] = notifications.elements[key].checked);
      save(updated); renderSummary(root, updated);
    });
    root.querySelector('[data-export-all]').addEventListener('click', exportAllData);
    root.querySelector('#settings-import').addEventListener('change', async event => {
      const status = root.querySelector('[data-data-status]');
      try { if (event.target.files[0]) { status.textContent = 'Importing backup…'; await importAllData(event.target.files[0]); } }
      catch (error) { status.textContent = error.message; }
    });
    root.querySelector('[data-clear-data]').addEventListener('click', () => {
      if (!confirm('Clear all AgriSmart data stored on this device? This cannot be undone.')) return;
      Object.keys(localStorage).filter(key => key.startsWith('agrismart-')).forEach(key => localStorage.removeItem(key)); location.reload();
    });
    root.querySelector('[data-system-check]').addEventListener('click', () => renderReadiness(root));
    renderSummary(root, settings);
    window.dispatchEvent(new CustomEvent('agrismart:settingsrendered'));
  }

  function renderSummary(root, settings) {
    const countryName = countries.find(([code]) => code === settings.country)?.[1] || settings.country;
    const languageNames = { en:'English', fr:'French', pt:'Portuguese', sw:'Swahili' };
    const summary = root.querySelector('[data-settings-summary]');
    if (!summary) return;
    summary.innerHTML = `<article><strong>${esc(countryName)}</strong><p>Country profile</p></article><article><strong>${esc(languageNames[settings.language] || settings.language)}</strong><p>Preferred language</p></article><article><strong>${esc(areaLabel(settings))}</strong><p>Farm area unit</p></article><article><strong>${esc(temperatureLabel(settings))}</strong><p>Temperature display</p></article><article><strong>${esc(settings.timeZone)}</strong><p>Time zone</p></article>`;
  }

  function renderReadiness(root) {
    const requiredViews = ['home','finance','inventory','warehouse','procurement','approvals','analytics','advisor','administration','settings'];
    const requiredApis = ['AgriSmartAuth','AgriSmartWarehouse','AgriSmartProcurement','AgriSmartApprovals','AgriSmartAnalytics','AgriSmartAdministration'];
    const missingViews = requiredViews.filter(view => !document.querySelector(`[data-view-panel="${view}"]`));
    const missingApis = requiredApis.filter(api => !window[api]);
    const results = root.querySelector('[data-system-results]');
    const passed = !missingViews.length && !missingApis.length;
    results.innerHTML = `<article><strong>${passed ? 'System ready' : 'Attention required'}</strong><p>${passed ? 'All required enterprise views and APIs are available.' : `Missing views: ${esc(missingViews.join(', ') || 'none')}. Missing APIs: ${esc(missingApis.join(', ') || 'none')}.`}</p></article>`;
  }

  function applySettings(settings = read()) {
    document.documentElement.lang = settings.language || 'en';
    document.documentElement.dataset.theme = settings.theme;
    document.body?.classList.toggle('compact-mode', !!settings.compactMode);
    document.querySelectorAll('label.field span').forEach(label => {
      if (/^Size \(/.test(label.textContent)) label.textContent = `Size (${areaLabel(settings)})`;
      if (/^Temperature \(/.test(label.textContent)) label.textContent = `Temperature (${temperatureLabel(settings)})`;
    });
  }

  function loadScript(src) {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing?.dataset.loaded === 'true') return Promise.resolve();
    if (existing) return new Promise((resolve, reject) => { existing.addEventListener('load', resolve, { once:true }); existing.addEventListener('error', reject, { once:true }); setTimeout(resolve, 0); });
    return new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = src; script.defer = true;
      script.addEventListener('load', () => { script.dataset.loaded = 'true'; resolve(); }, { once:true });
      script.addEventListener('error', reject, { once:true }); document.head.appendChild(script);
    });
  }

  async function enableExtendedModules() {
    const modules = ['/agrismart-analytics.js','/agrismart-marketplace-commerce.js','/agrismart-marketplace-experience.js','/agrismart-shopping-cart.js','/agrismart-local-payments.js','/agrismart-livestock.js','/agrismart-warehouse.js','/agrismart-procurement.js','/agrismart-fleet.js','/agrismart-approval-center.js','/agrismart-navigation-controller.js','/agrismart-enterprise-integration.js','/agrismart-administration.js','/agrismart-auth-ui.js'];
    try { for (const module of modules) await loadScript(module); window.dispatchEvent(new CustomEvent('agrismart:extendedmodulesready', { detail:{ modules } })); }
    catch (error) { console.error('AgriSmart extended modules failed to load.', error); window.dispatchEvent(new CustomEvent('agrismart:extendedmoduleserror', { detail:{ message:error.message } })); }
  }

  window.AgriSmartSettings = Object.freeze({ get: read, save, countries, exportAllData, importAllData });
  const init = () => { renderSettingsForm(); applySettings(); enableExtendedModules(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true }); else init();
})();