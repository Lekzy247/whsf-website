// WHSF Verify: turns the forum's ID check form into one-thing-per-screen steps (method, ID details, photo of the
// ID, then a video selfie or a "are you ready for your video call?" screen). The form fields, names and the
// submit handler stay exactly as forum.js expects; this file only shows and hides panels and gives feedback.
(() => {
  const form = document.querySelector('[data-vk-wizard]');
  if (!form) return;

  const panels = [...form.querySelectorAll('[data-vk-panel]')];
  const progress = form.querySelector('[data-vk-progress]');
  const ID_TYPES_OK = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const MAX_ID_BYTES = 8 * 1024 * 1024;
  let current = 'method';

  const isCall = () => form.method.value === 'video_call';
  const sequence = () => ['method', 'details', 'photo', isCall() ? 'ready' : 'selfie'];
  const panel = (name) => panels.find((p) => p.dataset.vkPanel === name);
  const setError = (name, text) => {
    const box = form.querySelector(`[data-vk-error="${name}"]`);
    if (box) box.textContent = text || '';
    return !text;
  };
  const size = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

  function show(name) {
    current = name;
    const seq = sequence();
    panels.forEach((p) => { p.hidden = p.dataset.vkPanel !== name; });
    const index = Math.max(0, seq.indexOf(name));
    if (progress) progress.textContent = name === 'method' ? '' : `Step ${index + 1} of ${seq.length}`;
    const card = form.closest('[data-fm-verify]');
    if (card && name !== 'method') card.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function validate(name) {
    if (name === 'details') {
      if (form.country.value.trim().length < 2) return setError('details', 'Enter the country that issued your ID.');
      if (!form.id_type.value) return setError('details', 'Choose the type of ID.');
      return setError('details', '');
    }
    if (name === 'photo') {
      const file = form.id_front.files[0];
      if (!file) return setError('photo', 'Add a photo of the front of your ID first.');
      if (!ID_TYPES_OK.has(file.type)) return setError('photo', 'ID photos must be JPG, PNG or WebP.');
      if (file.size > MAX_ID_BYTES) return setError('photo', 'Each ID photo must be 8 MB or smaller.');
      return setError('photo', '');
    }
    return true;
  }

  form.addEventListener('click', (event) => {
    const next = event.target.closest('[data-vk-next]');
    const back = event.target.closest('[data-vk-back]');
    if (next) {
      event.preventDefault();
      if (!validate(current)) return;
      const seq = sequence();
      show(seq[Math.min(seq.indexOf(current) + 1, seq.length - 1)]);
    } else if (back) {
      event.preventDefault();
      const seq = sequence();
      show(seq[Math.max(seq.indexOf(current) - 1, 0)]);
    }
  });

  // File choices: say what was picked, preview the front of the ID.
  form.addEventListener('change', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.type === 'file') {
      const out = form.querySelector(`[data-vk-picked="${input.name}"]`);
      const file = input.files[0];
      if (out) out.textContent = file ? `✓ ${file.name} (${size(file.size)})` : '';
      if (input.name === 'id_front') {
        const img = form.querySelector('[data-vk-preview="id_front"]');
        if (img) {
          if (img.dataset.url) URL.revokeObjectURL(img.dataset.url);
          if (file && ID_TYPES_OK.has(file.type)) { img.dataset.url = URL.createObjectURL(file); img.src = img.dataset.url; img.hidden = false; } else { img.hidden = true; }
        }
        setError('photo', '');
      }
    }
    // the call screen has its own consent box; forum.js reads `consent`, so keep the two in step
    if (input.name === 'consent_call' && form.consent) form.consent.checked = input.checked;
    if (input.name === 'method') { setError('details', ''); }
  });

  // Submitting from the call screen needs the "physical ID ready" box too.
  form.addEventListener('click', (event) => {
    const submit = event.target.closest('button[type="submit"]');
    if (!submit || current !== 'ready') return;
    const ready = form.querySelector('[data-vk-ready]');
    if (ready && !ready.checked) { event.preventDefault(); setError('ready', 'Please confirm you have your physical ID ready.'); return; }
    if (form.consent_call && !form.consent_call.checked) { event.preventDefault(); setError('ready', 'Please agree to WHSF viewing your ID for age verification.'); return; }
    setError('ready', '');
    if (form.consent && form.consent_call) form.consent.checked = form.consent_call.checked;
  }, true);
  form.addEventListener('click', (event) => {
    const submit = event.target.closest('button[type="submit"]');
    if (!submit || current !== 'selfie') return;
    if (!form.selfie.files[0]) { event.preventDefault(); setError('selfie', 'Add your video selfie (or a photo selfie) first.'); return; }
    if (!form.consent.checked) { event.preventDefault(); setError('selfie', 'Please agree to WHSF viewing your ID and selfie for age verification.'); return; }
    setError('selfie', '');
  }, true);

  // After a successful submit forum.js resets the form: start from the first screen again.
  form.addEventListener('reset', () => {
    window.setTimeout(() => {
      form.querySelectorAll('[data-vk-picked]').forEach((p) => { p.textContent = ''; });
      const img = form.querySelector('[data-vk-preview="id_front"]');
      if (img) { img.hidden = true; img.removeAttribute('src'); }
      show('method');
    }, 0);
  });

  show('method');
})();
