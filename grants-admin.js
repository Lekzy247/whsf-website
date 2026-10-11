// WHSF Grants Admin (grants-admin.html). Every write is checked again by the
// database (RLS + whsf_grants_is_admin()); hiding a button here is only UX.
(() => {
  const SUPABASE_URL = 'https://ophymlgqnfilgxsuzcuz.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_tA1TRg0XkBKKXZ5UwFbu4Q_qGIST2Xh';
  const PAGE_SIZE = 50;

  const SECTORS = {
    ict: 'ICT', stem: 'STEM', ai: 'AI', education: 'Education', womens_empowerment: 'Women & girls',
    youth: 'Youth', health: 'Health', agriculture: 'Agriculture', climate: 'Climate',
    humanitarian: 'Humanitarian', economic_development: 'Livelihoods',
  };
  const APPLICANTS = {
    nonprofit: 'Nonprofits', us_nonprofit: 'US 501(c)(3)', school: 'Schools', university: 'Universities',
    government: 'Government', business: 'Businesses', individual: 'Individuals', any: 'Unrestricted',
  };
  const SOURCE_LABELS = { manual: 'WHSF', grants_gov: 'Grants.gov', eu_ft: 'EU F&T', indico_un: 'Indico.UN' };

  const $ = (selector) => document.querySelector(selector);
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (value === undefined || value === null || value === false) continue;
      if (key === 'text') node.textContent = value;
      else if (key === 'class') node.className = value;
      else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value === true ? '' : value);
    }
    for (const child of [].concat(children)) if (child !== null && child !== undefined) node.append(child);
    return node;
  }
  const safeUrl = (url) => (/^https:\/\//i.test(url || '') ? url : null);
  const listFrom = (text) => String(text || '').split(/[,\s]+/).map((s) => s.trim().toUpperCase()).filter(Boolean);
  const setStatus = (selector, text) => { $(selector).textContent = text; };

  function fillCheckboxes(fieldset, options, name) {
    for (const [value, label] of Object.entries(options)) {
      fieldset.append(el('label', {}, [el('input', { type: 'checkbox', name, value }), label]));
    }
  }
  const checked = (form, name) => [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((i) => i.value);
  const setChecked = (form, name, values) => form.querySelectorAll(`input[name="${name}"]`)
    .forEach((input) => { input.checked = (values || []).includes(input.value); });

  async function withButton(button, task) {
    button.disabled = true;
    try { await task(); } finally { button.disabled = false; }
  }

  function init() {
    if (!window.supabase) return;
    const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    const loginForm = $('#login-form');
    const dashboard = $('#dashboard');

    fillCheckboxes($('[data-checkboxes="sectors"]'), SECTORS, 'sectors');
    fillCheckboxes($('[data-checkboxes="applicant_types"]'), APPLICANTS, 'applicant_types');
    fillCheckboxes($('[data-checkboxes="funder_sectors"]'), SECTORS, 'funder_sectors');

    async function showFor(session) {
      if (!session) {
        dashboard.hidden = true;
        $('#signout-button').hidden = true;
        return;
      }
      const { data: isAdmin } = await db.rpc('whsf_grants_is_admin');
      $('#signout-button').hidden = false;
      if (!isAdmin) {
        dashboard.hidden = true;
        setStatus('#login-status', `${session.user.email} is not a grants administrator.`);
        return;
      }
      setStatus('#login-status', `Signed in as ${session.user.email}.`);
      dashboard.hidden = false;
      loadAll();
    }

    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = loginForm.elements.email.value.trim();
      const password = loginForm.elements.password.value;
      if (!password) return setStatus('#login-status', 'Enter your password, or use "Email me a sign-in link".');
      setStatus('#login-status', 'Signing in…');
      const { data, error } = await db.auth.signInWithPassword({ email, password });
      if (error) return setStatus('#login-status', 'Sign-in failed. Check your email and password.');
      showFor(data.session);
    });
    $('#magic-link-button').addEventListener('click', async () => {
      const email = loginForm.elements.email.value.trim();
      if (!email) return setStatus('#login-status', 'Enter your admin email first.');
      const { error } = await db.auth.signInWithOtp({
        email, options: { shouldCreateUser: false, emailRedirectTo: window.location.href.split('#')[0] },
      });
      setStatus('#login-status', error ? 'Could not send the link. Is this email registered?' : `Sign-in link sent to ${email}.`);
    });
    $('#signout-button').addEventListener('click', async () => {
      await db.auth.signOut();
      setStatus('#login-status', 'Signed out.');
      showFor(null);
    });
    db.auth.getSession().then(({ data }) => showFor(data.session));

    // ------------------------------------------------------------ counts
    async function loadCounts() {
      const count = (query) => query.then(({ count: n }) => n ?? '–');
      const base = () => db.from('whsf_opportunities').select('id', { count: 'exact', head: true });
      const [pending, published, hidden, events, funders] = await Promise.all([
        count(base().eq('review_status', 'pending').neq('status', 'closed')),
        count(base().eq('review_status', 'published').eq('kind', 'grant').neq('status', 'closed')),
        count(base().eq('review_status', 'hidden')),
        count(base().eq('review_status', 'published').eq('kind', 'event')),
        count(db.from('whsf_funders').select('id', { count: 'exact', head: true })),
      ]);
      Object.entries({ pending, published, hidden, events, funders })
        .forEach(([key, value]) => { $(`[data-count="${key}"]`).textContent = value; });
    }

    // ------------------------------------------------------------ review queue
    let reviewTab = 'pending';
    let reviewPage = 0;
    document.querySelectorAll('[data-review-tab]').forEach((button) => button.addEventListener('click', () => {
      document.querySelectorAll('[data-review-tab]').forEach((b) => b.classList.toggle('active', b === button));
      reviewTab = button.dataset.reviewTab;
      loadReview(true);
    }));
    $('#review-filters').addEventListener('submit', (event) => { event.preventDefault(); loadReview(true); });
    $('#review-more').addEventListener('click', () => loadReview(false));

    async function setReview(row, status, button) {
      await withButton(button, async () => {
        const { error } = await db.from('whsf_opportunities')
          .update({ review_status: status, updated_at: new Date().toISOString() }).eq('id', row.id);
        if (error) return setStatus('#review-status', `Could not update: ${error.message}`);
        setStatus('#review-status', `"${row.title.slice(0, 60)}" is now ${status}.`);
        button.closest('tr').remove();
        loadCounts();
      });
    }

    function reviewRow(row) {
      const url = safeUrl(row.url);
      const when = row.kind === 'event' && row.open_date ? `${row.open_date} → ${row.deadline || ''}` : (row.deadline || row.deadline_note || '—');
      const actions = el('div', { class: 'grant-admin-actions' });
      if (row.review_status !== 'published') actions.append(el('button', { type: 'button', class: 'primary', text: 'Publish', onclick: (e) => setReview(row, 'published', e.currentTarget) }));
      if (row.review_status !== 'hidden') actions.append(el('button', { type: 'button', text: 'Hide', onclick: (e) => setReview(row, 'hidden', e.currentTarget) }));
      if (row.review_status !== 'pending') actions.append(el('button', { type: 'button', text: 'Back to pending', onclick: (e) => setReview(row, 'pending', e.currentTarget) }));
      if (row.kind === 'grant') actions.append(el('button', { type: 'button', text: 'Edit', onclick: () => editGrant(row.id) }));
      return el('tr', {}, [
        el('td', {}, [
          url ? el('a', { href: url, target: '_blank', rel: 'noopener noreferrer', text: row.title }) : row.title,
          el('div', { class: 'grant-admin-muted', text: [row.funder_name, row.kind === 'event' ? row.location : (row.countries || []).join(', ')].filter(Boolean).join(' · ') }),
        ]),
        el('td', { text: `${SOURCE_LABELS[row.source] || row.source}${row.kind === 'event' ? ' (event)' : ''}` }),
        el('td', { text: row.status === 'forecasted' ? `${when} (forecast)` : when }),
        el('td', { text: (row.sectors || []).map((s) => SECTORS[s] || s).join(', ') }),
        el('td', {}, actions),
      ]);
    }

    async function loadReview(reset) {
      if (reset) reviewPage = 0;
      const filters = Object.fromEntries(new FormData($('#review-filters')));
      let query = db.from('whsf_opportunities')
        .select('id,kind,source,title,funder_name,url,countries,location,sectors,open_date,deadline,deadline_note,status,review_status', { count: 'exact' })
        .eq('review_status', reviewTab);
      if (reviewTab !== 'hidden') query = query.neq('status', 'closed');
      if (filters.kind) query = query.eq('kind', filters.kind);
      if (filters.source) query = query.eq('source', filters.source);
      if (filters.q) {
        const term = filters.q.replace(/[,()%*]/g, ' ').trim();
        if (term) query = query.or(`title.ilike.*${term}*,funder_name.ilike.*${term}*`);
      }
      const from = reviewPage * PAGE_SIZE;
      const { data, error, count } = await query.order('deadline', { ascending: true, nullsFirst: false })
        .range(from, from + PAGE_SIZE - 1);
      const tbody = $('#review-table');
      if (error) return setStatus('#review-status', `Could not load: ${error.message}`);
      if (reset) tbody.replaceChildren();
      data.forEach((row) => tbody.append(reviewRow(row)));
      if (reset && !data.length) tbody.append(el('tr', {}, el('td', { colspan: '5', text: 'Nothing here.' })));
      reviewPage += 1;
      $('#review-more').hidden = reviewPage * PAGE_SIZE >= (count ?? 0);
      if (reset) setStatus('#review-status', `${count ?? 0} item${count === 1 ? '' : 's'}`);
    }

    // ------------------------------------------------------------ add / edit grant
    const grantForm = $('#grant-form');
    async function editGrant(id) {
      const { data, error } = await db.from('whsf_opportunities').select('*').eq('id', id).single();
      if (error) return setStatus('#review-status', `Could not open: ${error.message}`);
      for (const field of ['id', 'title', 'funder_name', 'url', 'open_date', 'deadline', 'deadline_note', 'status',
        'amount_min_usd', 'amount_max_usd', 'location', 'summary']) {
        grantForm.elements[field].value = data[field] ?? '';
      }
      grantForm.elements.countries.value = (data.countries || []).join(', ');
      setChecked(grantForm, 'sectors', data.sectors);
      setChecked(grantForm, 'applicant_types', data.applicant_types);
      $('#grant-form-title').textContent = `Edit: ${data.title.slice(0, 60)}`;
      $('#add-grant').scrollIntoView({ behavior: 'smooth' });
    }
    grantForm.addEventListener('reset', () => {
      $('#grant-form-title').textContent = 'Add a grant';
      setTimeout(() => { grantForm.elements.id.value = ''; }, 0);
    });
    grantForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const f = grantForm.elements;
      if (!safeUrl(f.url.value)) return setStatus('#grant-form-status', 'The link must start with https://');
      const record = {
        title: f.title.value.trim(),
        funder_name: f.funder_name.value.trim(),
        url: f.url.value.trim(),
        open_date: f.open_date.value || null,
        deadline: f.deadline.value || null,
        deadline_note: f.deadline_note.value.trim(),
        status: f.status.value,
        amount_min_usd: f.amount_min_usd.value ? Number(f.amount_min_usd.value) : null,
        amount_max_usd: f.amount_max_usd.value ? Number(f.amount_max_usd.value) : null,
        countries: listFrom(f.countries.value).length ? listFrom(f.countries.value) : ['GLOBAL'],
        location: f.location.value.trim(),
        sectors: checked(grantForm, 'sectors'),
        applicant_types: checked(grantForm, 'applicant_types'),
        summary: f.summary.value.trim(),
        updated_at: new Date().toISOString(),
      };
      const id = f.id.value;
      const { error } = id
        ? await db.from('whsf_opportunities').update(record).eq('id', id)
        : await db.from('whsf_opportunities').insert({
          ...record, kind: 'grant', source: 'manual', source_id: crypto.randomUUID(), review_status: 'published',
        });
      if (error) return setStatus('#grant-form-status', `Not saved: ${error.message}`);
      setStatus('#grant-form-status', id ? 'Changes saved.' : 'Grant added and published.');
      grantForm.reset();
      loadCounts();
      loadReview(true);
    });

    // ------------------------------------------------------------ funders
    const funderForm = $('#funder-form');
    const slugify = (name) => name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
    async function loadFunders() {
      const { data, error } = await db.from('whsf_funders').select('*').order('name');
      const tbody = $('#funders-table');
      if (error) return setStatus('#funder-form-status', `Could not load funders: ${error.message}`);
      tbody.replaceChildren(...data.map((f) => el('tr', {}, [
        el('td', {}, [safeUrl(f.website) ? el('a', { href: f.website, target: '_blank', rel: 'noopener noreferrer', text: f.name }) : f.name]),
        el('td', { text: f.funder_type }),
        el('td', { text: f.published ? 'Yes' : 'Hidden' }),
        el('td', {}, el('div', { class: 'grant-admin-actions' }, [
          el('button', { type: 'button', text: 'Edit', onclick: () => editFunder(f) }),
          el('button', {
            type: 'button', text: f.published ? 'Hide' : 'Show',
            onclick: (e) => withButton(e.currentTarget, async () => {
              const { error: err } = await db.from('whsf_funders').update({ published: !f.published, updated_at: new Date().toISOString() }).eq('id', f.id);
              if (err) return setStatus('#funder-form-status', err.message);
              loadFunders();
            }),
          }),
        ])),
      ])));
    }
    function editFunder(f) {
      for (const field of ['id', 'name', 'funder_type', 'headquarters', 'website', 'funding_page', 'summary']) {
        funderForm.elements[field].value = f[field] ?? '';
      }
      funderForm.elements.regions.value = (f.regions || []).join(', ');
      setChecked(funderForm, 'funder_sectors', f.sectors);
      funderForm.scrollIntoView({ behavior: 'smooth' });
    }
    funderForm.addEventListener('reset', () => setTimeout(() => { funderForm.elements.id.value = ''; }, 0));
    funderForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const f = funderForm.elements;
      if (!safeUrl(f.website.value) || (f.funding_page.value && !safeUrl(f.funding_page.value))) {
        return setStatus('#funder-form-status', 'Links must start with https://');
      }
      const record = {
        name: f.name.value.trim(),
        funder_type: f.funder_type.value,
        headquarters: f.headquarters.value.trim(),
        regions: listFrom(f.regions.value).length ? listFrom(f.regions.value) : ['GLOBAL'],
        website: f.website.value.trim(),
        funding_page: f.funding_page.value.trim(),
        sectors: checked(funderForm, 'funder_sectors'),
        summary: f.summary.value.trim(),
        updated_at: new Date().toISOString(),
      };
      const id = f.id.value;
      const { error } = id
        ? await db.from('whsf_funders').update(record).eq('id', id)
        : await db.from('whsf_funders').insert({ ...record, slug: `${slugify(record.name)}-${Date.now().toString(36)}` });
      if (error) return setStatus('#funder-form-status', `Not saved: ${error.message}`);
      setStatus('#funder-form-status', id ? 'Funder updated.' : 'Funder added.');
      funderForm.reset();
      loadFunders();
      loadCounts();
    });

    // ------------------------------------------------------------ sources + sync
    async function loadSources() {
      const { data } = await db.from('whsf_opportunity_sources').select('*').order('id');
      const toggle = (source, field) => el('input', {
        type: 'checkbox', checked: source[field], 'aria-label': `${field} for ${source.name}`,
        onchange: async (e) => {
          const { error } = await db.from('whsf_opportunity_sources').update({ [field]: e.currentTarget.checked }).eq('id', source.id);
          setStatus('#sync-status', error ? `Not saved: ${error.message}` : `${source.name} updated.`);
        },
      });
      $('#sources-table').replaceChildren(...(data || []).map((s) => el('tr', {}, [
        el('td', {}, [el('strong', { text: s.name }), el('div', { class: 'grant-admin-muted', text: s.notes })]),
        el('td', {}, s.id === 'manual' ? '—' : toggle(s, 'enabled')),
        el('td', {}, toggle(s, 'auto_publish')),
        el('td', {}, [
          el('div', { text: s.last_run_at ? new Date(s.last_run_at).toLocaleString() : 'Never' }),
          el('div', { class: 'grant-admin-muted', text: s.id === 'manual' ? '' : s.last_status }),
        ]),
      ])));
      const { data: runs } = await db.from('whsf_opportunity_sync_runs').select('*').order('started_at', { ascending: false }).limit(15);
      $('#runs-table').replaceChildren(...(runs || []).map((r) => el('tr', {}, [
        el('td', { text: new Date(r.started_at).toLocaleString() }),
        el('td', { text: SOURCE_LABELS[r.source] || r.source }),
        el('td', { text: r.ok === null ? 'Running…' : `${r.ok ? 'OK' : 'Error'}: ${r.message}` }),
        el('td', { text: r.inserted }),
        el('td', { text: r.updated }),
      ])));
    }
    $('#run-sync').addEventListener('click', (event) => withButton(event.currentTarget, async () => {
      setStatus('#sync-status', 'Importing from all sources… this can take a minute.');
      const { data, error } = await db.functions.invoke('opportunity-sync', { body: { force: true } });
      if (error) return setStatus('#sync-status', `Import could not start: ${error.message}`);
      const summary = Object.entries(data || {}).map(([source, r]) => `${SOURCE_LABELS[source] || source}: ${r.skipped || (r.ok ? `${r.inserted} new, ${r.updated} updated` : `error – ${r.message}`)}`);
      setStatus('#sync-status', summary.join(' · ') || 'Done.');
      loadSources();
      loadCounts();
      loadReview(true);
    }));

    // ------------------------------------------------------------ administrators
    async function loadAdmins() {
      const { data } = await db.from('whsf_grant_admins').select('*').order('email');
      const rows = (data || []).map((a) => el('tr', {}, [
        el('td', { text: a.email }),
        el('td', { text: new Date(a.added_at).toLocaleDateString() }),
        el('td', {}, el('div', { class: 'grant-admin-actions' }, el('button', {
          type: 'button', text: 'Remove',
          onclick: (e) => withButton(e.currentTarget, async () => {
            const { error } = await db.from('whsf_grant_admins').delete().eq('email', a.email);
            setStatus('#admin-form-status', error ? error.message : `${a.email} removed.`);
            loadAdmins();
          }),
        }))),
      ]));
      $('#admins-table').replaceChildren(
        el('tr', {}, [el('td', { text: 'info@worldhsfoundation.org' }), el('td', { text: 'Always' }), el('td', { text: '—' })]),
        ...rows,
      );
    }
    $('#admin-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const email = form.elements.email.value.trim().toLowerCase();
      const { error } = await db.from('whsf_grant_admins').insert({ email });
      setStatus('#admin-form-status', error ? `Not added: ${error.message}` : `${email} can now manage grants.`);
      if (!error) form.reset();
      loadAdmins();
    });

    function loadAll() {
      loadCounts();
      loadReview(true);
      loadFunders();
      loadSources();
      loadAdmins();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
