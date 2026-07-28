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

  function showView(name) {
    views.forEach(v => v.classList.toggle('active', v.dataset.viewPanel === name));
    navButtons.forEach(b => b.classList.toggle('active', b.dataset.view === name));
    if (pageMeta[name]) {
      title.textContent = pageMeta[name][0];
      subtitle.textContent = pageMeta[name][1];
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  navButtons.forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));

  const fileInput = document.querySelector('#crop-photo');
  const preview = document.querySelector('.scan-preview');
  const scanPlaceholder = document.querySelector('[data-scan-placeholder]');
  const analyzeButton = document.querySelector('[data-analyze]');
  const diagnosis = document.querySelector('[data-diagnosis]');
  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      preview.src = URL.createObjectURL(file);
      preview.style.display = 'block';
      scanPlaceholder.hidden = true;
      analyzeButton.disabled = false;
      diagnosis.innerHTML = '<div class="notice">Image ready. Select “Analyze crop” to run the guided diagnostic demonstration.</div>';
    });
  }
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

  const farmForm = document.querySelector('#farm-form');
  const farmList = document.querySelector('[data-farm-list]');
  farmForm?.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(farmForm);
    const name = data.get('farmName');
    const crop = data.get('crop');
    const size = data.get('size');
    const item = document.createElement('div');
    item.className = 'order-item';
    item.innerHTML = `<div><strong>${name}</strong><div>${crop} · ${size} hectares</div></div><span class="chip">Active</span>`;
    farmList.appendChild(item);
    farmForm.reset();
  });

  document.querySelectorAll('[data-market-action]').forEach(button => {
    button.addEventListener('click', () => {
      const card = button.closest('.market-card');
      const product = card?.querySelector('h4')?.textContent || 'Item';
      button.textContent = 'Added';
      button.disabled = true;
      setTimeout(() => { button.textContent = `View ${product}`; button.disabled = false; }, 1400);
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
    chatLog.insertAdjacentHTML('beforeend', `<article><strong>You</strong><p>${question.replace(/[<>]/g, '')}</p></article>`);
    chatInput.value = '';
    const response = answers[Math.floor(Math.random() * answers.length)];
    setTimeout(() => {
      chatLog.insertAdjacentHTML('beforeend', `<article><strong>AgriSmart Assistant</strong><p>${response}</p></article>`);
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