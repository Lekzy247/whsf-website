(() => {
  'use strict';

  const PROFILE_KEY = 'agrismart.market-alert-profile.v1';
  const LISTINGS_KEY = 'agrismart.produce-listings.v1';
  const WEATHER_KEY = 'agrismart.market-weather-cache.v1';

  const AREAS = {
    Ibadan: { label: 'Ibadan, Oyo', latitude: 7.3775, longitude: 3.9470 },
    Lagos: { label: 'Lagos', latitude: 6.5244, longitude: 3.3792 },
    Abuja: { label: 'Abuja, FCT', latitude: 9.0765, longitude: 7.3986 },
    Kano: { label: 'Kano', latitude: 12.0022, longitude: 8.5920 },
    Ilorin: { label: 'Ilorin, Kwara', latitude: 8.4966, longitude: 4.5421 },
    Akure: { label: 'Akure, Ondo', latitude: 7.2571, longitude: 5.2058 }
  };

  const PRICE_SIGNALS = [
    { crop: 'Maize', area: 'Ibadan', market: 'Bodija reference', price: 690, trend: 3.4, unit: 'kg' },
    { crop: 'Maize', area: 'Kano', market: 'Dawanau reference', price: 645, trend: 1.9, unit: 'kg' },
    { crop: 'Maize', area: 'Abuja', market: 'Garki reference', price: 720, trend: 4.1, unit: 'kg' },
    { crop: 'Cassava', area: 'Ibadan', market: 'Akinyele reference', price: 235, trend: -1.2, unit: 'kg' },
    { crop: 'Cassava', area: 'Akure', market: 'Oja Oba reference', price: 250, trend: 2.2, unit: 'kg' },
    { crop: 'Cassava', area: 'Lagos', market: 'Mile 12 reference', price: 285, trend: 1.1, unit: 'kg' },
    { crop: 'Rice', area: 'Kano', market: 'Dawanau reference', price: 1420, trend: 2.8, unit: 'kg' },
    { crop: 'Rice', area: 'Abuja', market: 'Garki reference', price: 1510, trend: 3.2, unit: 'kg' },
    { crop: 'Rice', area: 'Lagos', market: 'Mile 12 reference', price: 1575, trend: 1.6, unit: 'kg' },
    { crop: 'Tomato', area: 'Ibadan', market: 'Bodija reference', price: 980, trend: 7.3, unit: 'kg' },
    { crop: 'Tomato', area: 'Lagos', market: 'Mile 12 reference', price: 1140, trend: 9.1, unit: 'kg' },
    { crop: 'Tomato', area: 'Kano', market: 'Yankaba reference', price: 845, trend: -2.4, unit: 'kg' },
    { crop: 'Yam', area: 'Ibadan', market: 'Bodija reference', price: 760, trend: 4.7, unit: 'kg' },
    { crop: 'Yam', area: 'Abuja', market: 'Garki reference', price: 825, trend: 5.5, unit: 'kg' },
    { crop: 'Yam', area: 'Ilorin', market: 'Oja Tuntun reference', price: 735, trend: 2.1, unit: 'kg' },
    { crop: 'Pepper', area: 'Ibadan', market: 'Bodija reference', price: 1680, trend: 6.8, unit: 'kg' },
    { crop: 'Pepper', area: 'Lagos', market: 'Mile 12 reference', price: 1810, trend: 8.5, unit: 'kg' },
    { crop: 'Pepper', area: 'Akure', market: 'Oja Oba reference', price: 1590, trend: -1.6, unit: 'kg' }
  ];

  const state = {
    profile: read(PROFILE_KEY, { crop: 'Maize', area: 'Ibadan', targetPrice: '', rainThreshold: '60', channels: ['in-app'] }),
    listings: read(LISTINGS_KEY, []),
    weather: read(WEATHER_KEY, null),
    alerts: []
  };

  const currency = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0
  });

  function read(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[character]));
  }

  function formatPrice(value) {
    return `${currency.format(Number(value) || 0)}/kg`;
  }

  function toast(message, error = false) {
    if (window.AgriSmartApp?.toast) {
      window.AgriSmartApp.toast(message, error);
      return;
    }
    const element = document.createElement('div');
    element.className = 'toast';
    element.textContent = message;
    if (error) element.style.background = '#9f2f2f';
    document.body.appendChild(element);
    setTimeout(() => element.remove(), 3000);
  }

  function crops() {
    return [...new Set(PRICE_SIGNALS.map(item => item.crop))].sort();
  }

  function options(values, selected, labelAll) {
    const all = labelAll ? `<option value="">${escapeHtml(labelAll)}</option>` : '';
    return all + values.map(value => `<option value="${escapeHtml(value)}"${value === selected ? ' selected' : ''}>${escapeHtml(value)}</option>`).join('');
  }

  function areaOptions(selected, labelAll) {
    const all = labelAll ? `<option value="">${escapeHtml(labelAll)}</option>` : '';
    return all + Object.entries(AREAS).map(([value, item]) => `<option value="${value}"${value === selected ? ' selected' : ''}>${escapeHtml(item.label)}</option>`).join('');
  }

  function hydrateControls() {
    const cropList = crops();
    const cropFilter = document.querySelector('[data-market-crop-filter]');
    const areaFilter = document.querySelector('[data-market-area-filter]');
    if (cropFilter) cropFilter.innerHTML = options(cropList, state.profile.crop, 'All crops');
    if (areaFilter) areaFilter.innerHTML = areaOptions('', 'All market areas');

    document.querySelectorAll('[data-alert-crop]').forEach(select => { select.innerHTML = options(cropList, state.profile.crop); });
    document.querySelectorAll('[data-alert-area]').forEach(select => { select.innerHTML = areaOptions(state.profile.area); });
    document.querySelectorAll('[data-listing-crop]').forEach(select => { select.innerHTML = options(cropList, state.profile.crop); });
    document.querySelectorAll('[data-listing-area]').forEach(select => { select.innerHTML = areaOptions(state.profile.area); });

    const form = document.querySelector('[data-market-alert-form]');
    if (form) {
      form.elements.crop.value = state.profile.crop;
      form.elements.area.value = state.profile.area;
      form.elements.targetPrice.value = state.profile.targetPrice || '';
      form.elements.rainThreshold.value = state.profile.rainThreshold || '60';
      form.querySelectorAll('[name="channel"]').forEach(input => {
        input.checked = (state.profile.channels || []).includes(input.value);
      });
    }

    const date = document.querySelector('[data-produce-listing-form] [name="availableDate"]');
    if (date && !date.value) date.value = new Date().toISOString().slice(0, 10);
  }

  function filteredSignals() {
    const crop = document.querySelector('[data-market-crop-filter]')?.value || '';
    const area = document.querySelector('[data-market-area-filter]')?.value || '';
    const sort = document.querySelector('[data-market-sort]')?.value || 'best';
    const values = PRICE_SIGNALS.filter(item => (!crop || item.crop === crop) && (!area || item.area === area));
    return values.sort((a, b) => {
      if (sort === 'trend') return b.trend - a.trend;
      if (sort === 'nearest') return a.area.localeCompare(b.area) || b.price - a.price;
      return b.price - a.price;
    });
  }

  function renderPriceBoard() {
    const rows = document.querySelector('[data-market-price-rows]');
    if (!rows) return;
    const values = filteredSignals();
    rows.innerHTML = values.map(item => {
      const trendClass = item.trend >= 0 ? 'positive' : 'negative';
      const trendSign = item.trend >= 0 ? '+' : '';
      return `<tr>
        <td><strong>${escapeHtml(item.crop)}</strong><span>${escapeHtml(item.market)}, ${escapeHtml(AREAS[item.area].label)}</span></td>
        <td><strong>${formatPrice(item.price)}</strong><span>Planning reference</span></td>
        <td><span class="market-trend ${trendClass}">${trendSign}${item.trend.toFixed(1)}%</span></td>
        <td><span class="market-source">Demo reference</span></td>
      </tr>`;
    }).join('') || '<tr><td colspan="4"><div class="notice">No price references match these filters.</div></td></tr>';

    const best = values.reduce((winner, item) => !winner || item.price > winner.price ? item : winner, null);
    const bestValue = document.querySelector('[data-market-best]');
    const bestNote = document.querySelector('[data-market-best-note]');
    const movement = document.querySelector('[data-market-movement]');
    if (bestValue) bestValue.textContent = best ? formatPrice(best.price) : '—';
    if (bestNote) bestNote.textContent = best ? `${best.crop} · ${AREAS[best.area].label}` : 'No matching reference';
    if (movement) movement.textContent = best ? `${best.trend >= 0 ? '+' : ''}${best.trend.toFixed(1)}%` : '—';
  }

  function weatherCodeLabel(code) {
    if ([0, 1].includes(code)) return 'Clear';
    if ([2, 3].includes(code)) return 'Cloudy';
    if ([45, 48].includes(code)) return 'Fog';
    if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle';
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Rain';
    if ([95, 96, 99].includes(code)) return 'Storm';
    return 'Mixed';
  }

  async function fetchWeather(area) {
    const location = AREAS[area] || AREAS.Ibadan;
    const query = new URLSearchParams({
      latitude: location.latitude,
      longitude: location.longitude,
      current: 'temperature_2m,weather_code,wind_speed_10m',
      daily: 'precipitation_probability_max',
      forecast_days: '2',
      timezone: 'auto'
    });
    try {
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query}`, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Weather service returned ${response.status}`);
      const data = await response.json();
      state.weather = {
        area,
        temperature: Number(data.current?.temperature_2m),
        wind: Number(data.current?.wind_speed_10m),
        rainChance: Number(data.daily?.precipitation_probability_max?.[0] || 0),
        condition: weatherCodeLabel(Number(data.current?.weather_code)),
        updatedAt: new Date().toISOString()
      };
      write(WEATHER_KEY, state.weather);
    } catch (error) {
      console.warn('Live market weather could not be refreshed.', error);
      if (state.weather?.area !== area) state.weather = null;
    }
    renderWeather();
    generateAlerts();
  }

  function renderWeather() {
    const value = document.querySelector('[data-market-weather]');
    const note = document.querySelector('[data-market-weather-note]');
    if (!value || !note) return;
    if (!state.weather) {
      value.textContent = 'Unavailable';
      note.textContent = 'Weather refresh needed';
      return;
    }
    value.textContent = `${Math.round(state.weather.temperature)}°C · ${state.weather.condition}`;
    note.textContent = `${state.weather.rainChance}% rain · ${AREAS[state.weather.area]?.label || state.weather.area}`;
  }

  function generateAlerts() {
    const profile = state.profile;
    const cropSignals = PRICE_SIGNALS.filter(item => item.crop === profile.crop);
    const localSignal = cropSignals.find(item => item.area === profile.area);
    const bestSignal = cropSignals.reduce((winner, item) => !winner || item.price > winner.price ? item : winner, null);
    const alerts = [];

    if (localSignal) {
      const target = Number(profile.targetPrice);
      if (target && localSignal.price >= target) {
        alerts.push({
          type: 'opportunity',
          eyebrow: 'PRICE OPPORTUNITY',
          title: `${profile.crop} has reached your target`,
          message: `${formatPrice(localSignal.price)} is at or above your ${formatPrice(target)} target in ${AREAS[profile.area].label}. Confirm a buyer’s actual offer before selling.`,
          action: 'Review market board'
        });
      } else {
        alerts.push({
          type: localSignal.trend >= 0 ? 'watch' : 'caution',
          eyebrow: 'MARKET WATCH',
          title: `${profile.crop} is ${localSignal.trend >= 0 ? 'strengthening' : 'softening'} locally`,
          message: `${AREAS[profile.area].label} shows a ${localSignal.trend >= 0 ? '+' : ''}${localSignal.trend.toFixed(1)}% reference movement over seven days.`,
          action: 'Compare nearby markets'
        });
      }
    }

    if (bestSignal && bestSignal.area !== profile.area) {
      alerts.push({
        type: 'insight',
        eyebrow: 'NEARBY SIGNAL',
        title: `${AREAS[bestSignal.area].label} shows the strongest reference`,
        message: `${formatPrice(bestSignal.price)} for ${profile.crop}. Check transport cost and verified demand before changing markets.`,
        action: 'Estimate logistics'
      });
    }

    if (state.weather?.area === profile.area) {
      const threshold = Number(profile.rainThreshold || 60);
      if (state.weather.rainChance >= threshold) {
        alerts.push({
          type: 'weather',
          eyebrow: 'RAIN ALERT',
          title: `${state.weather.rainChance}% chance of rain`,
          message: `Consider postponing spraying, protect harvested produce and inspect drainage in ${AREAS[profile.area].label}.`,
          action: 'Review field plan'
        });
      } else {
        alerts.push({
          type: 'weather',
          eyebrow: 'FIELD CONDITIONS',
          title: `${state.weather.condition}, ${Math.round(state.weather.temperature)}°C`,
          message: `Rain risk is ${state.weather.rainChance}%. Check soil moisture before irrigation and schedule heat-sensitive work early.`,
          action: 'Plan today’s work'
        });
      }
      if (state.weather.temperature >= 35) {
        alerts.push({
          type: 'caution',
          eyebrow: 'HEAT WATCH',
          title: 'High field temperature',
          message: 'Prioritize worker hydration, shade young plants where practical and avoid midday transplanting.',
          action: 'Protect workers and crops'
        });
      }
    }

    alerts.push({
      type: 'safety',
      eyebrow: 'SAFE TRADING',
      title: 'Verify before releasing produce',
      message: 'Confirm buyer identity, final grade, price, pickup arrangements and cleared payment before handing over goods.',
      action: 'Use verification support'
    });

    state.alerts = alerts;
    renderAlerts();
    window.dispatchEvent(new CustomEvent('agrismart:marketalertschange', { detail: { alerts } }));
  }

  function renderAlerts() {
    const root = document.querySelector('[data-farmer-alerts]');
    if (!root) return;
    root.innerHTML = state.alerts.map(alert => `<article class="farmer-alert ${escapeHtml(alert.type)}">
      <span>${escapeHtml(alert.eyebrow)}</span>
      <h4>${escapeHtml(alert.title)}</h4>
      <p>${escapeHtml(alert.message)}</p>
      <strong>${escapeHtml(alert.action)} →</strong>
    </article>`).join('');
  }

  function listingShareText(item) {
    return `AgriSmart produce listing: ${item.quantity} ${item.unit} of ${item.crop}, available ${item.availableDate} in ${AREAS[item.area]?.label || item.area}. Asking price: ${currency.format(item.askingPrice)}. ${item.notes || ''} Please verify all trading terms before payment or collection.`;
  }

  function renderListings() {
    const root = document.querySelector('[data-produce-listings]');
    const count = document.querySelector('[data-market-listing-count]');
    const status = document.querySelector('[data-listing-status]');
    const active = state.listings.filter(item => item.status !== 'closed');
    if (count) count.textContent = String(active.length);
    if (status) status.textContent = `${active.length} active`;
    if (!root) return;
    root.innerHTML = active.length ? active.slice().reverse().map(item => `<article class="produce-listing">
      <div class="produce-listing-head"><div><span>${escapeHtml(item.crop)}</span><h4>${escapeHtml(item.quantity)} ${escapeHtml(item.unit)}</h4></div><strong>${currency.format(item.askingPrice)}</strong></div>
      <p>${escapeHtml(AREAS[item.area]?.label || item.area)} · Available ${escapeHtml(item.availableDate)}</p>
      ${item.notes ? `<small>${escapeHtml(item.notes)}</small>` : ''}
      <div class="produce-listing-actions">
        <button class="secondary-btn" type="button" data-share-listing="${escapeHtml(item.id)}">Share</button>
        <button class="secondary-btn" type="button" data-close-listing="${escapeHtml(item.id)}">Mark sold</button>
      </div>
    </article>`).join('') : '<div class="market-empty"><strong>No active produce listings yet.</strong><p>Create one when your harvest is ready for market.</p></div>';
  }

  function saveProfile(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    state.profile = {
      crop: String(data.get('crop')),
      area: String(data.get('area')),
      targetPrice: String(data.get('targetPrice') || ''),
      rainThreshold: String(data.get('rainThreshold') || '60'),
      channels: data.getAll('channel').map(String)
    };
    if (!state.profile.channels.length) state.profile.channels = ['in-app'];
    write(PROFILE_KEY, state.profile);
    const cropFilter = document.querySelector('[data-market-crop-filter]');
    const areaFilter = document.querySelector('[data-market-area-filter]');
    if (cropFilter) cropFilter.value = state.profile.crop;
    if (areaFilter) areaFilter.value = state.profile.area;
    renderPriceBoard();
    generateAlerts();
    fetchWeather(state.profile.area);
    toast('Farmer alert profile saved.');
  }

  function saveListing(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const listing = {
      id: `listing-${Date.now()}`,
      crop: String(data.crop),
      quantity: Number(data.quantity),
      unit: String(data.unit),
      askingPrice: Number(data.askingPrice),
      area: String(data.area),
      availableDate: String(data.availableDate),
      notes: String(data.notes || '').trim(),
      status: 'active',
      createdAt: new Date().toISOString()
    };
    if (!listing.crop || !listing.area || listing.quantity <= 0 || listing.askingPrice < 0) {
      toast('Please complete the produce details.', true);
      return;
    }
    state.listings.push(listing);
    write(LISTINGS_KEY, state.listings);
    form.reset();
    const date = form.elements.availableDate;
    if (date) date.value = new Date().toISOString().slice(0, 10);
    if (form.elements.crop) form.elements.crop.value = state.profile.crop;
    if (form.elements.area) form.elements.area.value = state.profile.area;
    renderListings();
    toast('Produce listing saved and ready to share.');
  }

  function shareListing(id) {
    const listing = state.listings.find(item => item.id === id);
    if (!listing) return;
    const text = listingShareText(listing);
    if (navigator.share) {
      navigator.share({ title: `${listing.crop} produce listing`, text }).catch(() => {});
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  }

  function closeListing(id) {
    const listing = state.listings.find(item => item.id === id);
    if (!listing) return;
    listing.status = 'closed';
    listing.closedAt = new Date().toISOString();
    write(LISTINGS_KEY, state.listings);
    renderListings();
    toast('Listing marked as sold.');
  }

  function speakAlerts() {
    if (!('speechSynthesis' in window)) {
      toast('Voice playback is not supported on this device.', true);
      return;
    }
    speechSynthesis.cancel();
    const text = state.alerts.map(alert => `${alert.title}. ${alert.message}`).join(' ');
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-NG';
    utterance.rate = 0.92;
    speechSynthesis.speak(utterance);
  }

  function bindEvents() {
    ['[data-market-crop-filter]', '[data-market-area-filter]', '[data-market-sort]'].forEach(selector => {
      document.querySelector(selector)?.addEventListener('change', renderPriceBoard);
    });
    document.querySelector('[data-market-alert-form]')?.addEventListener('submit', saveProfile);
    document.querySelector('[data-produce-listing-form]')?.addEventListener('submit', saveListing);
    document.querySelector('[data-speak-alerts]')?.addEventListener('click', speakAlerts);
    document.querySelectorAll('[data-market-jump]').forEach(button => button.addEventListener('click', () => {
      document.getElementById(button.dataset.marketJump)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
    document.querySelector('[data-produce-listings]')?.addEventListener('click', event => {
      const share = event.target.closest('[data-share-listing]');
      const close = event.target.closest('[data-close-listing]');
      if (share) shareListing(share.dataset.shareListing);
      if (close) closeListing(close.dataset.closeListing);
    });
    window.addEventListener('agrismart:viewchange', event => {
      if (event.detail?.view === 'marketplace') {
        renderPriceBoard();
        renderListings();
        fetchWeather(state.profile.area);
      }
    });
  }

  function init() {
    if (!document.querySelector('[data-market-centre]')) return;
    hydrateControls();
    bindEvents();
    renderPriceBoard();
    renderListings();
    renderWeather();
    generateAlerts();
    fetchWeather(state.profile.area);
  }

  window.AgriSmartMarketAlerts = Object.freeze({
    getAlerts: () => state.alerts.map(item => ({ ...item })),
    getProfile: () => ({ ...state.profile }),
    getListings: () => state.listings.map(item => ({ ...item })),
    refresh: () => fetchWeather(state.profile.area)
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
