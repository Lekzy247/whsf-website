// WHSF Forum (forum.html): adult-only (18+) member community on WHSF's own Supabase.
// Access rules live in the database (supabase/migrations/20261012_forum.sql); this script only renders.
// All member-written text is inserted with textContent, never as HTML.
(() => {
  const SUPABASE_URL = 'https://ophymlgqnfilgxsuzcuz.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_tA1TRg0XkBKKXZ5UwFbu4Q_qGIST2Xh';
  const IMAGE_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/forum-images/`;
  const PAGE_SIZE = 20;
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

  if (!window.supabase?.createClient) return;
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const el = (tag, props = {}, children = []) => {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([key, value]) => {
      if (key === 'text') node.textContent = value;
      else if (key === 'class') node.className = value;
      else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value);
    });
    children.forEach((child) => child && node.append(child));
    return node;
  };
  const safeImage = (url) => (typeof url === 'string' && url.startsWith(IMAGE_PREFIX) ? url : null);
  const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  const timeAgo = (iso) => {
    const s = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 1000));
    if (s < 60) return 'now';
    const m = Math.round(s / 60); if (m < 60) return `${m}m`;
    const h = Math.round(m / 60); if (h < 24) return `${h}h`;
    const d = Math.round(h / 24); if (d < 30) return `${d}d`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  const fillAvatar = (node, profile) => {
    node.replaceChildren();
    const url = safeImage(profile?.avatar_url);
    if (url) node.append(el('img', { src: url, alt: '' }));
    else node.textContent = initials(profile?.display_name);
  };
  const setStatus = (sel, text) => { const n = $(sel); if (n) n.textContent = text || ''; };

  const state = { session: null, profile: null, me: null, isStaff: false, scope: 'everyone', following: new Set(), followers: new Set(), feedOffset: 0, celebrate: false, file: null };

  // ---------------------------------------------------------------- views
  const views = ['feed', 'people', 'me', 'rules', 'idchecks'];
  function showView() {
    let view = (location.hash || '#feed').slice(1);
    if (!views.includes(view)) view = 'feed';
    if (!state.me && (view === 'people' || view === 'me')) view = 'feed';
    if (!state.isStaff && view === 'idchecks') view = 'feed';
    views.forEach((v) => $$(`[data-fm-view="${v}"]`).forEach((n) => { n.hidden = v !== view; }));
    $$('[data-fm-tab]').forEach((a) => (a.dataset.fmTab === view ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    $('[data-fm-reco]').hidden = view !== 'feed';
    // The post box and feed filter belong to the Home feed only, so a new post is always seen where it lands.
    $('[data-fm-composer]').hidden = !state.me || view !== 'feed';
    $('[data-fm-filter]').hidden = !state.me || view !== 'feed';
    if (view === 'people') loadPeople();
    if (view === 'me') fillMeForm();
    if (view === 'idchecks') loadIdChecks();
  }
  window.addEventListener('hashchange', showView);

  // ---------------------------------------------------------------- auth
  let signUpMode = new URLSearchParams(location.search).get('join') === '1';
  function renderAuthMode() {
    $('[data-fm-auth-title]').textContent = signUpMode ? 'Create your WHSF Forum account' : 'Sign in to join the conversation';
    $('[data-fm-auth-submit]').textContent = signUpMode ? 'Create account' : 'Sign in';
    $('[data-fm-auth-toggle]').textContent = signUpMode ? 'Already a member? Sign in' : 'New here? Create an account';
    $('[data-fm-auth-form] input[name="password"]').autocomplete = signUpMode ? 'new-password' : 'current-password';
  }
  $('[data-fm-auth-toggle]').addEventListener('click', () => { signUpMode = !signUpMode; renderAuthMode(); setStatus('[data-fm-auth-status]', ''); });
  $('[data-fm-auth-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const email = form.email.value.trim();
    const password = form.password.value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
      setStatus('[data-fm-auth-status]', 'Enter a valid email and a password of at least 8 characters.');
      return;
    }
    setStatus('[data-fm-auth-status]', signUpMode ? 'Creating your account…' : 'Signing in…');
    if (signUpMode) {
      const { data, error } = await db.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/forum.html` } });
      if (error) return setStatus('[data-fm-auth-status]', error.message);
      if (!data.session) setStatus('[data-fm-auth-status]', 'Check your email to confirm your account, then come back and sign in.');
    } else {
      const { error } = await db.auth.signInWithPassword({ email, password });
      if (error) setStatus('[data-fm-auth-status]', 'Sign-in failed. Check your email and password.');
    }
  });
  $('[data-fm-forgot]').addEventListener('click', async () => {
    const email = $('[data-fm-auth-form]').email.value.trim();
    if (!email) return setStatus('[data-fm-auth-status]', 'Enter your email above first.');
    await db.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/forum.html` });
    setStatus('[data-fm-auth-status]', 'If that email has an account, a password reset link is on its way.');
  });
  $$('[data-fm-signout]').forEach((b) => b.addEventListener('click', () => db.auth.signOut()));

  // ---------------------------------------------------------------- join (18+)
  $('[data-fm-join-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const f = event.currentTarget;
    if (f.display_name.value.trim().length < 2) return setStatus('[data-fm-join-status]', 'Enter the name to show to members.');
    if (!f.birth_date.value) return setStatus('[data-fm-join-status]', 'Enter your date of birth.');
    if (!f.accept_rules.checked) return setStatus('[data-fm-join-status]', 'Please confirm you are 18+ and accept the community rules.');
    setStatus('[data-fm-join-status]', 'Creating your profile…');
    const { error } = await db.rpc('forum_join', {
      p_display_name: f.display_name.value, p_headline: f.headline.value, p_location: f.location.value,
      p_birth_date: f.birth_date.value, p_accept_rules: true
    });
    if (error) return setStatus('[data-fm-join-status]', error.message);
    setStatus('[data-fm-join-status]', '');
    await refresh();
  });

  // ---------------------------------------------------------------- profile card + me form
  async function loadMe() {
    const uid = state.session?.user?.id;
    state.me = null;
    if (!uid) return;
    const { data } = await db.from('forum_profiles').select('user_id,display_name,headline,location,about,avatar_url,is_suspended,verification_status,verification_reason').eq('user_id', uid).maybeSingle();
    state.profile = data || null;
    // Only ID-verified, active profiles are members (the database enforces the same rule).
    state.me = data && !data.is_suspended && data.verification_status === 'approved' ? data : null;
    if (data?.is_suspended) setStatus('[data-fm-join-status]', 'Your forum account is suspended. Contact WHSF if you think this is a mistake.');
  }

  // ---------------------------------------------------------------- age verification (official photo ID + selfie)
  // Images go to the private forum-id-checks bucket; only WHSF moderators can open them.
  const ID_TYPES = { national_id: 'National ID', passport: 'Passport', drivers_licence: "Driver's licence", voter_card: "Voter's card", residence_permit: 'Residence permit' };
  const ID_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  const VIDEO_EXT = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };
  const MAX_ID_BYTES = 8 * 1024 * 1024;
  const MAX_VIDEO_BYTES = 30 * 1024 * 1024;
  // Google Calendar booking page for verification video calls (made in info@'s Google Calendar).
  // Leave empty until it exists: members are then told a moderator will email them a Meet link.
  const VIDEO_CALL_BOOKING_URL = '';
  const METHODS = { photo_selfie: 'Photo selfie', video_selfie: 'Video selfie', video_call: 'Video call' };

  // Self-service vs video call: show the matching steps and fields.
  function syncMethod() {
    const call = $('[data-fm-verify-form]').method.value === 'video_call';
    $('[data-fm-steps-self]').hidden = call;
    $('[data-fm-steps-call]').hidden = !call;
    $('[data-fm-self-only]').hidden = call;
  }
  $$('[data-fm-verify-form] input[name="method"]').forEach((r) => r.addEventListener('change', syncMethod));

  // On a computer, offer a QR code that opens this page on the member's phone (free, no text messages).
  async function renderHandoff() {
    const box = $('[data-fm-handoff]');
    const onComputer = window.matchMedia('(pointer: fine) and (min-width: 900px)').matches;
    box.hidden = !onComputer || !window.QRCode?.toCanvas;
    if (box.hidden) return;
    try {
      await window.QRCode.toCanvas($('[data-fm-handoff-qr]'), `${location.origin}/forum.html`, { width: 132, margin: 1, color: { dark: '#2a0a17', light: '#ffffff' } });
    } catch { box.hidden = true; return; }
    // "Waiting for your photos": once the phone submits, this computer page updates by itself.
    clearInterval(state.handoffTimer);
    state.handoffTimer = setInterval(async () => {
      if (document.hidden || !state.profile) return;
      const { data } = await db.from('forum_profiles').select('verification_status').eq('user_id', state.profile.user_id).maybeSingle();
      if (data && data.verification_status !== state.profile.verification_status) {
        clearInterval(state.handoffTimer);
        await refresh();
      }
    }, 10000);
  }

  async function renderVerify() {
    const p = state.profile;
    const card = $('[data-fm-verify]');
    card.hidden = !p || p.is_suspended || p.verification_status === 'approved';
    if (card.hidden) return;
    const pending = p.verification_status === 'pending';
    $('[data-fm-verify-badge]').textContent = pending ? 'Step 2 of 2 · Under review' : 'Step 2 of 2 · Age verification';
    $('[data-fm-verify-title]').textContent = pending ? 'Your verification is under review' : 'Verify your age to enter the forum';
    $('[data-fm-verify-pending]').hidden = !pending;
    $('[data-fm-verify-start]').hidden = pending;
    const rejected = $('[data-fm-verify-rejected]');
    rejected.hidden = p.verification_status !== 'rejected';
    rejected.textContent = p.verification_status === 'rejected'
      ? `Your last ID check was not approved: ${p.verification_reason || 'please try again'}. Please submit new photos.` : '';
    if (!pending) {
      const { data, error } = await db.rpc('forum_id_code');
      const code = error ? 'reload the page' : data;
      $('[data-fm-verify-code]').textContent = code;
      $('[data-fm-verify-code-2]').textContent = code;
      syncMethod();
      renderHandoff();
    }
    // Waiting for a video call: show the booking button (or say a moderator will email a link).
    const callBox = $('[data-fm-call-box]');
    callBox.hidden = true;
    if (pending) {
      const { data: last } = await db.from('forum_id_checks').select('method').eq('user_id', p.user_id).eq('status', 'pending').maybeSingle();
      if (last?.method === 'video_call') {
        callBox.hidden = false;
        const book = $('[data-fm-book-call]');
        book.hidden = !VIDEO_CALL_BOOKING_URL;
        if (VIDEO_CALL_BOOKING_URL) book.href = VIDEO_CALL_BOOKING_URL;
        $('[data-fm-call-fallback]').hidden = Boolean(VIDEO_CALL_BOOKING_URL);
      }
    }
  }

  $('[data-fm-verify-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const f = event.currentTarget;
    const say = (t) => setStatus('[data-fm-verify-status]', t);
    const call = f.method.value === 'video_call';
    const front = f.id_front.files[0]; const back = f.id_back.files[0]; const selfie = call ? null : f.selfie.files[0];
    if (f.country.value.trim().length < 2) return say('Enter the country that issued your ID.');
    if (!f.id_type.value) return say('Choose the type of ID.');
    if (!front) return say('Add a photo of the front of your ID.');
    if (!call && !selfie) return say('Add your video selfie (or a photo selfie) holding your ID and the code.');
    for (const file of [front, back].filter(Boolean)) {
      if (!ID_EXT[file.type]) return say('ID photos must be JPG, PNG or WebP.');
      if (file.size > MAX_ID_BYTES) return say('Each ID photo must be 8 MB or smaller.');
    }
    const selfieIsVideo = Boolean(selfie && VIDEO_EXT[selfie.type]);
    if (selfie && !selfieIsVideo && !ID_EXT[selfie.type]) return say('The selfie must be an MP4, WebM or MOV video, or a JPG, PNG or WebP photo.');
    if (selfie && selfie.size > (selfieIsVideo ? MAX_VIDEO_BYTES : MAX_ID_BYTES)) {
      return say(selfieIsVideo ? 'The video selfie must be 30 MB or smaller. Keep it to about 10 seconds.' : 'The selfie photo must be 8 MB or smaller.');
    }
    if (!f.consent.checked) return say('Please agree to WHSF viewing your ID and selfie for age verification.');
    const method = call ? 'video_call' : (selfieIsVideo ? 'video_selfie' : 'photo_selfie');
    const button = f.querySelector('button[type="submit"]');
    button.disabled = true;
    const uploaded = [];
    const upload = async (file) => {
      const path = `${state.profile.user_id}/${crypto.randomUUID()}.${ID_EXT[file.type] || VIDEO_EXT[file.type]}`;
      const { error } = await db.storage.from('forum-id-checks').upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      uploaded.push(path);
      return path;
    };
    try {
      say(selfieIsVideo ? 'Uploading securely… (videos can take a minute)' : 'Uploading securely…');
      const frontPath = await upload(front);
      const backPath = back ? await upload(back) : null;
      const selfiePath = selfie ? await upload(selfie) : null;
      const { error } = await db.rpc('forum_id_submit_v2', {
        p_method: method, p_country: f.country.value.trim(), p_id_type: f.id_type.value, p_front: frontPath, p_back: backPath, p_selfie: selfiePath
      });
      if (error) throw error;
      // Let WHSF moderators know (the server sends at most one email per check).
      const token = state.session?.access_token;
      if (token) fetch('/api/forum-id-alert', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
      f.reset(); say('');
      await refresh();
    } catch (error) {
      if (uploaded.length) await db.storage.from('forum-id-checks').remove(uploaded);
      say(error?.message ? `Could not submit: ${error.message}` : 'Could not submit. Please try again.');
    } finally {
      button.disabled = false;
    }
  });

  // ---------------------------------------------------------------- moderators: ID check queue
  async function deleteIdFiles(check) {
    const paths = [check.id_front_path, check.id_back_path, check.selfie_path].filter(Boolean);
    if (paths.length) {
      const { error } = await db.storage.from('forum-id-checks').remove(paths);
      if (error) return error;
    }
    const { error } = await db.rpc('forum_id_files_deleted', { p_check_id: check.id });
    return error;
  }

  async function loadIdChecks() {
    const box = $('[data-fm-idchecks]');
    const cleanup = $('[data-fm-idcleanup]');
    if (!state.isStaff) return;
    const cols = 'id,user_id,method,country,id_type,challenge_code,id_front_path,id_back_path,selfie_path,status,submitted_at,forum_profiles(display_name)';
    const { data: pending, error } = await db.from('forum_id_checks').select(cols).eq('status', 'pending').order('submitted_at').limit(20);
    if (error) { box.replaceChildren(el('p', { class: 'fm-muted', text: 'Could not load ID checks.' })); return; }
    box.replaceChildren();
    if (!pending.length) box.append(el('p', { class: 'fm-muted', text: 'No ID checks waiting.' }));
    for (const check of pending) box.append(await renderIdCheck(check));

    // Decided checks whose images are still stored (e.g. a delete failed): offer to delete them.
    const { data: leftover } = await db.from('forum_id_checks').select('id,status,id_front_path,id_back_path,selfie_path,reviewed_at,forum_profiles(display_name)')
      .neq('status', 'pending').is('files_deleted_at', null).limit(20);
    cleanup.replaceChildren();
    (leftover || []).forEach((check) => {
      const status = el('p', { class: 'fm-status', role: 'status' });
      cleanup.append(el('div', { class: 'fm-idcheck' }, [
        el('p', { text: `${check.forum_profiles?.display_name || 'Member'}: ${check.status}, images still stored.` }),
        el('div', { class: 'fm-actions' }, [el('button', { class: 'fm-text-btn', type: 'button', text: 'Delete images now', onclick: async () => {
          const err = await deleteIdFiles(check);
          if (err) status.textContent = `Could not delete: ${err.message}`; else loadIdChecks();
        } })]),
        status
      ]));
    });
  }

  async function renderIdCheck(check) {
    const status = el('p', { class: 'fm-status', role: 'status' });
    const imgs = el('div', { class: 'fm-idcheck-imgs' });
    for (const [label, path] of [['ID front', check.id_front_path], ['ID back', check.id_back_path], ['Selfie', check.selfie_path]]) {
      if (!path) continue;
      const { data } = await db.storage.from('forum-id-checks').createSignedUrl(path, 600);
      if (!data?.signedUrl) { imgs.append(el('p', { class: 'fm-muted', text: `${label}: could not load` })); continue; }
      const isVideo = /\.(mp4|webm|mov)$/i.test(path);
      imgs.append(el('figure', {}, isVideo ? [
        el('video', { src: data.signedUrl, controls: '', playsinline: '', preload: 'metadata', 'aria-label': 'Video selfie submitted for age verification' }),
        el('figcaption', { text: 'Video selfie (listen for the code)' })
      ] : [
        el('a', { href: data.signedUrl, target: '_blank', rel: 'noopener noreferrer' }, [el('img', { src: data.signedUrl, alt: `${label} submitted for age verification` })]),
        el('figcaption', { text: `${label} (opens full size)` })
      ]));
    }
    const isCall = check.method === 'video_call';
    const box = (name, text) => el('label', { class: 'fm-check' }, [el('input', { type: 'checkbox', name }), el('span', { text })]);
    const age = box('age', 'The date of birth on the ID shows they are 18 or over');
    const face = box('face', isCall
      ? `On the video call I saw this person live; they showed this ID and said the code ${check.challenge_code}`
      : `The selfie shows the same face, holding the ID and showing or saying the code ${check.challenge_code}`);
    const genuine = box('genuine', 'The ID is an official government document and looks genuine');
    const reason = el('input', { type: 'text', maxlength: '300', placeholder: 'e.g. photo blurry, under 18, code missing' });
    const decide = async (approve) => {
      status.textContent = approve ? 'Approving…' : 'Rejecting…';
      const { error } = await db.rpc('forum_id_review', {
        p_check_id: check.id, p_approve: approve, p_reason: reason.value,
        p_age_18_plus: age.querySelector('input').checked, p_face_matches: face.querySelector('input').checked, p_genuine_id: genuine.querySelector('input').checked
      });
      if (error) { status.textContent = error.message; return; }
      const delError = await deleteIdFiles(check);
      if (delError) status.textContent = `Decision saved, but the images could not be deleted: ${delError.message}`;
      else loadIdChecks();
    };
    return el('article', { class: 'fm-idcheck' }, [
      el('h3', { text: check.forum_profiles?.display_name || 'Member' }),
      el('p', { class: 'fm-muted', text: `${METHODS[check.method] || 'Photo selfie'} · ${ID_TYPES[check.id_type] || check.id_type} · ${check.country} · code ${check.challenge_code} · submitted ${timeAgo(check.submitted_at)} ago` }),
      isCall ? el('p', { class: 'fm-alert', text: 'Video call: wait until you have met this person on Google Meet, then tick the boxes and approve.' }) : null,
      imgs, age, face, genuine,
      el('div', { class: 'fm-form' }, [el('label', {}, [document.createTextNode('Reason (shown to the member if rejected)'), reason])]),
      el('div', { class: 'fm-actions' }, [
        el('button', { class: 'hp-btn hp-btn-primary', type: 'button', text: 'Approve', onclick: () => decide(true) }),
        el('button', { class: 'hp-btn hp-btn-outline', type: 'button', text: 'Reject', onclick: () => decide(false) })
      ]),
      status
    ]);
  }
  async function loadFollows() {
    const uid = state.me?.user_id;
    state.following = new Set(); state.followers = new Set();
    if (!uid) return;
    const [{ data: out }, { data: inc }] = await Promise.all([
      db.from('forum_follows').select('followee_id').eq('follower_id', uid),
      db.from('forum_follows').select('follower_id').eq('followee_id', uid)
    ]);
    (out || []).forEach((r) => state.following.add(r.followee_id));
    (inc || []).forEach((r) => state.followers.add(r.follower_id));
  }
  function renderProfileCard() {
    const me = state.me;
    $('[data-fm-profile-card]').hidden = !me;
    $('[data-fm-guest-card]').hidden = Boolean(me);
    $$('[data-fm-me-avatar]').forEach((n) => fillAvatar(n, me));
    if (!me) return;
    $$('[data-fm-avatar]').forEach((n) => fillAvatar(n, me));
    $('[data-fm-name]').textContent = me.display_name;
    $('[data-fm-headline]').textContent = me.headline || 'Add a headline';
    $('[data-fm-location]').textContent = me.location ? `📍 ${me.location}` : '';
    const connections = [...state.following].filter((id) => state.followers.has(id)).length;
    $('[data-fm-connections]').textContent = connections;
    $('[data-fm-followers]').textContent = state.followers.size;
    const steps = [['display_name', 'add your name'], ['headline', 'add a headline'], ['location', 'add your location'], ['about', 'write your About'], ['avatar_url', 'add a photo']];
    const done = steps.filter(([key]) => me[key]).length;
    $('[data-fm-strength]').textContent = `${done}/5`;
    $('[data-fm-strength-bar]').style.width = `${(done / 5) * 100}%`;
    const next = steps.find(([key]) => !me[key]);
    const nextLink = $('[data-fm-next-step]');
    nextLink.hidden = !next;
    if (next) nextLink.textContent = `Next: ${next[1]} →`;
  }
  function fillMeForm() {
    if (!state.me) return;
    const f = $('[data-fm-me-form]');
    ['display_name', 'headline', 'location', 'about'].forEach((k) => { f[k].value = state.me[k] || ''; });
  }
  $('[data-fm-me-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const f = event.currentTarget;
    if (f.display_name.value.trim().length < 2) return setStatus('[data-fm-me-status]', 'Your name must be at least 2 characters.');
    const patch = {};
    ['display_name', 'headline', 'location', 'about'].forEach((k) => { patch[k] = f[k].value.trim() || null; });
    const { error } = await db.from('forum_profiles').update(patch).eq('user_id', state.me.user_id);
    if (error) return setStatus('[data-fm-me-status]', error.message);
    setStatus('[data-fm-me-status]', 'Profile saved.');
    await loadMe(); renderProfileCard();
  });
  $('[data-fm-avatar-file]').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const url = await uploadImage(file, '[data-fm-me-status]');
    if (!url) return;
    const { error } = await db.from('forum_profiles').update({ avatar_url: url }).eq('user_id', state.me.user_id);
    if (error) return setStatus('[data-fm-me-status]', error.message);
    setStatus('[data-fm-me-status]', 'Photo updated.');
    await loadMe(); renderProfileCard();
  });

  async function uploadImage(file, statusSel) {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) { setStatus(statusSel, 'Pictures must be JPG, PNG, WebP or GIF.'); return null; }
    if (file.size > MAX_IMAGE_BYTES) { setStatus(statusSel, 'Pictures must be 5 MB or smaller.'); return null; }
    const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[file.type];
    const path = `${state.me.user_id}/${crypto.randomUUID()}.${ext}`;
    setStatus(statusSel, 'Uploading picture…');
    const { error } = await db.storage.from('forum-images').upload(path, file, { contentType: file.type, upsert: false });
    if (error) { setStatus(statusSel, 'Upload failed. Please try again.'); return null; }
    setStatus(statusSel, '');
    return `${IMAGE_PREFIX}${path}`;
  }

  // ---------------------------------------------------------------- composer
  const postForm = $('[data-fm-post-form]');
  $('[data-fm-file]').addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type) || file.size > MAX_IMAGE_BYTES) {
      return setStatus('[data-fm-post-status]', 'Pictures must be JPG, PNG, WebP or GIF and 5 MB or smaller.');
    }
    state.file = file;
    $('[data-fm-attach-img]').src = URL.createObjectURL(file);
    $('[data-fm-attach]').hidden = false;
  });
  $('[data-fm-attach-remove]').addEventListener('click', () => { state.file = null; $('[data-fm-attach]').hidden = true; });
  $('[data-fm-celebrate]').addEventListener('click', (event) => {
    state.celebrate = !state.celebrate;
    event.currentTarget.setAttribute('aria-pressed', String(state.celebrate));
  });
  $('[data-fm-location-toggle]').addEventListener('click', () => { const row = $('[data-fm-location-row]'); row.hidden = !row.hidden; if (!row.hidden) row.querySelector('input').focus(); });
  postForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const body = postForm.body.value.trim();
    if (!body) return setStatus('[data-fm-post-status]', 'Write something first.');
    const button = postForm.querySelector('button[type="submit"]');
    button.disabled = true;
    let imageUrl = null;
    if (state.file) {
      imageUrl = await uploadImage(state.file, '[data-fm-post-status]');
      if (!imageUrl) { button.disabled = false; return; }
    }
    const { error } = await db.from('forum_posts').insert({
      author_id: state.me.user_id, body, kind: state.celebrate ? 'celebrate' : 'post',
      image_url: imageUrl, location: postForm.location.value.trim() || null
    });
    button.disabled = false;
    if (error) return setStatus('[data-fm-post-status]', error.message);
    postForm.reset(); state.file = null; state.celebrate = false;
    $('[data-fm-attach]').hidden = true; $('[data-fm-location-row]').hidden = true;
    $('[data-fm-celebrate]').setAttribute('aria-pressed', 'false');
    setStatus('[data-fm-post-status]', 'Posted.');
    if ((location.hash || '#feed') !== '#feed') location.hash = '#feed';
    loadFeed(true);
  });

  // ---------------------------------------------------------------- feed
  $$('[data-fm-scope]').forEach((b) => b.addEventListener('click', () => {
    state.scope = b.dataset.fmScope;
    $$('[data-fm-scope]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    loadFeed(true);
  }));
  $('[data-fm-more]').addEventListener('click', () => loadFeed(false));

  async function loadFeed(reset) {
    const feed = $('[data-fm-feed]');
    if (!state.me && !state.isStaff) { feed.replaceChildren(); $('[data-fm-more]').hidden = true; return; }
    if (reset) { state.feedOffset = 0; feed.replaceChildren(el('p', { class: 'fm-card fm-empty', text: 'Loading posts…' })); }
    let query = db.from('forum_posts')
      .select('id,kind,body,image_url,location,created_at,is_hidden,author_id,author:forum_profiles!forum_posts_author_id_fkey(display_name,headline,avatar_url)')
      .order('created_at', { ascending: false })
      .range(state.feedOffset, state.feedOffset + PAGE_SIZE - 1);
    if (state.scope === 'network') query = query.in('author_id', [state.me.user_id, ...state.following]);
    const { data, error } = await query;
    if (reset) feed.replaceChildren();
    if (error) { feed.append(el('p', { class: 'fm-card fm-empty', text: 'Posts could not be loaded. Please refresh.' })); return; }
    if (reset && !data.length) {
      feed.append(el('p', { class: 'fm-card fm-empty', text: state.scope === 'network' ? 'No posts from your network yet. Follow people under Network.' : 'No posts yet. Start the first conversation!' }));
    }
    data.forEach((post) => feed.append(renderPost(post)));
    state.feedOffset += data.length;
    $('[data-fm-more]').hidden = data.length < PAGE_SIZE;
  }

  function renderPost(post) {
    const author = post.author || {};
    const avatar = el('div', { class: 'fm-avatar', 'aria-hidden': 'true' }); fillAvatar(avatar, author);
    const meta = el('div', {}, [
      el('strong', { text: author.display_name || 'Member' }),
      el('span', { text: author.headline || '' }),
      el('span', { text: `${timeAgo(post.created_at)}${post.location ? ' · ' + post.location : ''}` })
    ]);
    const card = el('article', { class: `fm-card fm-post${post.kind === 'celebrate' ? ' is-celebrate' : ''}${post.is_hidden ? ' is-hidden' : ''}` }, [
      el('div', { class: 'fm-post-head' }, [avatar, meta])
    ]);
    if (post.kind === 'celebrate') card.append(el('span', { class: 'fm-post-tag', text: '🎉 Celebrating' }));
    if (post.is_hidden) card.append(el('span', { class: 'fm-post-tag', text: 'Hidden by a moderator' }));
    card.append(el('p', { class: 'fm-post-body', text: post.body }));
    const img = safeImage(post.image_url);
    if (img) card.append(el('img', { class: 'fm-post-img', src: img, alt: 'Picture shared by ' + (author.display_name || 'a member'), loading: 'lazy' }));

    const actions = el('div', { class: 'fm-post-actions' });
    const mine = post.author_id === state.me?.user_id;
    if (!mine && state.me) {
      actions.append(el('button', { class: 'fm-text-btn', type: 'button', text: 'Report', onclick: () => openReport(card, post) }));
      if (!state.following.has(post.author_id)) {
        actions.append(el('button', { class: 'fm-text-btn', type: 'button', text: `Follow ${author.display_name || ''}`.trim(), onclick: async (e) => { await follow(post.author_id, true); e.target.remove(); } }));
      }
    }
    if (mine || state.isStaff) {
      actions.append(el('button', { class: 'fm-text-btn', type: 'button', text: 'Delete', onclick: () => confirmInline(card, 'Delete this post?', async () => {
        const { error } = await db.from('forum_posts').delete().eq('id', post.id);
        if (!error) card.remove();
      }) }));
    }
    if (state.isStaff) {
      actions.append(el('button', { class: 'fm-text-btn', type: 'button', text: post.is_hidden ? 'Unhide (moderator)' : 'Hide (moderator)', onclick: async () => {
        const { error } = await db.from('forum_posts').update({ is_hidden: !post.is_hidden, hidden_reason: post.is_hidden ? null : 'Hidden by WHSF moderator' }).eq('id', post.id);
        if (!error) loadFeed(true);
      } }));
    }
    if (actions.childElementCount) card.append(actions);
    return card;
  }

  function confirmInline(card, question, onYes) {
    if (card.querySelector('.fm-report')) return;
    const box = el('div', { class: 'fm-report' }, [
      el('p', { class: 'fm-muted', text: question }),
      el('div', { class: 'fm-actions' }, [
        el('button', { class: 'hp-btn hp-btn-primary', type: 'button', text: 'Yes', onclick: async () => { await onYes(); box.remove(); } }),
        el('button', { class: 'fm-text-btn', type: 'button', text: 'Cancel', onclick: () => box.remove() })
      ])
    ]);
    card.append(box);
  }
  function openReport(card, post) {
    if (card.querySelector('.fm-report')) return;
    const reason = el('textarea', { rows: '2', maxlength: '500', placeholder: 'What is wrong with this post? (scam, harassment, child safety, other)' });
    const status = el('p', { class: 'fm-status', role: 'status' });
    const box = el('div', { class: 'fm-report' }, [
      reason,
      el('div', { class: 'fm-actions' }, [
        el('button', { class: 'hp-btn hp-btn-primary', type: 'button', text: 'Send report', onclick: async () => {
          if (reason.value.trim().length < 3) { status.textContent = 'Please describe the problem.'; return; }
          const { error } = await db.from('forum_reports').insert({ post_id: post.id, reporter_id: state.me.user_id, reason: reason.value.trim() });
          status.textContent = error ? (error.code === '23505' ? 'You already reported this post.' : 'Report could not be sent.') : 'Thank you. WHSF moderators will review it.';
          if (!error) setTimeout(() => box.remove(), 2500);
        } }),
        el('button', { class: 'fm-text-btn', type: 'button', text: 'Cancel', onclick: () => box.remove() })
      ]),
      status
    ]);
    card.append(box);
    reason.focus();
  }

  // ---------------------------------------------------------------- people
  async function follow(userId, on) {
    if (on) await db.from('forum_follows').insert({ follower_id: state.me.user_id, followee_id: userId });
    else await db.from('forum_follows').delete().eq('follower_id', state.me.user_id).eq('followee_id', userId);
    await loadFollows(); renderProfileCard();
  }
  async function loadPeople() {
    const list = $('[data-fm-people]');
    if (!state.me) return;
    list.replaceChildren(el('p', { class: 'fm-muted', text: 'Loading members…' }));
    const term = $('#fm-search').value.trim();
    let query = db.from('forum_profiles').select('user_id,display_name,headline,location,avatar_url').neq('user_id', state.me.user_id).order('created_at', { ascending: false }).limit(60);
    if (term) {
      const like = `%${term.replace(/[%_,()]/g, ' ')}%`;
      query = query.or(`display_name.ilike.${like},headline.ilike.${like},location.ilike.${like}`);
    }
    const { data, error } = await query;
    list.replaceChildren();
    if (error || !data.length) { list.append(el('p', { class: 'fm-muted', text: error ? 'Members could not be loaded.' : 'No members found.' })); return; }
    data.forEach((p) => {
      const avatar = el('div', { class: 'fm-avatar', 'aria-hidden': 'true' }); fillAvatar(avatar, p);
      const following = state.following.has(p.user_id);
      const button = el('button', { class: `fm-follow${following ? ' is-following' : ''}`, type: 'button', text: following ? 'Following' : 'Follow', 'aria-pressed': String(following) });
      button.addEventListener('click', async () => {
        const now = !state.following.has(p.user_id);
        await follow(p.user_id, now);
        button.textContent = now ? 'Following' : 'Follow';
        button.classList.toggle('is-following', now);
        button.setAttribute('aria-pressed', String(now));
      });
      list.append(el('div', { class: 'fm-person' }, [avatar, el('div', {}, [
        el('strong', { text: p.display_name }),
        el('span', { text: [p.headline, p.location].filter(Boolean).join(' · ') })
      ]), button]));
    });
  }
  let searchTimer;
  $('#fm-search').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      if (!state.me) return;
      if (location.hash !== '#people') location.hash = '#people'; else loadPeople();
    }, 350);
  });

  // ---------------------------------------------------------------- funding opportunities (public data)
  async function loadOpportunities() {
    const list = $('[data-fm-opps]');
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await db.from('whsf_opportunities')
      .select('title,funder_name,deadline').eq('kind', 'grant').eq('review_status', 'published').neq('status', 'closed')
      .gte('deadline', today).order('deadline', { ascending: true }).limit(5);
    list.replaceChildren();
    if (error || !data?.length) { list.append(el('li', { class: 'fm-muted', text: 'See the grants portal for open opportunities.' })); return; }
    const icon = () => { const s = el('span', { 'aria-hidden': 'true' }); s.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>'; return s; };
    data.forEach((g) => {
      const due = g.deadline ? new Date(g.deadline + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
      list.append(el('li', {}, [icon(), el('div', {}, [
        el('a', { href: 'grants.html#grant-search', text: g.title }),
        el('small', { text: [g.funder_name, due && `Closes ${due}`].filter(Boolean).join(' · ') })
      ])]));
    });
  }

  // ---------------------------------------------------------------- page state
  async function refresh() {
    const { data } = await db.auth.getSession();
    state.session = data.session;
    state.isStaff = ['admin', 'teacher'].includes(state.session?.user?.app_metadata?.role);
    await loadMe();
    await loadFollows();
    const signedIn = Boolean(state.session);
    $('[data-fm-auth]').hidden = signedIn;
    $('[data-fm-join]').hidden = !signedIn || Boolean(state.profile);
    $$('[data-fm-staff-only]').forEach((n) => { n.hidden = !state.isStaff; });
    await renderVerify();
    $('[data-fm-composer]').hidden = !state.me;
    $('[data-fm-filter]').hidden = !state.me;
    if (signedIn && !state.profile) {
      const f = $('[data-fm-join-form]');
      if (!f.display_name.value) f.display_name.value = state.session.user.user_metadata?.full_name || '';
    }
    renderProfileCard();
    showView();
    loadFeed(true);
  }

  renderAuthMode();
  db.auth.onAuthStateChange((event) => { if (['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED'].includes(event)) refresh(); });
  refresh();
  loadOpportunities();
})();
