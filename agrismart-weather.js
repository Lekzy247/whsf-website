(() => {
  'use strict';

  const GEOCODING_ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/search';
  const FORECAST_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
  const LOCATION_KEY = 'agrismart-last-location';
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;

  const weatherCodes = Object.freeze({
    0: ['☀️', 'Clear sky'],
    1: ['🌤️', 'Mainly clear'],
    2: ['⛅', 'Partly cloudy'],
    3: ['☁️', 'Overcast'],
    45: ['🌫️', 'Fog'],
    48: ['🌫️', 'Freezing fog'],
    51: ['🌦️', 'Light drizzle'],
    53: ['🌦️', 'Drizzle'],
    55: ['🌧️', 'Heavy drizzle'],
    61: ['🌦️', 'Light rain'],
    63: ['🌧️', 'Rain'],
    65: ['🌧️', 'Heavy rain'],
    71: ['🌨️', 'Light snow'],
    73: ['🌨️', 'Snow'],
    75: ['❄️', 'Heavy snow'],
    80: ['🌦️', 'Rain showers'],
    81: ['🌧️', 'Rain showers'],
    82: ['⛈️', 'Heavy showers'],
    95: ['⛈️', 'Thunderstorm'],
    96: ['⛈️', 'Thunderstorm with hail'],
    99: ['⛈️', 'Severe thunderstorm']
  });

  function condition(code) {
    return weatherCodes[Number(code)] || ['🌤️', 'Mixed conditions'];
  }

  function saveLocation(location) {
    try {
      localStorage.setItem(LOCATION_KEY, JSON.stringify(location));
    } catch {}
  }

  function ensurePanel() {
    let view = document.querySelector('[data-view-panel="weather"]');
    const main = document.querySelector('.app-content') || document.querySelector('.app-main');
    if (!view && main) {
      view = document.createElement('section');
      view.className = 'view';
      view.dataset.viewPanel = 'weather';
      view.innerHTML = `
        <div class="section-heading">
          <p class="eyebrow">Live field planning</p>
          <h2>Farm Weather</h2>
          <p>Use current conditions and a seven-day forecast to plan irrigation, spraying, harvesting and fieldwork.</p>
        </div>
        <div data-weather-panel></div>`;
      main.insertBefore(view, document.querySelector('[data-view-panel="advisor"]') || document.querySelector('[data-view-panel="settings"]') || null);
    }

    const nav = document.querySelector('.app-nav');
    if (nav && !nav.querySelector('[data-view="weather"]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.view = 'weather';
      button.textContent = '☀ Farm Weather';
      nav.insertBefore(button, nav.querySelector('[data-view="advisor"]') || nav.querySelector('[data-view="settings"]') || null);
    }
    return view?.querySelector('[data-weather-panel]') || null;
  }

  async function searchLocation(query) {
    const params = new URLSearchParams({ name: query, count: '5', language: 'en', format: 'json' });
    const response = await fetch(`${GEOCODING_ENDPOINT}?${params}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Location search returned ${response.status}.`);
    const payload = await response.json();
    const match = payload.results?.[0];
    if (!match) throw new Error('No matching location was found. Try a nearby city or district.');
    return {
      latitude: number(match.latitude),
      longitude: number(match.longitude),
      label: [match.name, match.admin1, match.country].filter(Boolean).join(', ')
    };
  }

  async function fetchForecast(location, force = false) {
    if (window.AgriSmartAdvisor?.getForecast) {
      return window.AgriSmartAdvisor.getForecast(location, force);
    }
    const params = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      current: 'temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,rain_sum,precipitation_probability_max,wind_speed_10m_max',
      forecast_days: '7',
      timezone: 'auto'
    });
    const response = await fetch(`${FORECAST_ENDPOINT}?${params}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Weather service returned ${response.status}.`);
    return response.json();
  }

  function temperature(value) {
    const settings = window.AgriSmartSettings?.get?.() || {};
    if (settings.temperatureUnit === 'fahrenheit') return `${((number(value) * 9 / 5) + 32).toFixed(0)}°F`;
    return `${number(value).toFixed(0)}°C`;
  }

  function buildGuidance(weather) {
    const current = weather.current || {};
    const daily = weather.daily || {};
    const rainNextThree = (daily.precipitation_sum || []).slice(0, 3).reduce((sum, value) => sum + number(value), 0);
    const peakRainChance = Math.max(...(daily.precipitation_probability_max || [0]).map(number));
    const peakWind = Math.max(...(daily.wind_speed_10m_max || [number(current.wind_speed_10m)]).map(number));
    const peakHeat = Math.max(...(daily.temperature_2m_max || [number(current.temperature_2m)]).map(number));
    const guidance = [];

    if (rainNextThree >= 20) {
      guidance.push(['Irrigation', 'Pause non-essential irrigation and inspect drainage before the expected rainfall.']);
    } else if (rainNextThree < 4 && peakHeat >= 30) {
      guidance.push(['Irrigation', 'Check root-zone moisture daily and irrigate during cooler morning or evening hours.']);
    } else {
      guidance.push(['Irrigation', 'Maintain the current schedule and confirm soil moisture before each irrigation cycle.']);
    }

    if (peakWind >= 25 || peakRainChance >= 55) {
      guidance.push(['Spraying', 'Avoid spraying during windy periods or before likely rainfall; use the calmest dry window.']);
    } else {
      guidance.push(['Spraying', 'Conditions may allow spraying, but confirm wind at field level and follow the product label.']);
    }

    if (number(current.relative_humidity_2m) >= 80 || rainNextThree >= 12) {
      guidance.push(['Crop health', 'Increase scouting for fungal symptoms and improve ventilation around dense crops.']);
    } else {
      guidance.push(['Crop health', 'Continue routine scouting and record any change in leaf colour, pests or disease symptoms.']);
    }

    const rain = daily.precipitation_probability_max || [];
    const wind = daily.wind_speed_10m_max || [];
    const bestIndex = (daily.time || []).reduce((best, _date, index) => {
      const score = number(rain[index]) + number(wind[index]) * 1.5;
      return score < best.score ? { index, score } : best;
    }, { index: 0, score: Infinity }).index;
    const bestDate = daily.time?.[bestIndex]
      ? new Intl.DateTimeFormat('en', { weekday: 'long' }).format(new Date(`${daily.time[bestIndex]}T12:00:00`))
      : 'the driest forecast day';
    guidance.push(['Fieldwork window', `${bestDate} currently offers the lowest combined rain and wind risk.`]);
    return { guidance, rainNextThree, peakRainChance, peakWind, peakHeat, bestDate };
  }

  function forecastCards(weather) {
    const daily = weather.daily || {};
    return (daily.time || []).map((date, index) => {
      const [icon, label] = condition(daily.weather_code?.[index]);
      const day = new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' })
        .format(new Date(`${date}T12:00:00`));
      return `
        <article class="forecast-card">
          <strong>${escapeHtml(day)}</strong>
          <span class="forecast-icon" aria-hidden="true">${icon}</span>
          <span>${escapeHtml(label)}</span>
          <small>${escapeHtml(temperature(daily.temperature_2m_max?.[index]))} / ${escapeHtml(temperature(daily.temperature_2m_min?.[index]))}</small>
          <span>Rain ${number(daily.precipitation_probability_max?.[index]).toFixed(0)}%</span>
          <span>Wind ${number(daily.wind_speed_10m_max?.[index]).toFixed(0)} km/h</span>
        </article>`;
    }).join('');
  }

  function renderForecast(root, weather, location) {
    const current = weather.current || {};
    const [icon, label] = condition(current.weather_code);
    const summary = buildGuidance(weather);
    root.querySelector('[data-weather-content]').innerHTML = `
      <div class="dashboard-grid" style="margin-top:18px">
        <section class="panel">
          <div class="panel-head"><div><h3>${escapeHtml(location.label)}</h3><p>Current field conditions</p></div><span class="chip">Live</span></div>
          <div class="weather-current">
            <div class="weather-current-icon" aria-hidden="true">${icon}</div>
            <div><strong>${escapeHtml(temperature(current.temperature_2m))}</strong><p>${escapeHtml(label)} · ${number(current.relative_humidity_2m).toFixed(0)}% humidity · ${number(current.wind_speed_10m).toFixed(1)} km/h wind</p></div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><div><h3>Forecast overview</h3><p>Seven-day operational summary</p></div></div>
          <div class="metric-grid" style="grid-template-columns:repeat(2,minmax(0,1fr));margin:0">
            <article class="metric-card"><span>Rain, next 3 days</span><strong>${summary.rainNextThree.toFixed(1)} mm</strong></article>
            <article class="metric-card"><span>Peak rain chance</span><strong>${summary.peakRainChance.toFixed(0)}%</strong></article>
            <article class="metric-card"><span>Highest temperature</span><strong>${escapeHtml(temperature(summary.peakHeat))}</strong></article>
            <article class="metric-card"><span>Strongest wind</span><strong>${summary.peakWind.toFixed(0)} km/h</strong></article>
          </div>
        </section>
      </div>

      <section class="panel" style="margin-top:18px">
        <div class="panel-head"><div><h3>Seven-day forecast</h3><p>Daily conditions for field planning.</p></div></div>
        <div class="forecast-grid">${forecastCards(weather)}</div>
      </section>

      <section class="panel" style="margin-top:18px">
        <div class="panel-head"><div><h3>Fieldwork guidance</h3><p>Practical recommendations based on forecast conditions.</p></div><span class="chip">Decision support</span></div>
        <div class="result-list">${summary.guidance.map(([title, text]) => `<article><strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p></article>`).join('')}</div>
        <p class="weather-source">Updated ${new Date().toLocaleString()} · Weather data: Open-Meteo. Confirm local conditions before chemical, safety or livestock decisions.</p>
      </section>`;
  }

  async function load(root, location, force = false) {
    const content = root.querySelector('[data-weather-content]');
    content.innerHTML = '<div class="panel notice" style="margin-top:18px">Retrieving live weather and preparing field guidance…</div>';
    try {
      const weather = await fetchForecast(location, force);
      saveLocation(location);
      renderForecast(root, weather, location);
    } catch (error) {
      content.innerHTML = `<div class="panel notice" style="margin-top:18px">${escapeHtml(error.message || 'Live weather is temporarily unavailable.')} Check the connection or try another location.</div>`;
    }
  }

  function render() {
    const root = ensurePanel();
    if (!root || root.dataset.ready === 'true') return root;
    root.dataset.ready = 'true';
    root.innerHTML = `
      <section class="panel">
        <div class="weather-toolbar">
          <form data-weather-search>
            <label class="field"><span>Farm location</span><input name="location" autocomplete="address-level2" placeholder="Search city, town or district" required></label>
            <button class="primary-btn" type="submit">Search forecast</button>
          </form>
          <button class="secondary-btn" type="button" data-weather-geolocate>Use current location</button>
        </div>
        <div class="notice" data-weather-status>Search for a farm location or use the saved farm coordinates.</div>
      </section>
      <div data-weather-content></div>`;

    root.querySelector('[data-weather-search]')?.addEventListener('submit', async event => {
      event.preventDefault();
      const query = String(new FormData(event.currentTarget).get('location') || '').trim();
      const status = root.querySelector('[data-weather-status]');
      status.textContent = `Searching for ${query}…`;
      try {
        const location = await searchLocation(query);
        status.textContent = `Forecast location: ${location.label}`;
        await load(root, location, true);
      } catch (error) {
        status.textContent = error.message || 'Location search failed.';
      }
    });

    root.querySelector('[data-weather-geolocate]')?.addEventListener('click', () => {
      const status = root.querySelector('[data-weather-status]');
      if (!navigator.geolocation) {
        status.textContent = 'Location services are not supported on this device.';
        return;
      }
      status.textContent = 'Waiting for location permission…';
      navigator.geolocation.getCurrentPosition(
        position => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            label: 'Current device location'
          };
          status.textContent = 'Using the current device location.';
          load(root, location, true);
        },
        () => { status.textContent = 'Location access was unavailable. Search for a nearby town instead.'; },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
      );
    });

    const initial = window.AgriSmartAdvisor?.getLocation?.() || { latitude: 9.0765, longitude: 7.3986, label: 'Abuja, Nigeria' };
    root.querySelector('[data-weather-status]').textContent = `Forecast location: ${initial.label || 'Saved farm location'}`;
    load(root, initial);
    return root;
  }

  window.AgriSmartWeatherWorkspace = Object.freeze({ render, searchLocation, load });
  ['agrismart:settingschange', 'agrismart:extendedmodulesready'].forEach(eventName => window.addEventListener(eventName, render));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render, { once: true });
  else render();
})();
