(() => {
  const data = window.WHSF_CONTENT_DATA;
  if (!data) return;
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const newsroomGrid = document.querySelector('[data-newsroom-grid]');
  const newsFilter = document.querySelector('#newsroom-filter');
  const newsSearch = document.querySelector('#newsroom-search');
  const renderNews = () => {
    if (!newsroomGrid) return;
    const type = newsFilter?.value || 'all';
    const query = (newsSearch?.value || '').trim().toLowerCase();
    const items = data.newsroom.filter(item => (type === 'all' || item.type === type) && (!query || (item.title + ' ' + item.summary).toLowerCase().includes(query)));
    newsroomGrid.innerHTML = items.length ? items.map(item => `<article class="content-card"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.alt)}" loading="lazy"><div><span>${escapeHtml(item.type)} · ${escapeHtml(item.date || 'Programme story')}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary)}</p><a class="arrow-link" href="${escapeHtml(item.url)}">Read more <span>→</span></a></div></article>`).join('') : '<p class="dashboard-empty">No newsroom item matches this search.</p>';
    document.querySelector('[data-news-count]')?.replaceChildren(document.createTextNode(`${items.length} item${items.length === 1 ? '' : 's'}`));
  };
  [newsFilter, newsSearch].filter(Boolean).forEach(node => node.addEventListener(node.tagName === 'INPUT' ? 'input' : 'change', renderNews));
  renderNews();

  const libraryGrid = document.querySelector('[data-library-grid]');
  const libraryFilter = document.querySelector('#library-filter');
  const librarySearch = document.querySelector('#library-search');
  const renderLibrary = () => {
    if (!libraryGrid) return;
    const category = libraryFilter?.value || 'all';
    const query = (librarySearch?.value || '').trim().toLowerCase();
    const items = data.resources.filter(item => (category === 'all' || item.category === category) && (!query || (item.title + ' ' + item.description + ' ' + item.format).toLowerCase().includes(query)));
    libraryGrid.innerHTML = items.length ? items.map(item => {
      const external = /^https?:/.test(item.url);
      return `<article class="resource-card"><span>${escapeHtml(item.category)}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p><strong>${escapeHtml(item.format)}</strong><a class="arrow-link" href="${escapeHtml(item.url)}"${external ? ' target="_blank" rel="noreferrer"' : ''}>Open resource <span>→</span></a></article>`;
    }).join('') : '<p class="dashboard-empty">No resource matches this search.</p>';
    document.querySelector('[data-resource-count]')?.replaceChildren(document.createTextNode(`${items.length} resource${items.length === 1 ? '' : 's'}`));
  };
  [libraryFilter, librarySearch].filter(Boolean).forEach(node => node.addEventListener(node.tagName === 'INPUT' ? 'input' : 'change', renderLibrary));
  renderLibrary();

  const amountButtons = document.querySelectorAll('[data-donation-amount]');
  const donationSummary = document.querySelector('[data-donation-summary]');
  amountButtons.forEach(button => button.addEventListener('click', () => {
    amountButtons.forEach(item => item.classList.toggle('active', item === button));
    if (donationSummary) donationSummary.textContent = `${button.dataset.donationAmount} selected. You will complete the donation securely on PayPal.`;
  }));
})();