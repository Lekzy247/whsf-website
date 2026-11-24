// WHSF Verify: turns the forum's ID check form into one-thing-per-screen steps (method, ID details with legal name,
// photos of the ID front and back, a recorded video selfie, then for video calls an "are you ready?" screen).
// The form fields, names and the submit handler stay as forum.js expects; this file shows and hides panels and checks
// each step before moving on. The database enforces the same rules and rejects anything that does not meet them.
(() => {
  const form = document.querySelector('[data-vk-wizard]');
  if (!form) return;

  const panels = [...form.querySelectorAll('[data-vk-panel]')];
  const progress = form.querySelector('[data-vk-progress]');
  const ID_TYPES_OK = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const VIDEO_TYPES_OK = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
  const MAX_ID_BYTES = 8 * 1024 * 1024;
  const MAX_VIDEO_BYTES = 30 * 1024 * 1024;
  let current = 'method';

  const isCall = () => form.method.value === 'video_call';
  const sequence = () => ['method', 'details', 'photo', 'selfie', ...(isCall() ? ['ready'] : [])];
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
    form.querySelectorAll('[data-vk-self-only]').forEach((n) => { n.hidden = isCall(); });
    form.querySelectorAll('[data-vk-call-only]').forEach((n) => { n.hidden = !isCall(); });
    const index = Math.max(0, seq.indexOf(name));
    if (progress) progress.textContent = name === 'method' ? '' : `Step ${index + 1} of ${seq.length}`;
    const card = form.closest('[data-fm-verify]');
    if (card && name !== 'method') card.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function checkImage(file, label) {
    if (!file) return `Add a photo of the ${label} of your ID.`;
    if (!ID_TYPES_OK.has(file.type)) return 'ID photos must be JPG, PNG or WebP photos of your physical ID.';
    if (file.size > MAX_ID_BYTES) return 'Each ID photo must be 8 MB or smaller.';
    if (file.size < 30000) return `The ${label} photo is too small to read. Photograph the whole ID close up.`;
    return '';
  }

  function validate(name) {
    if (name === 'details') {
      const legal = (form.legal_name?.value || '').trim().replace(/\s+/g, ' ');
      if (!/^\S{2,}( \S+)+$/.test(legal) || /[0-9@/\\<>_=+]/.test(legal)) return setError('details', 'Enter your full legal name exactly as printed on your ID (first name and surname).');
      if (form.country.value.trim().length < 2) return setError('details', 'Enter the country that issued your ID.');
      if (!form.id_type.value) return setError('details', 'Choose the type of ID.');
      return setError('details', '');
    }
    if (name === 'photo') {
      const front = form.id_front.files[0]; const back = form.id_back.files[0];
      const problem = checkImage(front, 'front')
        || (back ? checkImage(back, 'back') : (form.id_type.value === 'passport' ? '' : 'Add a photo of the back of your ID. Only passports can skip this.'))
        || (front && back && front.size === back.size && front.lastModified === back.lastModified ? 'Use a separate photo for the back of your ID.' : '');
      return setError('photo', problem);
    }
    if (name === 'selfie') {
      const video = form.selfie.files[0];
      if (!video) return setError('selfie', 'Record your video selfie first: say your full name and code, show the ID front and back, turn your head.');
      if (!VIDEO_TYPES_OK.has(video.type)) return setError('selfie', 'A recorded video is required (MP4, WebM or MOV). Photos are not accepted.');
      if (video.size > MAX_VIDEO_BYTES) return setError('selfie', 'The video must be 30 MB or smaller. Keep it to about 15 seconds.');
      if (video.size < 150000) return setError('selfie', 'The video is too short. Record 10–15 seconds.');
      if (!form.consent.checked) return setError('selfie', 'Please agree to WHSF viewing your ID photos and video for age and identity verification.');
      return setError('selfie', '');
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
      }
      if (input.name === 'id_front' || input.name === 'id_back') setError('photo', '');
      if (input.name === 'selfie') setError('selfie', '');
    }
    if (input.name === 'method') { setError('details', ''); show(current); }
  });

  // Submitting: the video step (self-service) or the call screen must pass its checks first.
  form.addEventListener('click', (event) => {
    const submit = event.target.closest('button[type="submit"]');
    if (!submit) return;
    if (current === 'selfie' && !validate('selfie')) { event.preventDefault(); return; }
    if (current === 'ready') {
      const ready = form.querySelector('[data-vk-ready]');
      if (ready && !ready.checked) { event.preventDefault(); setError('ready', 'Please confirm you have your physical ID ready.'); return; }
      setError('ready', '');
    }
  }, true);

  // After a submit forum.js resets the form: start from the first screen again.
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
