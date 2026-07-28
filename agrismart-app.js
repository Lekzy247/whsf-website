(() => {
  const views = [...document.querySelectorAll('.view')];
  const navButtons = [...document.querySelectorAll('[data-view]')];
  const title = document.querySelector('[data-page-title]');
  const subtitle = document.querySelector('[data-page-subtitle]');
  const topActions = document.querySelector('.top-actions');
  const sidebar = document.querySelector('.app-sidebar');
  const pageMeta = {
    home: ['Good evening, Farmer', 'Here is today’s farm intelligence and activity.'],
    scan: ['AI Crop Scanner', 'Upload a crop image for a guided diagnostic preview.'],
    weather: ['Farm Weather', 'Plan planting, irrigation and spraying with local guidance.'],
    farm: ['My Farm', 'Manage fields, crops, tasks and production records.'],
    marketplace: ['Marketplace', 'Buy farm inputs, sell produce and connect with buyers.'],
    services: ['Agricultural Services', 'Find trusted equipment, logistics and technical support.'],
    academy: ['AgriSmart Academy', 'Build practical knowledge through farmer-focused learning.'],
    assistant: ['AgriSmart AI Assistant', 'Ask questions and receive practical farming guidance.']
  };

  const escapeHtml = value => String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));

  const toast = message => {
    document.querySelector('.toast')?.remove();
    const element = document.createElement('div');
    element.className = 'toast';
    element.setAttribute('role', 'status');
    element.textContent = message;
    document.body.appendChild(element);
    setTimeout(() => element.remove(), 2800);
  };

  function closeMobileMenu() {
    sidebar?.classList.remove('open');
    document.querySelector('.mobile-overlay')?.classList.remove('open');
  }

  function showView(name, updateHash = true) {
    if (!pageMeta[name]) name = 'home';
    views.forEach(view => view.classList.toggle('active', view.dataset.viewPanel === name));
    navButtons.forEach(button => button.classList.toggle('active', button.dataset.view === name));
    if (title) title.textContent = pageMeta[name][0];
    if (subtitle) subtitle.textContent = pageMeta[name][1];
    if (updateHash && location.hash !== `#${name}`) history.replaceState(null, '', `#${name}`);
    closeMobileMenu();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  navButtons.forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
  window.addEventListener('hashchange', () => showView(location.hash.slice(1), false));
  showView(location.hash.slice(1) || 'home', false);

  const overlay = document.createElement('div');
  overlay.className = 'mobile-overlay';
  overlay.addEventListener('click', closeMobileMenu);
  document.body.appendChild(overlay);
  document.querySelector('.mobile-menu')?.addEventListener('click', () => {
    sidebar?.classList.toggle('open');
    overlay.classList.toggle('open');
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeMobileMenu();
      document.querySelector('.notification-panel')?.setAttribute('hidden', '');
    }
  });

  const manifest = document.createElement('link');
  manifest.rel = 'manifest';
  manifest.href = 'agrismart-manifest.webmanifest';
  document.head.appendChild(manifest);

  const appleIcon = document.createElement('link');
  appleIcon.rel = 'apple-touch-icon';
  appleIcon.href = 'assets/whsf-logo.jpg';
  document.head.appendChild(appleIcon);

  const savedTheme = localStorage.getItem('agrismart-theme');
  if (savedTheme === 'dark' || (!savedTheme && matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.body.classList.add('dark-mode');
  }
  const themeButton = document.createElement('button');
  themeButton.className = 'secondary-btn';
  themeButton.type = 'button';
  themeButton.dataset.themeToggle = 'true';
  const updateThemeLabel = () => {
    const dark = document.body.classList.contains('dark-mode');
    themeButton.textContent = dark ? '☀ Light' : '◐ Dark';
    themeButton.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  };
  updateThemeLabel();
  themeButton.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('agrismart-theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
    updateThemeLabel();
    toast('Display theme updated');
  });
  topActions?.appendChild(themeButton);

  const connectionBadge = document.createElement('span');
  connectionBadge.className = 'chip';
  connectionBadge.setAttribute('role', 'status');
  connectionBadge.setAttribute('aria-live', 'polite');
  topActions?.prepend(connectionBadge);
  const updateConnectionBadge = () => {
    connectionBadge.textContent = navigator.onLine ? 'Online' : 'Offline mode';
    connectionBadge.title = navigator.onLine ? 'Connected to the internet' : 'Cached app features remain available';
  };
  updateConnectionBadge();
  window.addEventListener('online', () => { updateConnectionBadge(); toast('Internet connection restored'); });
  window.addEventListener('offline', () => { updateConnectionBadge(); toast('Offline mode is active'); });

  const notificationButton = document.createElement('button');
  notificationButton.className = 'icon-btn';
  notificationButton.type = 'button';
  notificationButton.textContent = '🔔';
  notificationButton.setAttribute('aria-label', 'Open notifications');
  notificationButton.setAttribute('aria-expanded', 'false');
  const notificationPanel = document.createElement('section');
  notificationPanel.className = 'notification-panel';
  notificationPanel.hidden = true;
  notificationPanel.innerHTML = `
    <h3>Farm alerts</h3>
    <article><strong>Rain planning reminder</strong><p>Review drainage and field access before the next major rainfall.</p></article>
    <article><strong>Crop check due</strong><p>Inspect maize leaves for discoloration, pest damage and moisture stress.</p></article>
    <article><strong>Record keeping</strong><p>Add this week’s input costs and field activity to your farm records.</p></article>`;
  document.body.appendChild(notificationPanel);
  notificationButton.addEventListener('click', () => {
    notificationPanel.hidden = !notificationPanel.hidden;
    notificationButton.setAttribute('aria-expanded', String(!notificationPanel.hidden));
  });
  topActions?.prepend(notificationButton);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('agrismart-sw.js').catch(() => {}));
  }

  let installPrompt;
  const installButton = document.createElement('button');
  installButton.className = 'secondary-btn';
  installButton.type = 'button';
  installButton.textContent = 'Install App';
  installButton.hidden = true;
  topActions?.appendChild(installButton);
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    installButton.hidden = false;
  });
  installButton.addEventListener('click', async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const result = await installPrompt.userChoice;
    toast(result.outcome === 'accepted' ? 'AgriSmart installation started' : 'Installation cancelled');
    installPrompt = null;
    installButton.hidden = true;
  });
  window.addEventListener('appinstalled', () => { installButton.hidden = true; toast('AgriSmart Connect installed'); });

  const fileInput = document.querySelector('#crop-photo');
  const preview = document.querySelector('.scan-preview');
  const scanPlaceholder = document.querySelector('[data-scan-placeholder]');
  const analyzeButton = document.querySelector('[data-analyze]');
  const diagnosis = document.querySelector('[data-diagnosis]');
  fileInput?.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      diagnosis.innerHTML = '<div class="notice">Please choose a valid image file.</div>';
      return;
    }
    preview.src = URL.createObjectURL(file);
    preview.style.display = 'block';
    scanPlaceholder.hidden = true;
    analyzeButton.disabled = false;
    diagnosis.innerHTML = '<div class="notice">Image ready. Select “Analyze crop” to run the guided diagnostic demonstration.</div>';
  });

  analyzeButton?.addEventListener('click', () => {
    analyzeButton.disabled = true;
    analyzeButton.textContent = 'Analyzing…';
    setTimeout(() => {
      diagnosis.innerHTML = `
        <span class="result-badge">Diagnostic preview · 87% confidence</span>
        <h3>Possible nitrogen deficiency</h3>
        <p>Lower leaves appear pale or yellow while newer growth remains greener. Similar symptoms may also result from water stress or root problems.</p>
        <div class="result-list">
          <article><strong>Recommended next step</strong><p>Inspect soil moisture and drainage, then confirm with a soil or leaf test before applying fertilizer.</p></article>
          <article><strong>Low-cost action</strong><p>Add well-composted organic matter around the root zone without touching the stem.</p></article>
          <article><strong>Prevention</strong><p>Keep field records, rotate crops and apply nutrients according to tested soil requirements.</p></article>
        </div>
        <div class="notice">This prototype provides educational guidance and is not a laboratory diagnosis. Consult a qualified agronomist before treatment.</div>`;
      analyzeButton.textContent = 'Analyze another image';
      analyzeButton.disabled = false;
      toast('Crop diagnostic preview completed');
    }, 1300);
  });

  const FARM_STORAGE_KEY = 'agrismart-farms-v1';
  const farmForm = document.querySelector('#farm-form');
  const farmList = document.querySelector('[data-farm-list]');
  const getFarms = () => {
    try { return JSON.parse(localStorage.getItem(FARM_STORAGE_KEY)) || []; }
    catch { return []; }
  };
  const renderFarm = farm => {
    const item = document.createElement('div');
    item.className = 'order-item';
    item.dataset.savedFarm = 'true';
    item.innerHTML = `<div><strong>${escapeHtml(farm.name)}</strong><div>${escapeHtml(farm.crop)} · ${escapeHtml(farm.size)} hectares · ${escapeHtml(farm.location)}</div></div><button class="chip" type="button" aria-label="Remove ${escapeHtml(farm.name)}">Remove</button>`;
    item.querySelector('button').addEventListener('click', () => {
      localStorage.setItem(FARM_STORAGE_KEY, JSON.stringify(getFarms().filter(saved => saved.id !== farm.id)));
      item.remove();
      toast('Farm record removed');
    });
    farmList?.appendChild(item);
  };
  getFarms().forEach(renderFarm);

  farmForm?.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(farmForm);
    const farm = {
      id: Date.now(),
      name: String(data.get('farmName') || '').trim(),
      crop: String(data.get('crop') || ''),
      size: String(data.get('size') || ''),
      location: String(data.get('location') || '').trim(),
      notes: String(data.get('notes') || '').trim()
    };
    if (!farm.name || !farm.crop || !farm.size || !farm.location) return;
    const farms = getFarms();
    farms.push(farm);
    localStorage.setItem(FARM_STORAGE_KEY, JSON.stringify(farms));
    renderFarm(farm);
    farmForm.reset();
    toast('Farm record saved on this device');
  });

  document.querySelectorAll('[data-market-action]').forEach(button => {
    button.addEventListener('click', () => {
      const original = button.textContent;
      button.textContent = 'Request saved';
      button.disabled = true;
      toast('Marketplace request saved');
      setTimeout(() => { button.textContent = original; button.disabled = false; }, 1600);
    });
  });

  document.querySelectorAll('.quick-action').forEach(button => {
    button.addEventListener('click', () => {
      const label = button.textContent.toLowerCase();
      if (label.includes('scan')) showView('scan');
      else if (label.includes('weather')) showView('weather');
      else if (label.includes('farm') || label.includes('field')) showView('farm');
      else if (label.includes('market')) showView('marketplace');
      else toast('This feature is being prepared for the next release');
    });
  });

  document.querySelectorAll('.map-box').forEach(map => {
    map.setAttribute('role', 'button');
    map.setAttribute('tabindex', '0');
    map.setAttribute('aria-label', 'Use current location for farm map');
    const locate = () => {
      if (!navigator.geolocation) return toast('Location services are not supported on this device');
      toast('Requesting your location…');
      navigator.geolocation.getCurrentPosition(position => {
        const { latitude, longitude } = position.coords;
        map.title = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        localStorage.setItem('agrismart-last-location', JSON.stringify({ latitude, longitude }));
        toast(`Farm location captured: ${latitude.toFixed(3)}, ${longitude.toFixed(3)}`);
      }, () => toast('Location permission was not granted'));
    };
    map.addEventListener('click', locate);
    map.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') locate(); });
  });

  const chatForm = document.querySelector('#ai-chat-form');
  const chatInput = document.querySelector('#ai-question');
  const chatLog = document.querySelector('[data-chat-log]');
  const answers = [
    'Yellowing leaves can result from nutrient deficiency, excess water, drought, pests or disease. Check which leaves are affected first, inspect moisture and roots, and upload a clear image in the Crop Scanner.',
    'For maize, planting time should follow the start of reliable rainfall rather than the first isolated shower. Prepare drainage, use suitable seed and review your local extension guidance.',
    'Before spraying, confirm the pest, check wind and rain conditions, read the product label and use appropriate protective equipment. Avoid preventive pesticide use without evidence of a problem.',
    'Keep records of planting dates, input costs, field observations, harvest quantity and selling price. Consistent records make it easier to compare seasons and improve profitability.'
  ];
  chatForm?.addEventListener('submit', event => {
    event.preventDefault();
    const question = chatInput.value.trim();
    if (!question) return;
    chatLog.insertAdjacentHTML('beforeend', `<article class="order-item" style="display:block"><strong>You</strong><p>${escapeHtml(question)}</p></article>`);
    chatInput.value = '';
    const response = answers[Math.floor(Math.random() * answers.length)];
    setTimeout(() => {
      chatLog.insertAdjacentHTML('beforeend', `<article class="order-item" style="display:block"><strong>AgriSmart Assistant</strong><p>${response}</p></article>`);
      chatLog.scrollTop = chatLog.scrollHeight;
    }, 500);
  });

  document.querySelectorAll('[data-prompt]').forEach(button => {
    button.addEventListener('click', () => {
      chatInput.value = button.dataset.prompt;
      chatInput.focus();
    });
  });
})();