// WHSF Grant & Funding Opportunities Portal (grants.html) and the live UN events
// list on opportunities.html. Reads published rows from Supabase through RLS.
(() => {
  const SUPABASE_URL = 'https://ophymlgqnfilgxsuzcuz.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_tA1TRg0XkBKKXZ5UwFbu4Q_qGIST2Xh';
  const PAGE_SIZE = 24;

  const SOURCE_LABELS = {
    manual: 'WHSF verified',
    grants_gov: 'Grants.gov',
    eu_ft: 'EU Funding & Tenders',
    indico_un: 'Indico.UN',
  };
  const SECTOR_LABELS = {
    ict: 'ICT', stem: 'STEM', ai: 'AI', education: 'Education', womens_empowerment: 'Women & girls',
    youth: 'Youth', health: 'Health', agriculture: 'Agriculture', climate: 'Climate',
    humanitarian: 'Humanitarian', economic_development: 'Livelihoods',
  };
  const APPLICANT_LABELS = {
    nonprofit: 'Nonprofits', us_nonprofit: 'US 501(c)(3)', school: 'Schools', university: 'Universities',
    government: 'Government', individual: 'Individuals', business: 'Businesses', any: 'Unrestricted',
    other: 'See eligibility',
  };
  const FUNDER_TYPE_LABELS = {
    government: 'Government', multilateral: 'Multilateral', foundation: 'Foundation',
    corporate: 'Corporate', platform: 'Platform', other: 'Funder',
  };
  // Which applicant types a search for X should include ('any' = unrestricted calls).
  const APPLICANT_MATCH = {
    nonprofit: ['nonprofit', 'us_nonprofit', 'any', 'other'],
    us_nonprofit: ['us_nonprofit', 'nonprofit', 'any', 'other'],
    school: ['school', 'any', 'other'],
    university: ['university', 'any', 'other'],
    business: ['business', 'any', 'other'],
    individual: ['individual', 'any', 'other'],
  };
  const EU_MEMBERS = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT',
    'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
  const COUNTRY_CODES = ('AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI CV KH CM CA '
    + 'CF TD CL CN CO KM CG CD CR CI HR CU CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT '
    + 'GN GW GY HT HN HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI KW KG LA LV LB LS LR LY LI LT LU MG MW MY MV ML MT '
    + 'MH MR MU MX FM MD MC MN ME MA MZ MM NA NR NP NL NZ NI NE NG KP MK NO OM PK PW PS PA PG PY PE PH PL PT QA KR RO '
    + 'RU RW KN LC VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA SS ES LK SD SR SE CH SY TJ TZ TH TL TG TO TT TN TR TM '
    + 'TV UG UA AE GB US UY UZ VU VA VE VN YE ZM ZW').split(' ');

  const today = () => new Date().toISOString().slice(0, 10);
  const addDays = (days) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
  const daysUntil = (date) => Math.ceil((Date.parse(`${date}T23:59:59Z`) - Date.now()) / 864e5);

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (value === undefined || value === null || value === false) continue;
      if (key === 'text') node.textContent = value;
      else if (key === 'class') node.className = value;
      else node.setAttribute(key, value);
    }
    for (const child of [].concat(children)) if (child) node.append(child);
    return node;
  }
  const safeUrl = (url) => (/^https:\/\//i.test(url || '') ? url : null);
  const formatDate = (date) => new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
  const usd = (n) => `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  function amountText(row) {
    if (row.amount_min_usd && row.amount_max_usd && row.amount_min_usd !== row.amount_max_usd) {
      return `${usd(row.amount_min_usd)} – ${usd(row.amount_max_usd)}`;
    }
    if (row.amount_max_usd) return `Up to ${usd(row.amount_max_usd)}`;
    return row.amount_note || 'See funder';
  }
  function truncate(text, length) {
    if (!text || text.length <= length) return text || '';
    return `${text.slice(0, length).replace(/\s+\S*$/, '')}…`;
  }

  function deadlineBadge(row) {
    if (row.status === 'forecasted') return el('span', { class: 'grant-badge is-forecast', text: 'Forecasted' });
    if (!row.deadline) return el('span', { class: 'grant-badge', text: 'Rolling / see call' });
    const days = daysUntil(row.deadline);
    if (days <= 0) return el('span', { class: 'grant-badge is-urgent', text: 'Closes today' });
    if (days <= 14) return el('span', { class: 'grant-badge is-urgent', text: `${days} day${days === 1 ? '' : 's'} left` });
    return el('span', { class: 'grant-badge', text: `${days} days left` });
  }

  function grantCard(row) {
    const url = safeUrl(row.url);
    const applicants = (row.applicant_types || []).map((a) => APPLICANT_LABELS[a]).filter(Boolean);
    const where = row.countries?.includes('GLOBAL') ? 'Worldwide'
      : row.countries?.includes('EU') ? 'EU-based applicants / partners'
        : row.countries?.includes('US') ? 'US-based applicants' : row.location || (row.countries || []).join(', ');
    const facts = [
      ['Funder', row.funder_name || '—'],
      ['Deadline', row.deadline ? formatDate(row.deadline) : (row.deadline_note || 'Not stated')],
      ['Amount', amountText(row)],
      ['Who', applicants.length ? [...new Set(applicants)].join(', ') : 'See eligibility'],
      ['Where', where],
    ];
    return el('article', { class: 'opportunity-card grant-card' }, [
      el('div', { class: 'opportunity-card-top' }, [el('span', { text: SOURCE_LABELS[row.source] || row.source }), deadlineBadge(row)]),
      el('h3', { text: row.title }),
      el('dl', {}, facts.map(([k, v]) => el('div', {}, [el('dt', { text: k }), el('dd', { text: v })]))),
      row.summary ? el('p', { text: truncate(row.summary, 220) }) : null,
      el('div', { class: 'opportunity-tags' }, (row.sectors || []).slice(0, 4).map((s) => el('span', { text: SECTOR_LABELS[s] || s }))),
      url ? el('a', { class: 'arrow-link', href: url, target: '_blank', rel: 'noopener noreferrer' }, ['View official call ', el('span', { text: '→' })]) : null,
    ]);
  }

  function eventCard(row) {
    const url = safeUrl(row.url);
    const sameDay = !row.deadline || row.deadline === row.open_date;
    const when = row.open_date ? (sameDay ? formatDate(row.open_date) : `${formatDate(row.open_date)} – ${formatDate(row.deadline)}`) : 'Date to be confirmed';
    return el('article', { class: 'opportunity-card grant-card' }, [
      el('div', { class: 'opportunity-card-top' }, [el('span', { text: 'UN event' }), el('strong', { text: 'Indico.UN' })]),
      el('h3', { text: row.title }),
      el('dl', {}, [
        el('div', {}, [el('dt', { text: 'Date' }), el('dd', { text: when })]),
        el('div', {}, [el('dt', { text: 'Location' }), el('dd', { text: row.location || 'See event page' })]),
        el('div', {}, [el('dt', { text: 'Organiser' }), el('dd', { text: row.funder_name || 'United Nations' })]),
      ]),
      el('div', { class: 'opportunity-tags' }, (row.sectors || []).slice(0, 4).map((s) => el('span', { text: SECTOR_LABELS[s] || s }))),
      url ? el('a', { class: 'arrow-link', href: url, target: '_blank', rel: 'noopener noreferrer' }, ['Open event ', el('span', { text: '→' })]) : null,
    ]);
  }

  function funderCard(row) {
    const url = safeUrl(row.funding_page) || safeUrl(row.website);
    return el('article', { class: 'funder-card' }, [
      el('small', { text: `${FUNDER_TYPE_LABELS[row.funder_type] || 'Funder'}${row.headquarters ? ` · ${row.headquarters}` : ''}` }),
      el('h3', { text: row.name }),
      el('p', { text: row.summary }),
      el('div', { class: 'opportunity-tags' }, (row.sectors || []).slice(0, 4).map((s) => el('span', { text: SECTOR_LABELS[s] || s }))),
      url ? el('a', { class: 'arrow-link', href: url, target: '_blank', rel: 'noopener noreferrer' }, ['Funding information ', el('span', { text: '→' })]) : null,
    ]);
  }

  function message(container, text, isError) {
    container.replaceChildren(el('p', { class: isError ? 'grant-error' : 'grant-empty', text }));
  }

  function fillCountrySelect(select) {
    const names = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;
    COUNTRY_CODES.map((code) => [code, names?.of(code) || code])
      .sort((a, b) => a[1].localeCompare(b[1]))
      .forEach(([code, name]) => select.append(el('option', { value: code, text: name })));
  }

  // Shared with grants-account.js (organisation matching and tracker).
  window.WHSFGrants = {
    SUPABASE_URL, SUPABASE_KEY, SOURCE_LABELS, SECTOR_LABELS, APPLICANT_LABELS, EU_MEMBERS,
    today, addDays, daysUntil, el, safeUrl, formatDate, amountText, truncate, deadlineBadge,
    grantCard, message, fillCountrySelect,
  };

  function init() {
    if (!window.supabase) return;
    const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    initGrantSearch(db);
    initFunders(db);
    initSources(db);
    initStats(db);
    initLiveEvents(db);
  }

  // ---------------------------------------------------------------- grant search
  function initGrantSearch(db) {
    const form = document.querySelector('[data-grant-search]');
    const results = document.querySelector('[data-grant-results]');
    if (!form || !results) return;
    const countEl = document.querySelector('[data-grant-count]');
    const moreButton = document.querySelector('[data-grant-more]');
    const countrySelect = form.querySelector('[data-country-select]');

    fillCountrySelect(countrySelect);

    const params = new URLSearchParams(window.location.search);
    for (const field of ['q', 'country', 'sector', 'applicant', 'within', 'source']) {
      if (params.get(field) && form.elements[field]) form.elements[field].value = params.get(field);
    }

    let page = 0;
    let requestId = 0;

    function buildQuery(filters) {
      let query = db.from('whsf_opportunities')
        .select('id,source,title,funder_name,summary,url,countries,location,sectors,applicant_types,amount_min_usd,amount_max_usd,amount_note,open_date,deadline,deadline_note,status', { count: 'exact' })
        .eq('kind', 'grant')
        .neq('status', 'closed');
      if (filters.within) {
        query = query.gte('deadline', today()).lte('deadline', addDays(Number(filters.within)));
      } else {
        query = query.or(`deadline.gte.${today()},deadline.is.null`);
      }
      if (filters.q) query = query.textSearch('search', filters.q, { type: 'websearch', config: 'english' });
      if (filters.country) {
        const regions = [filters.country, 'GLOBAL'];
        if (EU_MEMBERS.includes(filters.country)) regions.push('EU');
        query = query.overlaps('countries', regions);
      }
      if (filters.sector) query = query.contains('sectors', [filters.sector]);
      if (filters.applicant && APPLICANT_MATCH[filters.applicant]) {
        query = query.or(`applicant_types.ov.{${APPLICANT_MATCH[filters.applicant].join(',')}},applicant_types.eq.{}`);
      }
      if (filters.source) query = query.eq('source', filters.source);
      return query.order('deadline', { ascending: true, nullsFirst: false }).order('title');
    }

    async function load(reset) {
      const filters = Object.fromEntries(new FormData(form));
      const id = ++requestId;
      if (reset) {
        page = 0;
        countEl.textContent = 'Searching…';
      }
      moreButton.disabled = true;
      const from = page * PAGE_SIZE;
      const { data, error, count } = await buildQuery(filters).range(from, from + PAGE_SIZE - 1);
      if (id !== requestId) return;
      moreButton.disabled = false;
      if (error) {
        countEl.textContent = '';
        message(results, 'Opportunities could not be loaded right now. Please try again shortly.', true);
        moreButton.hidden = true;
        return;
      }
      if (reset) results.replaceChildren();
      data.forEach((row) => results.append(grantCard(row)));
      if (reset && !data.length) {
        message(results, 'No open opportunities match these filters. Try removing a filter or a keyword.');
      }
      countEl.textContent = `${count ?? 0} open ${count === 1 ? 'opportunity' : 'opportunities'}`;
      page += 1;
      moreButton.hidden = page * PAGE_SIZE >= (count ?? 0);

      const shareable = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
      const nextUrl = `${window.location.pathname}${shareable.toString() ? `?${shareable}` : ''}${window.location.hash}`;
      window.history.replaceState(null, '', nextUrl);
    }

    form.addEventListener('submit', (event) => { event.preventDefault(); load(true); });
    form.addEventListener('change', () => load(true));
    form.addEventListener('reset', () => setTimeout(() => load(true), 0));
    moreButton.addEventListener('click', () => load(false));
    load(true);
  }

  // ---------------------------------------------------------------- funders
  function initFunders(db) {
    const container = document.querySelector('[data-funder-results]');
    if (!container) return;
    const buttons = document.querySelectorAll('[data-funder-type]');
    let funders = [];

    function render(type) {
      const rows = type ? funders.filter((f) => f.funder_type === type) : funders;
      if (!rows.length) return message(container, 'No funders of this type are listed yet.');
      container.replaceChildren(...rows.map(funderCard));
    }
    buttons.forEach((button) => button.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.toggle('active', b === button));
      render(button.dataset.funderType);
    }));

    db.from('whsf_funders').select('name,funder_type,headquarters,sectors,website,funding_page,summary')
      .order('name').then(({ data, error }) => {
        if (error) return message(container, 'The funder directory could not be loaded right now.', true);
        funders = data;
        render('');
      });
  }

  // ---------------------------------------------------------------- sources
  function initSources(db) {
    const container = document.querySelector('[data-grant-sources]');
    if (!container) return;
    db.from('whsf_opportunity_sources').select('id,name,homepage,notes,last_run_at,enabled')
      .eq('enabled', true).order('id').then(({ data, error }) => {
        if (error || !data) return;
        container.replaceChildren(...data.map((source) => el('a', {
          href: safeUrl(source.homepage) || '#', target: '_blank', rel: 'noopener noreferrer',
        }, [
          el('strong', { text: source.name }),
          el('span', { text: source.notes }),
          el('span', {
            class: 'source-status',
            text: source.id === 'manual' ? 'Updated by WHSF staff'
              : source.last_run_at ? `Last checked ${new Date(source.last_run_at).toLocaleString()}` : 'Connecting…',
          }),
        ])));
      });
  }

  // ---------------------------------------------------------------- stats
  function initStats(db) {
    const stat = (name) => document.querySelector(`[data-grant-stat="${name}"]`);
    if (!stat('open')) return;
    const base = () => db.from('whsf_opportunities').select('id', { count: 'exact', head: true })
      .eq('kind', 'grant').neq('status', 'closed');
    base().or(`deadline.gte.${today()},deadline.is.null`).then(({ count }) => { stat('open').textContent = count ?? '–'; });
    base().gte('deadline', today()).lte('deadline', addDays(30)).then(({ count }) => { stat('soon').textContent = count ?? '–'; });
    db.from('whsf_funders').select('id', { count: 'exact', head: true })
      .then(({ count }) => { stat('funders').textContent = count ?? '–'; });
  }

  // ---------------------------------------------------------------- UN events (opportunities.html)
  function initLiveEvents(db) {
    const section = document.querySelector('[data-live-events]');
    if (!section) return;
    const grid = section.querySelector('[data-live-events-grid]');
    db.from('whsf_opportunities')
      .select('title,funder_name,url,location,sectors,open_date,deadline')
      .eq('kind', 'event').gte('deadline', today())
      .order('open_date', { ascending: true }).limit(12)
      .then(({ data, error }) => {
        if (error || !data?.length) return; // section stays hidden until events are approved
        grid.replaceChildren(...data.map(eventCard));
        section.hidden = false;
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
