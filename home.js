// WHSF homepage hero slider (Gelllez layout): tabs with progress bars, previous / pause / next.
// Auto-advances every 7 s; pauses on hover or focus; no auto-advance for reduced-motion users.
(() => {
  const slider = document.querySelector('[data-hp-slider]');
  if (!slider) return;
  const slides = [...slider.querySelectorAll('.hp-slide')];
  const tabs = [...slider.querySelectorAll('[data-hp-tab]')];
  const pauseButton = slider.querySelector('[data-hp-pause]');
  const pauseIcon = slider.querySelector('[data-hp-pause-icon]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const INTERVAL = 7000;

  let current = 0;
  let timer = null;
  let paused = reducedMotion;
  let hovering = false;

  function show(index, { focusTab = false } = {}) {
    current = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      const active = i === current;
      slide.classList.toggle('is-active', active);
      slide.setAttribute('aria-hidden', String(!active));
      slide.querySelectorAll('a, button').forEach((el) => { el.tabIndex = active ? 0 : -1; });
    });
    tabs.forEach((tab, i) => {
      const active = i === current;
      tab.classList.toggle('is-active', active);
      tab.classList.remove('is-running');
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    if (focusTab) tabs[current].focus();
    syncVideos();
    restart();
  }

  // Slide videos play only while their slide is showing and the slider isn't paused.
  // Skipped entirely for reduced-motion and data-saver visitors, who keep the still photo.
  const saveData = navigator.connection && navigator.connection.saveData;
  const videos = reducedMotion || saveData ? [] : [...slider.querySelectorAll('[data-hp-video]')];
  videos.forEach((video) => {
    video.addEventListener('playing', () => video.classList.add('is-playing'), { once: true });
  });
  function syncVideos() {
    videos.forEach((video) => {
      if (video.closest('.hp-slide') === slides[current] && !paused && !document.hidden) {
        if (video.preload === 'none') video.preload = 'auto';
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }

  function restart() {
    clearTimeout(timer);
    const tab = tabs[current];
    if (paused || hovering) return;
    // Re-trigger the progress bar animation.
    void tab.offsetWidth;
    tab.classList.add('is-running');
    timer = setTimeout(() => show(current + 1), INTERVAL);
  }

  function setPaused(value) {
    paused = value;
    pauseButton.setAttribute('aria-label', paused ? 'Play highlights' : 'Pause highlights');
    pauseIcon.innerHTML = paused ? '<path d="M8 5l11 7-11 7z"/>' : '<path d="M9 5v14M15 5v14"/>';
    if (paused) {
      clearTimeout(timer);
      tabs[current].classList.remove('is-running');
    } else {
      restart();
    }
    syncVideos();
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => show(i));
    tab.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowRight') { event.preventDefault(); show(current + 1, { focusTab: true }); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); show(current - 1, { focusTab: true }); }
    });
  });
  slider.querySelector('[data-hp-prev]').addEventListener('click', () => show(current - 1));
  slider.querySelector('[data-hp-next]').addEventListener('click', () => show(current + 1));
  pauseButton.addEventListener('click', () => setPaused(!paused));

  slider.addEventListener('mouseenter', () => { hovering = true; clearTimeout(timer); tabs[current].classList.remove('is-running'); });
  slider.addEventListener('mouseleave', () => { hovering = false; restart(); });
  slider.addEventListener('focusin', () => { hovering = true; clearTimeout(timer); tabs[current].classList.remove('is-running'); });
  slider.addEventListener('focusout', (event) => {
    if (!slider.contains(event.relatedTarget)) { hovering = false; restart(); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTimeout(timer); else restart();
    syncVideos();
  });

  // Later slides' photos are lazy; warm them after load so a slide never appears as an empty box.
  window.addEventListener('load', () => {
    slider.querySelectorAll('.hp-slide-visual img[loading="lazy"]').forEach((img) => { img.loading = 'eager'; });
  }, { once: true });

  setPaused(paused);
  show(0);
})();
