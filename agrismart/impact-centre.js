(() => {
  'use strict';

  const toggle = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('#impact-nav');
  if (toggle && navigation) {
    toggle.setAttribute('aria-label', 'Open Impact Centre navigation');
    toggle.addEventListener('click', () => {
      const open = navigation.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close Impact Centre navigation' : 'Open Impact Centre navigation');
    });
    navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
      navigation.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open Impact Centre navigation');
    }));
  }

  const weeklyCompletion = [
    ['W1', 62], ['W2', 68], ['W3', 73], ['W4', 78],
    ['W5', 82], ['W6', 86], ['W7', 89]
  ];
  const chart = document.querySelector('#weekly-chart');
  if (chart) {
    chart.innerHTML = weeklyCompletion.map(([week, value]) => `
      <div class="chart-column">
        <i style="height:${value}%" title="${value}% completion"></i>
        <b>${value}%</b>
        <span>${week}</span>
      </div>`).join('');
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const counters = document.querySelectorAll('[data-count]');
  function animateCounter(element) {
    const target = Number(element.dataset.count || 0);
    const suffix = element.dataset.suffix || '';
    if (reduceMotion) {
      element.textContent = target.toLocaleString() + suffix;
      return;
    }
    const start = performance.now();
    const duration = 900;
    const tick = now => {
      const progress = Math.min((now - start) / duration, 1);
      const value = Math.round(target * (1 - Math.pow(1 - progress, 3)));
      element.textContent = value.toLocaleString() + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  if ('IntersectionObserver' in window && !reduceMotion) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      });
    }, { threshold: .5 });
    counters.forEach(counter => observer.observe(counter));
  } else {
    counters.forEach(animateCounter);
  }

  const year = document.querySelector('#year');
  if (year) year.textContent = new Date().getFullYear();
})();
