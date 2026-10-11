// WHSF grant matching for registered organisations (grants-account.html).
// Matching and eligibility are transparent rules run in the browser against the
// organisation's own profile and the published grants; nothing is sent to an AI.
(() => {
  const PAGE_SIZE = 24;
  const ORG_TYPE_MATCH = {
    nonprofit: ['nonprofit'],
    us_nonprofit: ['us_nonprofit', 'nonprofit'],
    school: ['school'],
    university: ['university'],
    business: ['business'],
    individual: ['individual'],
    government: ['government'],
  };
  const STATUS_LABELS = {
    interested: 'Interested', preparing: 'Preparing', submitted: 'Submitted',
    awarded: 'Awarded', declined: 'Declined', not_eligible: 'Not eligible',
  };
  const SAVED_SELECT = 'id,opportunity_id,status,notes,draft,draft_updated_at,'
    + 'whsf_opportunities(id,title,url,deadline,deadline_note,source,status)';
  const VERDICTS = {
    likely: { label: 'Likely eligible', rank: 0, cls: '' },
    possible: { label: 'Check the details', rank: 1, cls: 'is-forecast' },
    unlikely: { label: 'Probably not eligible', rank: 2, cls: 'is-urgent' },
  };

  function init() {
    const G = window.WHSFGrants;
    if (!G || !window.supabase) return;
    const { el } = G;
    const db = window.supabase.createClient(G.SUPABASE_URL, G.SUPABASE_KEY);
    const $ = (selector) => document.querySelector(selector);
    const regionNames = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;
    const countryName = (code) => (code === 'GLOBAL' ? 'worldwide' : code === 'EU' ? 'the EU' : regionNames?.of(code) || code);
    const listFrom = (text) => String(text || '').split(/[,\s]+/).map((s) => s.trim().toUpperCase()).filter((s) => /^[A-Z]{2}$/.test(s));

    let session = null;
    let org = null;
    let grants = [];
    let saved = new Map(); // opportunity_id -> saved row
    let matchFilter = 'good';
    let matchPage = 0;

    // ------------------------------------------------------------ eligibility rules
    function evaluate(grant, profile) {
      const checks = [];
      const add = (state, text) => checks.push({ state, text });

      // 1. Where applicants must be based.
      const regions = grant.countries || [];
      const places = [profile.country, ...(profile.operating_countries || [])];
      if (regions.includes('GLOBAL')) add('pass', 'Open to applicants worldwide');
      else if (regions.includes(profile.country)) add('pass', `Open to organisations in ${countryName(profile.country)}`);
      else if (regions.includes('EU') && G.EU_MEMBERS.includes(profile.country)) add('pass', 'Open to organisations in EU member states');
      else if (regions.includes('EU') && profile.can_partner_eu) add('check', 'EU call: you would apply with an EU-based lead organisation or partner');
      else if (regions.some((r) => places.includes(r))) add('check', `You work in ${regions.filter((r) => places.includes(r)).map(countryName).join(', ')}; check whether a local registration is needed`);
      else add('fail', `Limited to applicants based in ${regions.map(countryName).join(', ') || 'specific countries'}`);

      // 2. Who may apply.
      const types = grant.applicant_types || [];
      const mine = ORG_TYPE_MATCH[profile.org_type] || [];
      if (!types.length) add('check', 'The listing does not say who may apply; read the eligibility section');
      else if (types.includes('any')) add('pass', 'No restriction on the type of applicant');
      else if (types.some((t) => mine.includes(t))) add('pass', `${G.APPLICANT_LABELS[profile.org_type] || 'Your organisation type'} can apply`);
      else if (types.includes('other')) add('check', 'Eligibility is described in the call text; check it applies to you');
      else add('fail', `Open to ${[...new Set(types.map((t) => G.APPLICANT_LABELS[t]).filter(Boolean))].join(', ')} only`);

      // 3. Fit with the organisation's work.
      const overlap = (grant.sectors || []).filter((s) => (profile.sectors || []).includes(s));
      if (overlap.length) add('pass', `Fits your work in ${overlap.map((s) => G.SECTOR_LABELS[s] || s).join(', ')}`);
      else add('check', 'Outside the sectors in your profile');

      // 4. Time to prepare.
      if (grant.status === 'forecasted') add('check', 'Forecasted: expected but not open for applications yet');
      else if (!grant.deadline) add('check', grant.deadline_note || 'No deadline listed; confirm on the funder page');
      else {
        const days = G.daysUntil(grant.deadline);
        if (days < 10) add('check', `Only ${Math.max(days, 0)} day${days === 1 ? '' : 's'} left to prepare`);
        else add('pass', `${days} days until the deadline`);
      }

      // 5. Registrations the funder's system requires.
      if (grant.source === 'grants_gov') {
        if (profile.has_sam_uei) add('pass', 'You have a SAM.gov UEI for US federal applications');
        else add('check', 'Needs a SAM.gov UEI and a Grants.gov account; registration can take several weeks');
      } else if (grant.source === 'eu_ft') {
        if (profile.has_eu_pic) add('pass', 'You have an EU Participant Identification Code (PIC)');
        else add('check', 'Needs an EU PIC number from the Funding & Tenders Portal');
      }

      // 6. Size of the award against the organisation's budget.
      if (profile.annual_budget_usd && grant.amount_max_usd && grant.amount_max_usd > profile.annual_budget_usd * 5) {
        add('check', 'The award is large compared with your annual budget; funders look for capacity to manage it');
      }

      const fails = checks.filter((c) => c.state === 'fail').length;
      const toCheck = checks.filter((c) => c.state === 'check').length;
      const verdict = fails ? 'unlikely' : toCheck <= 1 ? 'likely' : 'possible';
      const weight = { pass: 1, check: 0.5, fail: 0 };
      const score = Math.round((checks.reduce((sum, c) => sum + weight[c.state], 0) / checks.length) * 100)
        + Math.min(overlap.length, 3) * 3;
      return { checks, verdict, score: Math.min(score, 100) };
    }
    window.WHSFGrantMatch = { evaluate }; // lets the rules be checked against sample profiles

    // ------------------------------------------------------------ unsubscribe link from an email
    const unsubscribeToken = new URLSearchParams(window.location.search).get('unsubscribe');
    if (unsubscribeToken) {
      const banner = $('#unsubscribe-banner');
      banner.hidden = false;
      banner.textContent = 'Unsubscribing…';
      fetch(`${G.SUPABASE_URL}/functions/v1/grant-alerts?unsubscribe=${encodeURIComponent(unsubscribeToken)}`, { method: 'POST' })
        .then((res) => res.json())
        .then((result) => {
          banner.textContent = result.ok
            ? `${result.name ? `${result.name} is` : 'You are'} unsubscribed from WHSF grant emails. You can turn them back on in your profile at any time.`
            : 'This unsubscribe link did not work. Sign in and untick the email option in your profile, or reply to any WHSF email.';
        })
        .catch(() => { banner.textContent = 'Could not reach the server. Please try the link again shortly.'; });
      window.history.replaceState(null, '', window.location.pathname);
    }

    // ------------------------------------------------------------ auth
    let authMode = 'signin';
    const authForm = $('#auth-form');
    const setAuthStatus = (text) => { $('#auth-status').textContent = text; };
    document.querySelectorAll('[data-auth-tab]').forEach((button) => button.addEventListener('click', () => {
      authMode = button.dataset.authTab;
      document.querySelectorAll('[data-auth-tab]').forEach((b) => b.classList.toggle('active', b === button));
      $('[data-auth-field="password"]').hidden = authMode === 'reset';
      authForm.elements.password.autocomplete = authMode === 'signup' ? 'new-password' : 'current-password';
      $('[data-auth-submit]').textContent = { signin: 'Sign in', signup: 'Create account', reset: 'Email me a reset link' }[authMode];
      setAuthStatus(authMode === 'signup' ? 'Use at least 8 characters. We will email you a link to confirm your address.' : '');
    }));

    const pageUrl = () => window.location.href.split('#')[0].split('?')[0];
    authForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = authForm.elements.email.value.trim();
      const password = authForm.elements.password.value;
      if (authMode !== 'reset' && password.length < 8) return setAuthStatus('Passwords need at least 8 characters.');
      setAuthStatus('Please wait…');
      if (authMode === 'signin') {
        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error) setAuthStatus(/confirm/i.test(error.message) ? 'Please confirm your email first; check your inbox.' : 'Sign-in failed. Check your email and password.');
      } else if (authMode === 'signup') {
        const { data, error } = await db.auth.signUp({ email, password, options: { emailRedirectTo: pageUrl() } });
        if (error) setAuthStatus(`Could not create the account: ${error.message}`);
        else if (!data.session) setAuthStatus(`Almost done: we sent a confirmation link to ${email}. Open it, then sign in here.`);
      } else {
        const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: pageUrl() });
        setAuthStatus(error ? 'Could not send the reset link. Try again shortly.' : `If ${email} has an account, a reset link is on its way.`);
      }
    });

    $('#new-password-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const { error } = await db.auth.updateUser({ password: form.elements.password.value });
      setAuthStatus(error ? `Password not changed: ${error.message}` : 'Password updated. You are signed in.');
      if (!error) { form.hidden = true; form.reset(); }
    });
    $('#signout-button').addEventListener('click', () => db.auth.signOut());

    db.auth.onAuthStateChange((event, newSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        $('#new-password-form').hidden = false;
        authForm.hidden = true;
        setAuthStatus('Choose a new password.');
      }
      // Defer: Supabase recommends not awaiting other calls inside this callback.
      setTimeout(() => showSession(newSession), 0);
    });

    async function showSession(newSession) {
      if (newSession?.user?.id === session?.user?.id && org !== null) return;
      const wasSignedIn = Boolean(session);
      session = newSession;
      const signedIn = Boolean(session);
      authForm.hidden = signedIn || !$('#new-password-form').hidden;
      $('[data-auth-tabs]').hidden = signedIn;
      $('#signed-in-card').hidden = !signedIn;
      $('#profile').hidden = !signedIn;
      document.querySelectorAll('[data-signed-in-link]').forEach((a) => { a.hidden = !signedIn; });
      if (!signedIn) {
        org = null;
        $('#matches').hidden = true;
        $('#tracker').hidden = true;
        $('#proposal').hidden = true;
        if (wasSignedIn) setAuthStatus('Signed out.');
        return;
      }
      $('[data-signed-in-email]').textContent = `Signed in as ${session.user.email}`;
      const { data } = await db.from('whsf_grant_orgs').select('*').eq('owner_id', session.user.id).maybeSingle();
      org = data || false;
      fillProfile(org || {});
      if (org) await loadMatchesAndTracker();
      else $('#profile').scrollIntoView({ behavior: 'smooth' });
    }

    // ------------------------------------------------------------ profile
    const profileForm = $('#profile-form');
    G.fillCountrySelect(profileForm.elements.country);
    const sectorBox = profileForm.querySelector('[data-checkboxes="sectors"]');
    for (const [value, label] of Object.entries(G.SECTOR_LABELS)) {
      sectorBox.append(el('label', {}, [el('input', { type: 'checkbox', name: 'sectors', value }), ` ${label}`]));
    }
    const BOOLEAN_FIELDS = ['has_us_501c3', 'has_sam_uei', 'has_eu_pic', 'can_partner_eu', 'alerts_opt_in'];

    function fillProfile(profile) {
      const f = profileForm.elements;
      f.name.value = profile.name || '';
      f.org_type.value = profile.org_type || 'nonprofit';
      f.country.value = profile.country || '';
      f.operating_countries.value = (profile.operating_countries || []).join(', ');
      f.annual_budget_usd.value = profile.annual_budget_usd ?? '';
      f.founded_year.value = profile.founded_year ?? '';
      f.website.value = profile.website || '';
      f.description.value = profile.description || '';
      BOOLEAN_FIELDS.forEach((name) => { f[name].checked = Boolean(profile[name]); });
      profileForm.querySelectorAll('input[name="sectors"]').forEach((box) => { box.checked = (profile.sectors || []).includes(box.value); });
    }

    profileForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const f = profileForm.elements;
      const sectors = [...profileForm.querySelectorAll('input[name="sectors"]:checked')].map((b) => b.value);
      if (!sectors.length) return ($('#profile-status').textContent = 'Pick at least one area you work in.');
      const record = {
        owner_id: session.user.id,
        name: f.name.value.trim(),
        org_type: f.org_type.value,
        country: f.country.value,
        operating_countries: listFrom(f.operating_countries.value).filter((c) => c !== f.country.value),
        sectors,
        annual_budget_usd: f.annual_budget_usd.value ? Number(f.annual_budget_usd.value) : null,
        founded_year: f.founded_year.value ? Number(f.founded_year.value) : null,
        website: f.website.value.trim(),
        description: f.description.value.trim(),
        updated_at: new Date().toISOString(),
        ...Object.fromEntries(BOOLEAN_FIELDS.map((name) => [name, f[name].checked])),
      };
      $('#profile-status').textContent = 'Saving…';
      const { data, error } = await db.from('whsf_grant_orgs').upsert(record, { onConflict: 'owner_id' }).select().single();
      if (error) return ($('#profile-status').textContent = `Not saved: ${error.message}`);
      org = data;
      $('#profile-status').textContent = 'Saved. Your matches are below.';
      await loadMatchesAndTracker();
      $('#matches').scrollIntoView({ behavior: 'smooth' });
    });

    // ------------------------------------------------------------ matches
    async function loadMatchesAndTracker() {
      $('#matches').hidden = false;
      $('#tracker').hidden = false;
      $('[data-match-count]').textContent = 'Finding matches…';
      const [{ data: rows, error }, { data: savedRows }] = await Promise.all([
        db.from('whsf_opportunities')
          .select('id,source,title,funder_name,summary,url,countries,location,sectors,applicant_types,amount_min_usd,amount_max_usd,amount_note,open_date,deadline,deadline_note,status')
          .eq('kind', 'grant').eq('review_status', 'published').neq('status', 'closed')
          .or(`deadline.gte.${G.today()},deadline.is.null`)
          .limit(1000),
        db.from('whsf_grant_saved')
          .select(SAVED_SELECT)
          .eq('org_id', org.id).order('created_at', { ascending: false }),
      ]);
      if (error) return G.message($('[data-match-results]'), 'Grants could not be loaded right now. Please try again shortly.', true);
      grants = rows.map((row) => ({ row, ...evaluate(row, org) }))
        .sort((a, b) => VERDICTS[a.verdict].rank - VERDICTS[b.verdict].rank || b.score - a.score
          || String(a.row.deadline || '9999').localeCompare(String(b.row.deadline || '9999')));
      saved = new Map((savedRows || []).map((s) => [s.opportunity_id, s]));
      renderMatches(true);
      renderTracker();
    }

    const visibleMatches = () => grants.filter((g) => matchFilter === 'all'
      || (matchFilter === 'likely' ? g.verdict === 'likely' : g.verdict !== 'unlikely'));

    function matchCard(match) {
      const card = G.grantCard(match.row);
      const verdict = VERDICTS[match.verdict];
      const saveButton = el('button', {
        class: 'button button-small', type: 'button',
        text: saved.has(match.row.id) ? 'Saved to tracker' : 'Save to tracker',
        disabled: saved.has(match.row.id),
      });
      saveButton.addEventListener('click', () => saveGrant(match.row, saveButton));
      const checklist = el('ul', { class: 'grant-checklist' }, match.checks.map((c) => el('li', { class: `is-${c.state}` }, [
        el('span', { 'aria-hidden': 'true', text: c.state === 'pass' ? '✓' : c.state === 'fail' ? '✗' : '!' }),
        el('span', { class: 'sr-only', text: c.state === 'pass' ? 'Meets: ' : c.state === 'fail' ? 'Does not meet: ' : 'Check: ' }),
        c.text,
      ])));
      const details = el('details', { class: 'grant-eligibility' }, [
        el('summary', {}, [
          el('span', { class: `grant-badge ${verdict.cls}`, text: verdict.label }),
          el('span', { class: 'grant-match-score', text: `${match.score}% match` }),
        ]),
        checklist,
      ]);
      card.insertBefore(details, card.querySelector('h3').nextSibling);
      const draftButton = el('button', { class: 'button button-light button-small', type: 'button', text: 'Draft proposal' });
      draftButton.addEventListener('click', () => openProposal(match.row));
      card.append(el('div', { class: 'grant-card-actions' }, [saveButton, draftButton]));
      return card;
    }

    function renderMatches(reset) {
      const list = visibleMatches();
      const container = $('[data-match-results]');
      if (reset) { matchPage = 0; container.replaceChildren(); }
      const slice = list.slice(matchPage * PAGE_SIZE, (matchPage + 1) * PAGE_SIZE);
      slice.forEach((match) => container.append(matchCard(match)));
      matchPage += 1;
      $('[data-match-more]').hidden = matchPage * PAGE_SIZE >= list.length;
      const likely = grants.filter((g) => g.verdict === 'likely').length;
      const possible = grants.filter((g) => g.verdict === 'possible').length;
      $('[data-match-count]').textContent = `${likely} likely and ${possible} possible matches out of ${grants.length} open grants`;
      if (reset && !list.length) {
        const blockedByLocation = grants.filter((g) => g.checks[0]?.state === 'fail').length;
        G.message(container, matchFilter === 'likely'
          ? 'No "likely" matches right now. Try "Likely and possible", or add the countries and registrations you have to your profile.'
          : blockedByLocation === grants.length && grants.length
            ? `None of the ${grants.length} open grants accept applicants from ${org.country} yet: most current listings are US federal grants for US-based organisations. WHSF adds international grants regularly; use "Everything open" to browse them all.`
            : 'No open grants match your profile right now. New grants are added every day.');
      }
    }
    document.querySelectorAll('[data-match-filter]').forEach((button) => button.addEventListener('click', () => {
      matchFilter = button.dataset.matchFilter;
      document.querySelectorAll('[data-match-filter]').forEach((b) => b.classList.toggle('active', b === button));
      renderMatches(true);
    }));
    $('[data-match-more]').addEventListener('click', () => renderMatches(false));

    // ------------------------------------------------------------ proposal assistant (no AI on WHSF's side)
    const GRANT_FIELDS = 'id,source,title,funder_name,summary,url,countries,location,sectors,applicant_types,'
      + 'amount_min_usd,amount_max_usd,amount_note,open_date,deadline,deadline_note,status';
    const SOURCE_STEPS = {
      grants_gov: [
        'Register in SAM.gov for a Unique Entity ID (UEI); allow several weeks',
        'Create a Grants.gov account and an organisation workspace',
        'Download the application package and complete the required SF-424 forms',
        'Read the full Notice of Funding Opportunity (NOFO) for page limits and scoring criteria',
      ],
      eu_ft: [
        'Register your organisation on the EU Funding & Tenders Portal to get a PIC number',
        'Find an EU-based lead or partners if the call requires a consortium',
        'Use the official Part A (online forms) and Part B (technical description) templates',
        'Check the call document for eligible countries, co-financing rate and page limits',
      ],
      manual: [
        "Read the funder's guidelines and check whether they accept unsolicited proposals",
        'Contact the funder if anything about eligibility is unclear',
      ],
    };
    const ORG_NOUNS = {
      nonprofit: 'a nonprofit organisation', us_nonprofit: 'a US 501(c)(3) nonprofit', school: 'a school',
      university: 'a university', business: 'a social enterprise', individual: 'an individual applicant',
      government: 'a government body',
    };
    let proposalGrant = null;

    const money = (n) => (n ? `USD ${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : null);
    function buildDraft(grant, profile) {
      const sectors = (profile.sectors || []).map((s) => G.SECTOR_LABELS[s] || s).join(', ');
      const overlap = (grant.sectors || []).filter((s) => (profile.sectors || []).includes(s)).map((s) => G.SECTOR_LABELS[s] || s);
      const country = countryName(profile.country);
      const where = [country, ...(profile.operating_countries || []).map(countryName)].join(', ');
      const ask = money(grant.amount_max_usd) ? `[amount, up to ${money(grant.amount_max_usd)}]` : '[amount requested]';
      const lines = [
        `PROPOSAL DRAFT: ${grant.title}`,
        `Funder: ${grant.funder_name || '[funder]'}`,
        `Deadline: ${grant.deadline ? G.formatDate(grant.deadline) : (grant.deadline_note || '[check the call]')}`,
        `Official call: ${grant.url || '[link]'}`,
        '',
        '1. SUMMARY',
        `${profile.name} requests ${ask} to [one sentence: what you will do, for whom, where and by when].`,
        `The project supports ${overlap.length ? overlap.join(', ') : '[the funder\'s priority area]'} in ${where}.`,
        '',
        '2. ABOUT THE ORGANISATION',
        `${profile.name} is ${ORG_NOUNS[profile.org_type] || 'an organisation'} `
          + `based in ${country}${profile.founded_year ? `, founded in ${profile.founded_year}` : ''}.`,
        profile.description || '[What you do, who you serve and your main results so far.]',
        `Areas of work: ${sectors || '[areas]'}.`,
        profile.annual_budget_usd ? `Annual budget: ${money(profile.annual_budget_usd)}.` : 'Annual budget: [amount].',
        profile.website ? `Website: ${profile.website}` : '',
        '',
        '3. THE NEED',
        '[Describe the problem with local evidence: numbers, sources and who is affected. Link it to the funder\'s priorities.]',
        '',
        '4. PROJECT DESCRIPTION',
        '[What you will do, the approach, and why it will work. Mention partners and how participants are reached.]',
        '',
        '5. OBJECTIVES AND EXPECTED RESULTS',
        '- Objective 1: [specific, measurable, with a target and date]',
        '- Objective 2: [ ]',
        '- Objective 3: [ ]',
        '',
        '6. ACTIVITIES AND TIMELINE',
        '| Month | Activity | Responsible |',
        '| [1-2] | [ ] | [ ] |',
        '| [3-6] | [ ] | [ ] |',
        '',
        '7. BUDGET SUMMARY',
        `Total requested: ${ask}`,
        '- Staff: [ ]',
        '- Equipment and materials: [ ]',
        '- Training / events: [ ]',
        '- Monitoring and evaluation: [ ]',
        '- Other (including any allowed indirect costs): [ ]',
        '',
        '8. MONITORING AND EVALUATION',
        '[Indicators, how and when you will collect data, and how you will report to the funder.]',
        '',
        '9. SUSTAINABILITY',
        '[How the results continue after the grant: partners, other funding, local ownership.]',
        '',
        '10. CONTACT',
        `${profile.name} | [contact person, title] | ${session?.user?.email || '[email]'} | [phone]`,
      ];
      return lines.filter((line, i) => line !== '' || lines[i - 1] !== '').join('\n');
    }

    function buildPrompt(grant, profile, draft) {
      return [
        'You are helping a small organisation write a grant proposal. Improve the draft below so it is clear, specific and persuasive for this funder.',
        'Rules: do not invent facts, numbers, partners or results; keep anything you cannot know as [placeholders] and list what the organisation must fill in; follow the funder\'s priorities; use plain English.',
        '',
        `GRANT: ${grant.title}`,
        `Funder: ${grant.funder_name || 'unknown'}`,
        `Deadline: ${grant.deadline || grant.deadline_note || 'see call'}`,
        `Amount: ${money(grant.amount_max_usd) ? `up to ${money(grant.amount_max_usd)}` : (grant.amount_note || 'see call')}`,
        `Official call: ${grant.url || ''}`,
        `Summary of the call: ${G.truncate(grant.summary || 'not available; ask me to paste the call text', 1500)}`,
        '',
        `ORGANISATION: ${profile.name}, ${ORG_NOUNS[profile.org_type] || 'an organisation'} based in ${countryName(profile.country)}`,
        `Works on: ${(profile.sectors || []).map((s) => G.SECTOR_LABELS[s] || s).join(', ')}`,
        profile.description ? `About: ${profile.description}` : null,
        '',
        'MY DRAFT:',
        draft,
      ].filter((line) => line !== null).join('\n');
    }

    // Lets the template and prompt be checked with sample profiles (see evaluate above).
    Object.assign(window.WHSFGrantMatch, { buildDraft, buildPrompt });

    function renderProposalChecklist(grant) {
      const { checks } = evaluate(grant, org);
      const steps = SOURCE_STEPS[grant.source] || SOURCE_STEPS.manual;
      $('[data-proposal-checklist]').replaceChildren(
        ...checks.map((c) => el('li', { class: `is-${c.state}` }, [
          el('span', { 'aria-hidden': 'true', text: c.state === 'pass' ? '✓' : c.state === 'fail' ? '✗' : '!' }), c.text,
        ])),
        ...steps.map((s) => el('li', { class: 'is-check' }, [el('span', { 'aria-hidden': 'true', text: '☐' }), s])),
      );
    }

    async function openProposalById(opportunityId) {
      const known = grants.find((g) => g.row.id === opportunityId)?.row;
      if (known) return openProposal(known);
      const { data, error } = await db.from('whsf_opportunities').select(GRANT_FIELDS).eq('id', opportunityId).maybeSingle();
      if (error || !data) return ($('#tracker-status').textContent = 'That grant is no longer available.');
      openProposal(data);
    }

    function openProposal(grant) {
      proposalGrant = grant;
      const entry = saved.get(grant.id);
      $('#proposal').hidden = false;
      $('[data-proposal-for]').textContent = `${grant.title} · ${grant.funder_name || ''}`;
      $('#proposal-draft').value = entry?.draft || buildDraft(grant, org);
      $('#proposal-status').textContent = entry?.draft_updated_at
        ? `Your saved draft from ${new Date(entry.draft_updated_at).toLocaleString()}.`
        : 'New draft from the template. Save it to keep it with this grant in your tracker.';
      const call = $('[data-proposal-call]');
      call.href = G.safeUrl(grant.url) || 'grants.html';
      renderProposalChecklist(grant);
      $('#proposal').scrollIntoView({ behavior: 'smooth' });
    }

    async function copyText(text, statusText) {
      try {
        await navigator.clipboard.writeText(text);
        $('#proposal-status').textContent = statusText;
      } catch {
        $('#proposal-status').textContent = 'Copy was blocked by the browser. Select the text and copy it manually.';
      }
    }

    $('#proposal-save').addEventListener('click', async (event) => {
      const button = event.currentTarget;
      if (!proposalGrant) return;
      button.disabled = true;
      const draft = $('#proposal-draft').value;
      const now = new Date().toISOString();
      let entry = saved.get(proposalGrant.id);
      let error;
      if (entry) {
        ({ error } = await db.from('whsf_grant_saved').update({ draft, draft_updated_at: now, updated_at: now }).eq('id', entry.id));
        if (!error) Object.assign(entry, { draft, draft_updated_at: now });
      } else {
        const result = await db.from('whsf_grant_saved')
          .insert({ org_id: org.id, opportunity_id: proposalGrant.id, status: 'preparing', draft, draft_updated_at: now })
          .select(SAVED_SELECT).single();
        error = result.error;
        if (!error) { entry = result.data; saved.set(proposalGrant.id, entry); }
      }
      button.disabled = false;
      $('#proposal-status').textContent = error ? `Not saved: ${error.message}` : 'Draft saved with this grant in your tracker.';
      if (!error) { renderTracker(); renderMatches(true); }
    });
    $('#proposal-copy').addEventListener('click', () => copyText($('#proposal-draft').value, 'Draft copied.'));
    $('#proposal-download').addEventListener('click', () => {
      if (!proposalGrant) return;
      const blob = new Blob([$('#proposal-draft').value], { type: 'text/plain;charset=utf-8' });
      const link = el('a', {
        href: URL.createObjectURL(blob),
        download: `proposal-${proposalGrant.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}.txt`,
      });
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    });
    $('#proposal-reset').addEventListener('click', () => {
      if (!proposalGrant) return;
      $('#proposal-draft').value = buildDraft(proposalGrant, org);
      $('#proposal-status').textContent = 'Template restored. Your saved draft is unchanged until you click "Save draft".';
    });
    $('#proposal-copy-prompt').addEventListener('click', () => {
      if (!proposalGrant) return;
      copyText(buildPrompt(proposalGrant, org, $('#proposal-draft').value),
        'AI prompt copied. Open Claude or ChatGPT and paste it into a new chat.');
    });

    // ------------------------------------------------------------ tracker
    async function saveGrant(row, button) {
      button.disabled = true;
      const { data, error } = await db.from('whsf_grant_saved')
        .insert({ org_id: org.id, opportunity_id: row.id })
        .select(SAVED_SELECT).single();
      if (error) {
        button.disabled = false;
        $('#tracker-status').textContent = `Not saved: ${error.message}`;
        return;
      }
      saved.set(row.id, data);
      button.textContent = 'Saved to tracker';
      renderTracker();
    }

    async function updateSaved(entry, changes, statusText) {
      const { error } = await db.from('whsf_grant_saved')
        .update({ ...changes, updated_at: new Date().toISOString() }).eq('id', entry.id);
      $('#tracker-status').textContent = error ? `Not saved: ${error.message}` : statusText;
      if (!error) Object.assign(entry, changes);
    }

    function renderTracker() {
      const tbody = $('#tracker-table');
      const entries = [...saved.values()];
      if (!entries.length) {
        tbody.replaceChildren(el('tr', {}, el('td', { colspan: '5', text: 'Nothing saved yet. Use "Save to tracker" on any match.' })));
        return;
      }
      tbody.replaceChildren(...entries.map((entry) => {
        const opp = entry.whsf_opportunities || {};
        const url = G.safeUrl(opp.url);
        const status = el('select', { 'aria-label': 'Status' }, Object.entries(STATUS_LABELS)
          .map(([value, label]) => el('option', { value, text: label, selected: value === entry.status })));
        status.addEventListener('change', () => updateSaved(entry, { status: status.value }, 'Status updated.'));
        const notes = el('textarea', { rows: '2', maxlength: '4000', 'aria-label': 'Notes', placeholder: 'Notes' });
        notes.value = entry.notes || '';
        notes.addEventListener('change', () => updateSaved(entry, { notes: notes.value }, 'Notes saved.'));
        const remove = el('button', { type: 'button', class: 'button button-light button-small', text: 'Remove' });
        remove.addEventListener('click', async () => {
          remove.disabled = true;
          const { error } = await db.from('whsf_grant_saved').delete().eq('id', entry.id);
          if (error) { remove.disabled = false; $('#tracker-status').textContent = error.message; return; }
          saved.delete(entry.opportunity_id);
          renderTracker();
          renderMatches(true);
        });
        const deadline = opp.status === 'closed' ? 'Closed'
          : opp.deadline ? G.formatDate(opp.deadline) : (opp.deadline_note || 'Not stated');
        return el('tr', {}, [
          el('td', {}, url ? el('a', { href: url, target: '_blank', rel: 'noopener noreferrer', text: opp.title || 'Grant' }) : (opp.title || 'Grant')),
          el('td', { text: deadline }),
          el('td', {}, status),
          el('td', {}, notes),
          el('td', {}, el('div', { class: 'grant-card-actions' }, [
            (() => {
              const draft = el('button', { type: 'button', class: 'button button-small', text: entry.draft ? 'Open draft' : 'Draft proposal' });
              draft.addEventListener('click', () => openProposalById(entry.opportunity_id));
              return draft;
            })(),
            remove,
          ])),
        ]);
      }));
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
