(() => {
  'use strict';

  const PROFILE_KEY = 'agrismart.market-alert-profile.v1';
  const LISTINGS_KEY = 'agrismart.produce-listings.v1';
  const WEATHER_KEY = 'agrismart.market-weather-cache.v1';

  const REGIONS = {
    Nigeria: { label: 'Nigeria', locale: 'en-NG', currency: 'NGN', symbol: '₦', unit: 'kg' },
    USA: { label: 'United States', locale: 'en-US', currency: 'USD', symbol: '$', unit: 'lb' },
    Ghana: { label: 'Ghana', locale: 'en-GH', currency: 'GHS', symbol: 'GH₵', unit: 'kg' },
    Kenya: { label: 'Kenya', locale: 'en-KE', currency: 'KES', symbol: 'KSh', unit: 'kg' },
    India: { label: 'India', locale: 'en-IN', currency: 'INR', symbol: '₹', unit: 'kg' }
  };

  const CROP_CATALOG = {
    Nigeria: ['Maize', 'Cassava', 'Rice', 'Tomato', 'Yam', 'Pepper', 'Cowpea (beans)', 'Plantain', 'Sorghum', 'Millet', 'Groundnut', 'Okra', 'Cocoyam', 'Sweet potato', 'Soybean', 'Onion', 'Watermelon', 'Cocoa'],
    USA: ['Corn', 'Soybean', 'Wheat', 'Potato', 'Tomato', 'Apple', 'Peanut', 'Sweet corn', 'Lettuce', 'Strawberry', 'Orange', 'Rice', 'Cotton', 'Barley', 'Oats', 'Grapes'],
    Ghana: ['Maize', 'Cassava', 'Yam', 'Plantain', 'Cocoyam', 'Rice', 'Tomato', 'Pepper', 'Groundnut', 'Cowpea (beans)', 'Cocoa', 'Pineapple', 'Okra'],
    Kenya: ['Maize', 'Beans', 'Potato', 'Tomato', 'Kale (sukuma wiki)', 'Tea', 'Coffee', 'Avocado', 'Banana', 'Rice', 'Sorghum', 'Millet', 'Onion'],
    India: ['Rice', 'Wheat', 'Chickpea', 'Pigeon pea', 'Potato', 'Tomato', 'Onion', 'Millet', 'Sorghum', 'Groundnut', 'Cotton', 'Sugarcane', 'Mango', 'Banana', 'Lentil']
  };

  const AREAS = {
    'ng-ibadan': { region: 'Nigeria', label: 'Ibadan, Oyo', latitude: 7.3775, longitude: 3.9470 },
    'ng-lagos': { region: 'Nigeria', label: 'Lagos', latitude: 6.5244, longitude: 3.3792 },
    'ng-abuja': { region: 'Nigeria', label: 'Abuja, FCT', latitude: 9.0765, longitude: 7.3986 },
    'ng-kano': { region: 'Nigeria', label: 'Kano', latitude: 12.0022, longitude: 8.5920 },
    'ng-ilorin': { region: 'Nigeria', label: 'Ilorin, Kwara', latitude: 8.4966, longitude: 4.5421 },
    'ng-akure': { region: 'Nigeria', label: 'Akure, Ondo', latitude: 7.2571, longitude: 5.2058 },
    'us-chicago': { region: 'USA', label: 'Chicago, Illinois', latitude: 41.8781, longitude: -87.6298 },
    'us-des-moines': { region: 'USA', label: 'Des Moines, Iowa', latitude: 41.5868, longitude: -93.6250 },
    'us-atlanta': { region: 'USA', label: 'Atlanta, Georgia', latitude: 33.7490, longitude: -84.3880 },
    'us-fresno': { region: 'USA', label: 'Fresno, California', latitude: 36.7378, longitude: -119.7871 },
    'gh-accra': { region: 'Ghana', label: 'Accra', latitude: 5.6037, longitude: -0.1870 },
    'gh-kumasi': { region: 'Ghana', label: 'Kumasi', latitude: 6.6885, longitude: -1.6244 },
    'gh-tamale': { region: 'Ghana', label: 'Tamale', latitude: 9.4034, longitude: -0.8424 },
    'ke-nairobi': { region: 'Kenya', label: 'Nairobi', latitude: -1.2921, longitude: 36.8219 },
    'ke-nakuru': { region: 'Kenya', label: 'Nakuru', latitude: -0.3031, longitude: 36.0800 },
    'ke-kisumu': { region: 'Kenya', label: 'Kisumu', latitude: -0.0917, longitude: 34.7680 },
    'in-delhi': { region: 'India', label: 'Delhi', latitude: 28.6139, longitude: 77.2090 },
    'in-mumbai': { region: 'India', label: 'Mumbai', latitude: 19.0760, longitude: 72.8777 },
    'in-bengaluru': { region: 'India', label: 'Bengaluru', latitude: 12.9716, longitude: 77.5946 }
  };

  const PRICE_SIGNALS = [
    { region: 'Nigeria', crop: 'Maize', area: 'ng-ibadan', market: 'Bodija reference', price: 690, trend: 3.4 },
    { region: 'Nigeria', crop: 'Maize', area: 'ng-kano', market: 'Dawanau reference', price: 645, trend: 1.9 },
    { region: 'Nigeria', crop: 'Cassava', area: 'ng-akure', market: 'Oja Oba reference', price: 250, trend: 2.2 },
    { region: 'Nigeria', crop: 'Rice', area: 'ng-abuja', market: 'Garki reference', price: 1510, trend: 3.2 },
    { region: 'Nigeria', crop: 'Tomato', area: 'ng-lagos', market: 'Mile 12 reference', price: 1140, trend: 9.1 },
    { region: 'Nigeria', crop: 'Yam', area: 'ng-ilorin', market: 'Oja Tuntun reference', price: 735, trend: 2.1 },
    { region: 'Nigeria', crop: 'Pepper', area: 'ng-ibadan', market: 'Bodija reference', price: 1680, trend: 6.8 },
    { region: 'Nigeria', crop: 'Cowpea (beans)', area: 'ng-kano', market: 'Dawanau reference', price: 1320, trend: 2.7 },
    { region: 'Nigeria', crop: 'Plantain', area: 'ng-lagos', market: 'Mile 12 reference', price: 820, trend: 4.4 },
    { region: 'Nigeria', crop: 'Sorghum', area: 'ng-kano', market: 'Dawanau reference', price: 610, trend: -1.1 },
    { region: 'Nigeria', crop: 'Groundnut', area: 'ng-abuja', market: 'Garki reference', price: 1760, trend: 3.5 },
    { region: 'USA', crop: 'Corn', area: 'us-des-moines', market: 'Iowa farm-gate reference', price: 0.18, trend: 1.4 },
    { region: 'USA', crop: 'Soybean', area: 'us-chicago', market: 'Midwest reference', price: 0.42, trend: 2.1 },
    { region: 'USA', crop: 'Wheat', area: 'us-chicago', market: 'Chicago reference', price: 0.27, trend: -0.8 },
    { region: 'USA', crop: 'Potato', area: 'us-fresno', market: 'California produce reference', price: 0.74, trend: 3.2 },
    { region: 'USA', crop: 'Tomato', area: 'us-fresno', market: 'California produce reference', price: 1.26, trend: 5.6 },
    { region: 'USA', crop: 'Peanut', area: 'us-atlanta', market: 'Southeast reference', price: 0.68, trend: 1.7 },
    { region: 'USA', crop: 'Apple', area: 'us-chicago', market: 'Wholesale produce reference', price: 1.48, trend: 2.4 },
    { region: 'Ghana', crop: 'Maize', area: 'gh-tamale', market: 'Tamale reference', price: 8.4, trend: 2.8 },
    { region: 'Ghana', crop: 'Cassava', area: 'gh-kumasi', market: 'Kumasi reference', price: 4.2, trend: 1.5 },
    { region: 'Ghana', crop: 'Yam', area: 'gh-accra', market: 'Accra reference', price: 13.6, trend: 4.1 },
    { region: 'Ghana', crop: 'Plantain', area: 'gh-kumasi', market: 'Kumasi reference', price: 10.9, trend: -1.3 },
    { region: 'Ghana', crop: 'Cocoa', area: 'gh-kumasi', market: 'Ashanti reference', price: 58, trend: 3.9 },
    { region: 'Kenya', crop: 'Maize', area: 'ke-nakuru', market: 'Nakuru reference', price: 72, trend: 3.1 },
    { region: 'Kenya', crop: 'Beans', area: 'ke-nairobi', market: 'Nairobi reference', price: 168, trend: 4.6 },
    { region: 'Kenya', crop: 'Potato', area: 'ke-nakuru', market: 'Nakuru reference', price: 64, trend: -2.2 },
    { region: 'Kenya', crop: 'Tomato', area: 'ke-kisumu', market: 'Kisumu reference', price: 118, trend: 7.4 },
    { region: 'Kenya', crop: 'Avocado', area: 'ke-nairobi', market: 'Nairobi reference', price: 142, trend: 2.6 },
    { region: 'India', crop: 'Rice', area: 'in-delhi', market: 'Delhi reference', price: 49, trend: 1.8 },
    { region: 'India', crop: 'Wheat', area: 'in-delhi', market: 'Delhi reference', price: 34, trend: 2.4 },
    { region: 'India', crop: 'Potato', area: 'in-mumbai', market: 'Mumbai reference', price: 31, trend: -1.7 },
    { region: 'India', crop: 'Tomato', area: 'in-bengaluru', market: 'Bengaluru reference', price: 46, trend: 6.2 },
    { region: 'India', crop: 'Chickpea', area: 'in-delhi', market: 'Delhi reference', price: 91, trend: 3.3 }
  ];

  const state = {
    profile: normalizeProfile(read(PROFILE_KEY, { region: 'Nigeria', crop: 'Maize', area: 'ng-ibadan', targetPrice: '', rainThreshold: '60', channels: ['in-app'] })),
    listings: read(LISTINGS_KEY, []),
    weather: read(WEATHER_KEY, null),
    alerts: []
  };

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

  function normalizeProfile(profile) {
    const legacyAreas = { Ibadan: 'ng-ibadan', Lagos: 'ng-lagos', Abuja: 'ng-abuja', Kano: 'ng-kano', Ilorin: 'ng-ilorin', Akure: 'ng-akure' };
    const region = REGIONS[profile?.region] ? profile.region : 'Nigeria';
    const area = legacyAreas[profile?.area] || profile?.area;
    const validArea = AREAS[area]?.region === region ? area : firstArea(region);
    const crop = CROP_CATALOG[region].includes(profile?.crop) ? profile.crop : CROP_CATALOG[region][0];
    return { ...profile, region, area: validArea, crop };
  }

  function firstArea(region) {
    return Object.keys(AREAS).find(key => AREAS[key].region === region);
  }

  function formatMoney(value, region, maximumFractionDigits = 0) {
    const meta = REGIONS[region] || REGIONS.Nigeria;
    return new Intl.NumberFormat(meta.locale, {
      style: 'currency',
      currency: meta.currency,
      maximumFractionDigits
    }).format(Number(value) || 0);
  }

  function formatPrice(value, region, unit) {
    const meta = REGIONS[region] || REGIONS.Nigeria;
    const decimals = meta.currency === 'USD' ? 2 : 0;
    return `${formatMoney(value, region, decimals)}/${unit || meta.unit}`;
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

  function crops(region) {
    return [...(CROP_CATALOG[region] || CROP_CATALOG.Nigeria)].sort();
  }

  function options(values, selected, labelAll) {
    const all = labelAll ? `<option value="">${escapeHtml(labelAll)}</option>` : '';
    return all + values.map(value => `<option value="${escapeHtml(value)}"${value === selected ? ' selected' : ''}>${escapeHtml(value)}</option>`).join('');
  }

  function regionOptions(selected) {
    return Object.entries(REGIONS).map(([value, item]) => `<option value="${value}"${value === selected ? ' selected' : ''}>${escapeHtml(item.label)}</option>`).join('');
  }

  function areaOptions(region, selected, labelAll) {
    const all = labelAll ? `<option value="">${escapeHtml(labelAll)}</option>` : '';
    return all + Object.entries(AREAS)
      .filter(([, item]) => item.region === region)
      .map(([value, item]) => `<option value="${value}"${value === selected ? ' selected' : ''}>${escapeHtml(item.label)}</option>`).join('');
  }

  function setRegionalSelects(region, cropSelect, areaSelect, preferredCrop, preferredArea, allowAll = false) {
    const crop = CROP_CATALOG[region]?.includes(preferredCrop) ? preferredCrop : CROP_CATALOG[region][0];
    const area = AREAS[preferredArea]?.region === region ? preferredArea : firstArea(region);
    if (cropSelect) cropSelect.innerHTML = options(crops(region), crop, allowAll ? 'All crops' : '');
    if (areaSelect) areaSelect.innerHTML = areaOptions(region, area, allowAll ? 'All market areas' : '');
  }

  function renderRegionalCatalog(region) {
    const title = document.querySelector('[data-regional-crop-title]');
    const list = document.querySelector('[data-regional-crop-list]');
    if (title) title.textContent = `Popular crops in ${REGIONS[region]?.label || region}`;
    if (list) list.innerHTML = crops(region).map(crop => `<span>${escapeHtml(crop)}</span>`).join('');
  }

  function updateRegionalPriceLabels(region) {
    const meta = REGIONS[region] || REGIONS.Nigeria;
    const listingLabel = document.querySelector('[data-listing-price-label]');
    const alertLabel = document.querySelector('[data-alert-price-label]');
    if (listingLabel) listingLabel.textContent = `Asking price (${meta.symbol})`;
    if (alertLabel) alertLabel.textContent = `Target price (${meta.symbol}/${meta.unit})`;
  }

  function hydrateControls() {
    const region = state.profile.region;
    const regionFilter = document.querySelector('[data-market-region-filter]');
    const cropFilter = document.querySelector('[data-market-crop-filter]');
    const areaFilter = document.querySelector('[data-market-area-filter]');
    if (regionFilter) regionFilter.innerHTML = regionOptions(region);
    setRegionalSelects(region, cropFilter, areaFilter, state.profile.crop, '', true);

    document.querySelectorAll('[data-alert-region]').forEach(select => { select.innerHTML = regionOptions(region); });
    document.querySelectorAll('[data-listing-region]').forEach(select => { select.innerHTML = regionOptions(region); });
    setRegionalSelects(region, document.querySelector('[data-alert-crop]'), document.querySelector('[data-alert-area]'), state.profile.crop, state.profile.area);
    setRegionalSelects(region, document.querySelector('[data-listing-crop]'), document.querySelector('[data-listing-area]'), state.profile.crop, state.profile.area);

    const form = document.querySelector('[data-market-alert-form]');
    if (form) {
      form.elements.region.value = state.profile.region;
      form.elements.crop.value = state.profile.crop;
      form.elements.area.value = state.profile.area;
      form.elements.targetPrice.value = state.profile.targetPrice || '';
      form.elements.rainThreshold.value = state.profile.rainThreshold || '60';
      form.querySelectorAll('[name="channel"]').forEach(input => {
        input.checked = (state.profile.channels || []).includes(input.value);
      });
    }

    const listingForm = document.querySelector('[data-produce-listing-form]');
    if (listingForm?.elements.region) listingForm.elements.region.value = region;
    if (listingForm?.elements.unit) listingForm.elements.unit.value = REGIONS[region].unit;
    const date = listingForm?.elements.availableDate;
    if (date && !date.value) date.value = new Date().toISOString().slice(0, 10);
    updateRegionalPriceLabels(region);
    renderRegionalCatalog(region);
  }

  function filteredSignals() {
    const region = document.querySelector('[data-market-region-filter]')?.value || state.profile.region;
    const crop = document.querySelector('[data-market-crop-filter]')?.value || '';
    const area = document.querySelector('[data-market-area-filter]')?.value || '';
    const sort = document.querySelector('[data-market-sort]')?.value || 'best';
    const values = PRICE_SIGNALS.filter(item => item.region === region && (!crop || item.crop === crop) && (!area || item.area === area));
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
        <td><strong>${formatPrice(item.price, item.region)}</strong><span>Planning reference</span></td>
        <td><span class="market-trend ${trendClass}">${trendSign}${item.trend.toFixed(1)}%</span></td>
        <td><span class="market-source">Demo reference</span></td>
      </tr>`;
    }).join('') || '<tr><td colspan="4"><div class="notice">No price references match these filters.</div></td></tr>';

    const best = values.reduce((winner, item) => !winner || item.price > winner.price ? item : winner, null);
    const bestValue = document.querySelector('[data-market-best]');
    const bestNote = document.querySelector('[data-market-best-note]');
    const movement = document.querySelector('[data-market-movement]');
    if (bestValue) bestValue.textContent = best ? formatPrice(best.price, best.region) : '—';
    if (bestNote) bestNote.textContent = best ? `${best.crop} · ${AREAS[best.area].label}` : 'No matching reference';
    if (movement) movement.textContent = best ? `${best.trend >= 0 ? '+' : ''}${best.trend.toFixed(1)}%` : '—';
    const region = document.querySelector('[data-market-region-filter]')?.value || state.profile.region;
    renderRegionalCatalog(region);
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
    const location = AREAS[area] || AREAS[firstArea(state.profile.region)];
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
    const cropSignals = PRICE_SIGNALS.filter(item => item.region === profile.region && item.crop === profile.crop);
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
          message: `${formatPrice(localSignal.price, profile.region)} is at or above your ${formatPrice(target, profile.region)} target in ${AREAS[profile.area].label}. Confirm a buyer’s actual offer before selling.`,
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

    if (!cropSignals.length) {
      alerts.push({
        type: 'insight',
        eyebrow: 'CROP PROFILE',
        title: `${profile.crop} is now in your regional catalogue`,
        message: `Weather and listing tools are ready for ${REGIONS[profile.region].label}. A verified market feed can be connected when a regional source is available.`,
        action: 'Create a produce listing'
      });
    }

    if (bestSignal && bestSignal.area !== profile.area) {
      alerts.push({
        type: 'insight',
        eyebrow: 'NEARBY SIGNAL',
        title: `${AREAS[bestSignal.area].label} shows the strongest reference`,
        message: `${formatPrice(bestSignal.price, profile.region)} for ${profile.crop}. Check transport cost and verified demand before changing markets.`,
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
    const region = item.region || AREAS[item.area]?.region || 'Nigeria';
    return `AgriSmart produce listing: ${item.quantity} ${item.unit} of ${item.crop}, available ${item.availableDate} in ${AREAS[item.area]?.label || item.area}, ${REGIONS[region].label}. Asking price: ${formatMoney(item.askingPrice, region, region === 'USA' ? 2 : 0)}. ${item.notes || ''} Please verify all trading terms before payment or collection.`;
  }

  function renderListings() {
    const root = document.querySelector('[data-produce-listings]');
    const count = document.querySelector('[data-market-listing-count]');
    const status = document.querySelector('[data-listing-status]');
    const active = state.listings.filter(item => item.status !== 'closed');
    if (count) count.textContent = String(active.length);
    if (status) status.textContent = `${active.length} active`;
    if (!root) return;
    root.innerHTML = active.length ? active.slice().reverse().map(item => {
      const region = item.region || AREAS[item.area]?.region || 'Nigeria';
      return `<article class="produce-listing">
      <div class="produce-listing-head"><div><span>${escapeHtml(item.crop)}</span><h4>${escapeHtml(item.quantity)} ${escapeHtml(item.unit)}</h4></div><strong>${formatMoney(item.askingPrice, region, region === 'USA' ? 2 : 0)}</strong></div>
      <p>${escapeHtml(AREAS[item.area]?.label || item.area)}, ${escapeHtml(REGIONS[region].label)} · Available ${escapeHtml(item.availableDate)}</p>
      ${item.notes ? `<small>${escapeHtml(item.notes)}</small>` : ''}
      <div class="produce-listing-actions">
        <button class="secondary-btn" type="button" data-share-listing="${escapeHtml(item.id)}">Share</button>
        <button class="secondary-btn" type="button" data-close-listing="${escapeHtml(item.id)}">Mark sold</button>
      </div>
    </article>`;
    }).join('') : '<div class="market-empty"><strong>No active produce listings yet.</strong><p>Create one when your harvest is ready for market.</p></div>';
  }

  function saveProfile(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    state.profile = normalizeProfile({
      region: String(data.get('region')),
      crop: String(data.get('crop')),
      area: String(data.get('area')),
      targetPrice: String(data.get('targetPrice') || ''),
      rainThreshold: String(data.get('rainThreshold') || '60'),
      channels: data.getAll('channel').map(String)
    });
    if (!state.profile.channels.length) state.profile.channels = ['in-app'];
    write(PROFILE_KEY, state.profile);
    const cropFilter = document.querySelector('[data-market-crop-filter]');
    const areaFilter = document.querySelector('[data-market-area-filter]');
    const regionFilter = document.querySelector('[data-market-region-filter]');
    if (regionFilter) regionFilter.value = state.profile.region;
    setRegionalSelects(state.profile.region, cropFilter, areaFilter, state.profile.crop, state.profile.area, true);
    if (cropFilter) cropFilter.value = state.profile.crop;
    if (areaFilter) areaFilter.value = state.profile.area;
    updateRegionalPriceLabels(state.profile.region);
    renderPriceBoard();
    generateAlerts();
    fetchWeather(state.profile.area);
    toast('Farmer alert profile saved.');
  }

  function saveListing(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const region = REGIONS[data.region] ? String(data.region) : 'Nigeria';
    const listing = {
      id: `listing-${Date.now()}`,
      region,
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
    if (form.elements.region) form.elements.region.value = state.profile.region;
    setRegionalSelects(state.profile.region, form.elements.crop, form.elements.area, state.profile.crop, state.profile.area);
    if (form.elements.unit) form.elements.unit.value = REGIONS[state.profile.region].unit;
    updateRegionalPriceLabels(state.profile.region);
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
    utterance.lang = { Nigeria: 'en-NG', USA: 'en-US', Ghana: 'en-GH', Kenya: 'en-KE', India: 'en-IN' }[state.profile.region] || 'en';
    utterance.rate = 0.92;
    speechSynthesis.speak(utterance);
  }

  function bindEvents() {
    document.querySelector('[data-market-region-filter]')?.addEventListener('change', event => {
      const region = event.currentTarget.value;
      setRegionalSelects(region, document.querySelector('[data-market-crop-filter]'), document.querySelector('[data-market-area-filter]'), '', '', true);
      renderPriceBoard();
    });
    document.querySelector('[data-alert-region]')?.addEventListener('change', event => {
      const region = event.currentTarget.value;
      setRegionalSelects(region, document.querySelector('[data-alert-crop]'), document.querySelector('[data-alert-area]'));
      updateRegionalPriceLabels(region);
    });
    document.querySelector('[data-listing-region]')?.addEventListener('change', event => {
      const region = event.currentTarget.value;
      setRegionalSelects(region, document.querySelector('[data-listing-crop]'), document.querySelector('[data-listing-area]'));
      const form = event.currentTarget.closest('form');
      if (form?.elements.unit) form.elements.unit.value = REGIONS[region].unit;
      updateRegionalPriceLabels(region);
    });
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
    getRegions: () => Object.entries(REGIONS).map(([id, item]) => ({ id, ...item })),
    getCrops: region => crops(REGIONS[region] ? region : state.profile.region).slice(),
    getSignals: region => PRICE_SIGNALS.filter(item => !region || item.region === region).map(item => ({ ...item })),
    refresh: () => fetchWeather(state.profile.area)
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
