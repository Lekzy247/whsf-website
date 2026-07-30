(() => {
  'use strict';

  const WEATHER_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
  const LOCATION_KEY = 'agrismart-last-location';
  const CACHE_KEY = 'agrismart-live-advice-cache-v1';
  const CACHE_TTL = 30 * 60 * 1000;

  const countryFallbacks = Object.freeze({
    NG: { latitude: 9.0765, longitude: 7.3986, label: 'Abuja, Nigeria' },
    GH: { latitude: 5.6037, longitude: -0.187, label: 'Accra, Ghana' },
    MW: { latitude: -13.9626, longitude: 33.7741, label: 'Lilongwe, Malawi' },
    SL: { latitude: 8.4657, longitude: -13.2317, label: 'Freetown, Sierra Leone' },
    ZA: { latitude: -25.7479, longitude: 28.2293, label: 'Pretoria, South Africa' },
    SN: { latitude: 14.7167, longitude: -17.4677, label: 'Dakar, Senegal' },
    CI: { latitude: 5.36, longitude: -4.0083, label: "Abidjan, Côte d'Ivoire" },
    GB: { latitude: 51.5072, longitude: -0.1276, label: 'London, United Kingdom' },
    US: { latitude: 38.9072, longitude: -77.0369, label: 'Washington, United States' },
    CA: { latitude: 45.4215, longitude: -75.6972, label: 'Ottawa, Canada' },
    AU: { latitude: -35.2809, longitude: 149.13, label: 'Canberra, Australia' },
    IE: { latitude: 53.3498, longitude: -6.2603, label: 'Dublin, Ireland' }
  });

  const number = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  function recommend(data = {}) {
    const results = [];
    const soilMoisture = number(data.soilMoisture, 100);
    const temperature = number(data.temperature, 25);
    const rainForecast = number(data.rainForecast, 0);
    const pestRisk = number(data.pestRisk, 0);
    const cropStage = String(data.cropStage || '').toLowerCase();

    if (soilMoisture < 30) results.push({ level: 'high', title: 'Low soil moisture', action: 'Schedule irrigation within 24 hours and confirm the root zone is receiving enough water.' });
    if (temperature > 35) results.push({ level: 'medium', title: 'High temperature', action: 'Irrigate during cooler hours, protect young plants and monitor livestock or crops for heat stress.' });
    if (rainForecast > 40) results.push({ level: 'info', title: 'Rain expected', action: 'Delay irrigation and avoid fertilizer or pesticide application immediately before rainfall.' });
    if (pestRisk > 70) results.push({ level: 'high', title: 'High pest risk', action: 'Inspect fields, document symptoms and use an approved integrated pest-management response.' });
    if (cropStage === 'harvest') results.push({ level: 'info', title: 'Harvest readiness', action: 'Confirm labor, transport, storage space, packaging and buyer arrangements.' });
    if (!results.length) results.push({ level: 'good', title: 'Farm conditions stable', action: 'Continue routine monitoring and update field observations as conditions change.' });
    return results;
  }

  function getStoredLocation() {
    try {
      const location = JSON.parse(localStorage.getItem(LOCATION_KEY) || 'null');
      if (Number.isFinite(Number(location?.latitude)) && Number.isFinite(Number(location?.longitude))) {
        return { latitude: Number(location.latitude), longitude: Number(location.longitude), label: 'Saved farm location' };
      }
    } catch {}
    const country = window.AgriSmartSettings?.get?.().country || 'NG';
    return countryFallbacks[country] || countryFallbacks.NG;
  }

  function readCache(location) {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      const sameLocation = Math.abs(cached.latitude - location.latitude) < 0.01 && Math.abs(cached.longitude - location.longitude) < 0.01;
      if (sameLocation && Date.now() - cached.savedAt < CACHE_TTL) return cached.payload;
    } catch {}
    return null;
  }

  function writeCache(location, payload) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ...location, payload, savedAt: Date.now() })); } catch {}
  }

  async function fetchWeather(location, force = false) {
    if (!navigator.onLine) throw new Error('You are offline. Reconnect to retrieve live advice.');
    const cached = !force && readCache(location);
    if (cached) return { ...cached, cached: true };

    const params = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      current: 'temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,rain_sum,precipitation_probability_max,wind_speed_10m_max',
      forecast_days: '7',
      timezone: 'auto'
    });
    const response = await fetch(`${WEATHER_ENDPOINT}?${params}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Live weather service returned ${response.status}.`);
    const payload = await response.json();
    writeCache(location, payload);
    return payload;
  }

  function buildLiveAdvice(weather, farmData = {}, location) {
    const current = weather.current || {};
    const daily = weather.daily || {};
    const rainProbability = Math.max(...(daily.precipitation_probability_max || [0]).map(value => number(value)));
    const totalRain = (daily.precipitation_sum || []).slice(0, 3).reduce((sum, value) => sum + number(value), 0);
    const maxTemperature = Math.max(...(daily.temperature_2m_max || [number(current.temperature_2m, 25)]).map(value => number(value)));
    const maxWind = Math.max(...(daily.wind_speed_10m_max || [number(current.wind_speed_10m, 0)]).map(value => number(value)));
    const advice = recommend({ ...farmData, temperature: maxTemperature, rainForecast: rainProbability });

    if (totalRain >= 20) advice.unshift({ level: 'info', title: `${totalRain.toFixed(1)} mm rain forecast`, action: 'Inspect drainage, postpone unnecessary irrigation and avoid applying inputs that may wash away during the next three days.' });
    else if (totalRain < 3 && maxTemperature >= 30) advice.unshift({ level: 'high', title: 'Dry and hot conditions expected', action: 'Check soil moisture daily and prioritize water for newly planted, flowering or shallow-rooted crops.' });

    if (maxWind >= 30) advice.push({ level: 'medium', title: 'Strong wind risk', action: 'Avoid spraying during high winds, secure lightweight structures and inspect young plants for lodging.' });
    if (number(current.relative_humidity_2m) >= 85) advice.push({ level: 'medium', title: 'High humidity', action: 'Increase disease scouting, especially for fungal symptoms, and improve ventilation where possible.' });

    return {
      advice,
      conditions: {
        temperature: number(current.temperature_2m),
        humidity: number(current.relative_humidity_2m),
        windSpeed: number(current.wind_speed_10m),
        rainProbability,
        threeDayRain: totalRain,
        maxTemperature
      },
      location,
      source: 'Open-Meteo',
      updatedAt: new Date().toISOString(),
      cached: Boolean(weather.cached)
    };
  }

  async function getLiveAdvice(farmData = {}, options = {}) {
    const location = options.location || getStoredLocation();
    const weather = await fetchWeather(location, Boolean(options.force));
    return buildLiveAdvice(weather, farmData, location);
  }

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  function enhanceAdvisorForm() {
    const form = document.querySelector('[data-advisor-form]');
    if (!form || form.querySelector('[data-live-advice]')) return;
    const submit = form.querySelector('[type="submit"]');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary-btn';
    button.dataset.liveAdvice = '';
    button.textContent = 'Get live internet advice';
    submit?.insertAdjacentElement('afterend', button);

    button.addEventListener('click', async () => {
      const target = document.querySelector('[data-advisor-results]');
      button.disabled = true;
      button.textContent = 'Checking live conditions...';
      if (target) target.innerHTML = '<div class="notice">Connecting to the live weather service and analyzing current farm conditions...</div>';
      try {
        const result = await getLiveAdvice(Object.fromEntries(new FormData(form)), { force: true });
        if (target) target.innerHTML = `
          <article><strong>Live conditions for ${escapeHtml(result.location.label)}</strong><p>${result.conditions.temperature.toFixed(1)}°C · ${result.conditions.humidity.toFixed(0)}% humidity · ${result.conditions.windSpeed.toFixed(1)} km/h wind · ${result.conditions.rainProbability.toFixed(0)}% rain probability</p><span class="chip">${escapeHtml(result.source)}</span></article>
          ${result.advice.map(item => `<article><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.action)}</p><span class="chip">${escapeHtml(item.level)}</span></article>`).join('')}
          <div class="notice">Updated ${new Date(result.updatedAt).toLocaleString()}. Advice combines live weather data with the information entered above; verify chemical, veterinary and safety decisions with a qualified local professional.</div>`;
      } catch (error) {
        const local = recommend(Object.fromEntries(new FormData(form)));
        if (target) target.innerHTML = `<div class="notice">${escapeHtml(error.message || 'Live advice is temporarily unavailable.')}</div>${local.map(item => `<article><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.action)}</p><span class="chip">offline guidance</span></article>`).join('')}`;
      } finally {
        button.disabled = false;
        button.textContent = 'Get live internet advice';
      }
    });
  }

  window.AgriSmartAdvisor = Object.freeze({
    recommend,
    getLiveAdvice,
    getLocation: getStoredLocation,
    getForecast: fetchWeather
  });
  enhanceAdvisorForm();
  window.addEventListener('agrismart:extendedmodulesready', enhanceAdvisorForm);
})();
