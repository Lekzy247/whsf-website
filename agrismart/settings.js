(() => {
  'use strict';

  const modules = [
    '/agrismart-farm-management.js',
    '/agrismart-marketplace-ui.js',
    '/agrismart-executive-dashboard.js'
  ];

  function loadModule(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.dataset.agrismartModule = 'true';
      script.addEventListener('load', resolve, { once: true });
      script.addEventListener('error', () => reject(new Error(`Unable to load ${src}`)), { once: true });
      document.head.appendChild(script);
    });
  }

  async function activateModules() {
    for (const modulePath of modules) {
      try {
        await loadModule(modulePath);
      } catch (error) {
        console.error('AgriSmart module activation failed.', error);
        window.dispatchEvent(new CustomEvent('agrismart:moduleerror', {
          detail: { modulePath, message: error.message }
        }));
      }
    }

    window.dispatchEvent(new CustomEvent('agrismart:modulesready', {
      detail: { modules: modules.slice() }
    }));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', activateModules, { once: true });
  } else {
    activateModules();
  }
})();