(() => {
  'use strict';

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const state = { filter: 'all', query: '' };
  const cards = $$('.project-card');
  const grid = $('#projectGrid');
  const search = $('#projectSearch');
  const filterButtons = $$('.filter-btn');

  function normalize(value = '') {
    return value.toLowerCase().trim();
  }

  function markText(element, query) {
    if (!element.dataset.originalText) element.dataset.originalText = element.textContent;
    const original = element.dataset.originalText;
    if (!query) {
      element.textContent = original;
      return;
    }
    const index = normalize(original).indexOf(query);
    if (index < 0) {
      element.textContent = original;
      return;
    }
    element.replaceChildren(
      document.createTextNode(original.slice(0, index)),
      Object.assign(document.createElement('mark'), { textContent: original.slice(index, index + query.length) }),
      document.createTextNode(original.slice(index + query.length))
    );
  }

  function filterProjects() {
    let visible = 0;
    cards.forEach(card => {
      const categories = normalize(card.dataset.category).split(/\s+/);
      const searchable = normalize(`${card.dataset.title} ${card.dataset.summary} ${card.textContent}`);
      const matchesFilter = state.filter === 'all' || categories.includes(state.filter);
      const matchesSearch = !state.query || searchable.includes(state.query);
      const show = matchesFilter && matchesSearch;
      card.hidden = !show;
      card.setAttribute('aria-hidden', String(!show));
      if (show) visible += 1;
      markText($('h3', card), state.query);
      markText($('p', card), state.query);
    });

    let empty = $('.empty-state', grid);
    if (!visible) {
      if (!empty) {
        empty = document.createElement('p');
        empty.className = 'empty-state';
        empty.setAttribute('role', 'status');
        grid.append(empty);
      }
      empty.textContent = `No projects match “${search.value.trim()}”. Try another search or category.`;
    } else {
      empty?.remove();
    }
  }

  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      state.filter = button.dataset.filter;
      filterButtons.forEach(item => {
        const active = item === button;
        item.classList.toggle('active', active);
        item.setAttribute('aria-pressed', String(active));
      });
      filterProjects();
    });
  });

  search?.addEventListener('input', event => {
    state.query = normalize(event.target.value);
    filterProjects();
  });

  const modal = $('#projectModal');
  const closeModal = $('#modalClose');

  function openProject(card) {
    const title = card.dataset.title;
    $('#modalTitle').textContent = title;
    $('#modalCategory').textContent = card.dataset.category.split(' ').map(word => word[0].toUpperCase() + word.slice(1)).join(' · ');
    $('#modalSummary').textContent = card.dataset.summary;
    $('#modalMetrics').textContent = card.dataset.metrics;
    $('#modalContact').href = `/contact.html?subject=${encodeURIComponent(`AgriSmart ${title} partnership`)}`;
    if (typeof modal.showModal === 'function') modal.showModal();
    else modal.setAttribute('open', '');
  }

  $$('.project-detail').forEach(button => {
    button.addEventListener('click', () => openProject(button.closest('.project-card')));
  });

  closeModal?.addEventListener('click', () => modal.close());
  modal?.addEventListener('click', event => {
    const bounds = modal.getBoundingClientRect();
    const outside = event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
    if (outside) modal.close();
  });

  function setupSimulator() {
    const distanceInput = $('#distanceInput');
    const tripsInput = $('#tripsInput');
    const speedInput = $('#speedInput');
    if (!distanceInput || !tripsInput || !speedInput) return;

    const calculate = () => {
      const distance = Number(distanceInput.value);
      const trips = Number(tripsInput.value);
      const speed = Number(speedInput.value);
      const dailyKm = (distance * trips) / 1000;
      const minutes = Math.round((dailyKm / speed) * 60);
      const weeklyKm = dailyKm * 6;

      $('#distanceValue').textContent = distance.toLocaleString();
      $('#tripsValue').textContent = trips;
      $('#speedValue').textContent = speed.toFixed(speed % 1 ? 1 : 0);
      $('#dailyDistance').textContent = `${dailyKm.toFixed(1)} km`;
      $('#travelTime').textContent = `${minutes} min`;
      $('#manualReduction').textContent = `${dailyKm.toFixed(1)} km`;
      $('#weeklyDistance').textContent = `${weeklyKm.toFixed(1)} km`;
    };

    [distanceInput, tripsInput, speedInput].forEach(input => input.addEventListener('input', calculate));
    calculate();
  }

  function setupReveal() {
    const targets = $$('.section-head, .project-card, .problem-grid article, .steps article, .pilot-panel, .partner-panel');
    targets.forEach(target => target.classList.add('reveal'));
    if (reduceMotion || !('IntersectionObserver' in window)) {
      targets.forEach(target => target.classList.add('visible'));
      return;
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    targets.forEach(target => observer.observe(target));
  }

  function animateCounters() {
    const counters = $$('[data-counter]');
    const run = element => {
      const target = Number(element.dataset.counter);
      const suffix = element.dataset.suffix || '';
      if (reduceMotion) {
        element.textContent = `${target.toLocaleString()}${suffix}`;
        return;
      }
      const start = performance.now();
      const duration = 1200;
      const tick = now => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        element.textContent = `${Math.round(target * eased).toLocaleString()}${suffix}`;
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    counters.forEach(run);
  }

  function improveAccessibility() {
    filterButtons.forEach((button, index) => button.setAttribute('aria-pressed', String(index === 0)));
    cards.forEach(card => {
      const button = $('.project-detail', card);
      if (button) button.setAttribute('aria-label', `View details for ${card.dataset.title}`);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && modal?.open) modal.close();
    });
  }

  $('#year').textContent = new Date().getFullYear();
  setupSimulator();
  setupReveal();
  animateCounters();
  improveAccessibility();
  filterProjects();
})();