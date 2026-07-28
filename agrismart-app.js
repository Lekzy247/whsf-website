(() => {
  const views = [...document.querySelectorAll('.view')];
  const navButtons = [...document.querySelectorAll('[data-view]')];
  const title = document.querySelector('[data-page-title]');
  const subtitle = document.querySelector('[data-page-subtitle]');
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

  function showView(name, updateHash = true) {
    if (!pageMeta[name]) name = 'home';
    views.forEach(view => view.classList.toggle('active', view.dataset.viewPanel === name));
    navButtons.forEach(button => button.classList.toggle('active', button.dataset.view === name));
    title.textContent = pageMeta[name][0];
    subtitle.textContent = pageMeta[name][1];
    if (updateHash && location.hash !== `#${name}`) history.replaceState(null, '', `#${name}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  navButtons.forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
  window.addEventListener('hashchange', () => showView(location.hash.slice(1), false));
  showView(location.hash.slice(1) || 'home', false);

  const manifest = document.createElement('link');
  manifest.rel = 'manifest';
  manifest.href = 'agrismart-manifest.webmanifest';
  document.head.appendChild(manifest);

  const appleIcon = document.createElement('link');
  appleIcon.rel = 'apple-touch-icon';
  appleIcon.href = 'assets/whsf-logo.jpg';
  document.head.appendChild(appleIcon);

  const connectionBadge = document.createElement('span');
  connectionBadge.className = 'chip';
  connectionBadge.setAttribute('role', 'status');
  connectionBadge.setAttribute('aria-live', 'polite');
  document.querySelector('.top-actions')?.prepend(connectionBadge);
  const updateConnectionBadge = () => {
    connectionBadge.textContent = navigator.onLine ? 'Online' : 'Offline mode';
    connectionBadge.title = navigator.onLine ? 'Connected to the internet' : 'Cached app features remain available';
  };
  updateConnectionBadge();
  window.addEventListener('online', updateConnectionBadge);
  window.addEventListener('offline', updateConnectionBadge);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('agrismart-sw.js').catch(() => {}));
  }

  let installPrompt;
  const installButton = document.createElement('button');
  installButton.className = 'secondary-btn';
  installButton.type = 'button';
  installButton.textContent = 'Install App';
  installButton.hidden = true;
  document.querySelector('.top-actions')?.appendChild(installButton);
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    installButton.hidden = false;
  });
  installButton.addEventListener('click', async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    installButton.hidden = true;
  });
  window.addEventListener('appinstalled', () => { installButton.hidden = true; });

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
      const farms = getFarms().filter(saved => saved.id !== farm.id);
      localStorage.setItem(FARM_STORAGE_KEY, JSON.stringify(farms));
      item.remove();
    });
    farmList?.appendChild(item);
  };
  getFarms().forEach(renderFarm);

  farmForm?.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(farmForm);
    const farm = {
      id: Date.now(),
      name: data.get('farmName').trim(),
      crop: data.get('crop'),
      size: data.get('size'),
      location: data.get('location').trim(),
      notes: data.get('notes')?.trim() || ''
    };
    if (!farm.name || !farm.crop || !farm.size || !farm.location) return;
    const farms = getFarms();
    farms.push(farm);
    localStorage.setItem(FARM_STORAGE_KEY, JSON.stringify(farms));
    renderFarm(farm);
    farmForm.reset();
  });

  document.querySelectorAll('[data-market-action]').forEach(button => {
    button.addEventListener('click', () => {
      const original = button.textContent;
      button.textContent = 'Request saved';
      button.disabled = true;
      setTimeout(() => { button.textContent = original; button.disabled = false; }, 1600);
    });
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