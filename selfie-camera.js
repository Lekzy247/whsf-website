// WHSF Forum ID check: record the video selfie with the device camera right on the page (computer or phone),
// or with the phone's own camera app. Video only: photos are not accepted. The result goes into the form's normal "selfie" file input, so the
// existing checks, upload and review work unchanged. Nothing is sent anywhere until the member submits.
(() => {
  const pick = document.querySelector('[data-fm-self-only]');
  const input = document.querySelector('[data-fm-verify-form] input[name="selfie"]');
  if (!pick || !input) return;
  const canCamera = Boolean(navigator.mediaDevices?.getUserMedia);
  const recordType = () => {
    if (!window.MediaRecorder) return null;
    for (const t of ['video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm']) if (MediaRecorder.isTypeSupported(t)) return t;
    return null;
  };
  const make = (tag, props = {}, kids = []) => {
    const n = document.createElement(tag);
    Object.entries(props).forEach(([k, v]) => { if (k === 'text') n.textContent = v; else if (k === 'class') n.className = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v); });
    kids.forEach((c) => c && n.append(c));
    return n;
  };

  // The plain input becomes the "upload" route (no forced camera, so phones offer camera or gallery).
  input.removeAttribute('capture');
  input.setAttribute('accept', 'video/mp4,video/webm,video/quicktime');
  const oldLabel = input.closest('label');
  if (oldLabel) {
    oldLabel.className = 'vk-secondary vk-file';
    oldLabel.firstChild.nodeValue = 'Record with my phone camera instead';
  }

  const status = make('p', { class: 'vk-cam-status', role: 'status' });
  const video = make('video', { class: 'vk-cam-video', autoplay: '', playsinline: '', muted: '' });
  video.muted = true;
  const code = () => { const c = document.querySelector('[data-fm-verify-code]')?.textContent?.trim() || ''; return /^[A-Z0-9-]{3,}$/i.test(c) ? c : ''; };
  const hint = make('p', { class: 'vk-cam-hint' });
    const btnRecord = make('button', { type: 'button', class: 'vk-secondary', text: '🎥 Start 15-second recording' });
  const btnClose = make('button', { type: 'button', class: 'vk-link', text: 'Close camera' });
  const camBox = make('div', { class: 'vk-cam', hidden: '' }, [video, hint, make('div', { class: 'vk-cam-actions' }, [recordType() ? btnRecord : null, btnClose]), status]);
  const btnOpen = make('button', { type: 'button', class: 'vk-primary', text: '🎥 Record my video selfie' });
  if (canCamera) pick.prepend(btnOpen, camBox);

  let stream = null;
  let recorder = null;
  const stop = () => {
    if (recorder && recorder.state === 'recording') recorder.stop();
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    video.srcObject = null;
    camBox.hidden = true;
    btnOpen.hidden = false;
  };
  const useFile = (file) => {
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    stop();
    status.textContent = '';
  };

  btnOpen.addEventListener('click', async () => {
    status.textContent = 'Opening your camera…';
    camBox.hidden = false;
    btnOpen.hidden = true;
    hint.textContent = `When recording: hold your ID next to your face, say your full name${code() ? ` and your code ${code()}` : ' and your code'}, show the front then the back of the ID, then turn your head left and right.`;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: Boolean(recordType()) });
    } catch (error) {
      try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true }); }
      catch {
        stop();
        status.textContent = '';
        const msg = pick.parentElement.querySelector('[data-vk-error="selfie"]');
        if (msg) msg.textContent = error?.name === 'NotAllowedError'
          ? 'Camera or microphone access was blocked. Allow both for worldhsfoundation.org in your browser settings, or use "Record with my phone camera instead".'
          : 'No camera or microphone was found. Use "Record with my phone camera instead", or continue on your phone.';
        return;
      }
    }
    video.srcObject = stream;
    status.textContent = '';
  });

  btnRecord.addEventListener('click', () => {
    const type = recordType();
    if (!stream || !type || (recorder && recorder.state === 'recording')) return;
    const chunks = [];
    recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 1500000 });
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      const base = type.split(';')[0];
      if (chunks.length) useFile(new File(chunks, base === 'video/mp4' ? 'selfie.mp4' : 'selfie.webm', { type: base }));
    };
    recorder.start();
    let left = 15;
    btnRecord.disabled = true;
    const say = () => (left > 11 ? 'Say your full name and code' : left > 5 ? 'Show the front, then the back of your ID' : 'Turn your head left and right');
    status.textContent = `Recording… ${left}s. ${say()}.`;
    const tick = setInterval(() => {
      left -= 1;
      if (left > 0 && recorder.state === 'recording') { status.textContent = `Recording… ${left}s. ${say()}.`; return; }
      clearInterval(tick);
      btnRecord.disabled = false;
      if (recorder.state === 'recording') recorder.stop();
    }, 1000);
  });

  btnClose.addEventListener('click', stop);
  // Leaving the step or the page always turns the camera off.
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('hashchange', stop);
  pick.closest('form')?.addEventListener('click', (e) => { if (e.target.closest('[data-vk-back]')) stop(); });
})();
