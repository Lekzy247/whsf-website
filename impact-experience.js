(() => {
  const data = window.WHSF_IMPACT_DATA;
  if (!data) return;
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const formatDate = value => new Intl.DateTimeFormat('en', { year:'numeric', month:'long', day:'numeric' }).format(new Date(value + 'T12:00:00'));

  document.querySelectorAll('[data-publication-date]').forEach(node => { node.textContent = formatDate(data.meta.publicationDate); });
  document.querySelectorAll('[data-data-scope]').forEach(node => { node.textContent = data.meta.scope; });

  const metricGrid = document.querySelector('[data-impact-metrics]');
  const programmeFilter = document.querySelector('#impact-programme-filter');
  const regionFilter = document.querySelector('#impact-region-filter');
  const periodFilter = document.querySelector('#impact-period-filter');

  function renderMetrics() {
    if (!metricGrid) return;
    const programme = programmeFilter?.value || 'all';
    const region = regionFilter?.value || 'all';
    const period = periodFilter?.value || 'all';
    const filtered = data.metrics.filter(item =>
      (programme === 'all' || item.programme === programme) &&
      (region === 'all' || item.region === region) &&
      (period === 'all' || item.year === period)
    );
    metricGrid.innerHTML = filtered.length ? filtered.map(item => `
      <article class="metric-card">
        <span>Published indicator</span>
        <strong>${escapeHtml(item.display)}</strong>
        <h3>${escapeHtml(item.label)}</h3>
        <p>${escapeHtml(item.note)}</p>
      </article>`).join('') : '<p class="dashboard-empty">No published indicator matches these filters. Try a broader selection.</p>';
    document.querySelector('[data-result-count]')?.replaceChildren(document.createTextNode(`${filtered.length} published indicator${filtered.length === 1 ? '' : 's'}`));
  }
  [programmeFilter, regionFilter, periodFilter].filter(Boolean).forEach(control => control.addEventListener('change', renderMetrics));
  renderMetrics();

  const map = document.querySelector('[data-impact-map]');
  const mapDetail = document.querySelector('[data-map-detail]');
  if (map && mapDetail) {
    const markerLayer = map.querySelector('[data-marker-layer]');
    const projectFilter = document.querySelector('#map-programme-filter');
    const coords = location => ({ x: ((location.lng + 180) / 360) * 1000, y: ((90 - location.lat) / 180) * 500 });
    const showLocation = id => {
      const location = data.locations.find(item => item.id === id);
      if (!location) return;
      map.querySelectorAll('.map-marker').forEach(node => node.classList.toggle('active', node.dataset.location === id));
      mapDetail.innerHTML = `<span>Project location</span><h3>${escapeHtml(location.name)}</h3><p>${escapeHtml(location.summary)}</p><strong>Published beneficiary information</strong><p>${escapeHtml(location.beneficiaries)}</p><strong>Programmes represented</strong><ul>${location.programmes.map(key => `<li>${escapeHtml(data.programmes[key]?.shortTitle || key)}</li>`).join('')}</ul>`;
    };
    const renderMarkers = () => {
      const selected = projectFilter?.value || 'all';
      const locations = data.locations.filter(location => selected === 'all' || location.programmes.includes(selected));
      markerLayer.innerHTML = locations.map(location => {
        const point = coords(location);
        return `<g class="map-marker" data-location="${escapeHtml(location.id)}" tabindex="0" role="button" aria-label="Show ${escapeHtml(location.name)} project information" transform="translate(${point.x} ${point.y})"><circle r="9"></circle><text x="16" y="5">${escapeHtml(location.name)}</text></g>`;
      }).join('');
      markerLayer.querySelectorAll('.map-marker').forEach(marker => {
        marker.addEventListener('click', () => showLocation(marker.dataset.location));
        marker.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); showLocation(marker.dataset.location); }
        });
      });
      if (locations[0]) showLocation(locations[0].id);
      else mapDetail.innerHTML = '<span>Project locations</span><h3>No published location</h3><p>No mapped record matches this filter.</p>';
    };
    projectFilter?.addEventListener('change', renderMarkers);
    renderMarkers();
  }

  const programmeGrid = document.querySelector('[data-programme-outcomes]');
  if (programmeGrid) {
    programmeGrid.innerHTML = Object.entries(data.programmes).map(([key, item]) => `
      <article class="programme-outcome-card">
        <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.imageAlt)}" loading="lazy">
        <div><span>${escapeHtml(item.eyebrow)}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary)}</p>
        <ul>${item.outcomes.slice(0,2).map(outcome => `<li>${escapeHtml(outcome)}</li>`).join('')}</ul>
        <a class="button" href="${escapeHtml(item.url)}">View measurable outcomes</a></div>
      </article>`).join('');
  }

  const programmeKey = document.body.dataset.programme;
  if (programmeKey && data.programmes[programmeKey]) {
    const programme = data.programmes[programmeKey];
    document.querySelectorAll('[data-programme-title]').forEach(node => { node.textContent = programme.title; });
    document.querySelectorAll('[data-programme-eyebrow]').forEach(node => { node.textContent = programme.eyebrow; });
    document.querySelectorAll('[data-programme-summary]').forEach(node => { node.textContent = programme.summary; });
    const image = document.querySelector('[data-programme-image]');
    if (image) { image.src = programme.image; image.alt = programme.imageAlt; }
    const stats = document.querySelector('[data-programme-stats]');
    const metrics = programme.metricIds.map(id => data.metrics.find(metric => metric.id === id)).filter(Boolean);
    if (stats) stats.innerHTML = metrics.length ? metrics.map(metric => `<article class="programme-stat"><strong>${escapeHtml(metric.display)}</strong><span>${escapeHtml(metric.label)}</span></article>`).join('') : '<p class="pending-measure">A verified programme-specific beneficiary total has not yet been published. WHSF can add it here after internal validation.</p>';
    const outcomes = document.querySelector('[data-programme-outcome-list]');
    if (outcomes) outcomes.innerHTML = programme.outcomes.map(item => `<li>${escapeHtml(item)}</li>`).join('');
    const indicators = document.querySelector('[data-programme-indicator-list]');
    if (indicators) indicators.innerHTML = programme.indicators.map(item => `<li>${escapeHtml(item)}</li>`).join('');
    const regions = document.querySelector('[data-programme-regions]');
    if (regions) regions.textContent = programme.regions.join(' • ');
  }
})();