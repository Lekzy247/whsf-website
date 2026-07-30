(() => {
  'use strict';

  const SUPABASE_URL = 'https://ophymlgqnfilgxsuzcuz.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_tA1TRg0XkBKKXZ5UwFbu4Q_qGIST2Xh';
  const SESSION_KEY = 'agrismart-cloud-auth-session-v2';
  const emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));
  const roleLabels = {
    farmer: 'Farmer', buyer: 'Buyer', supplier: 'Supplier', agronomist: 'Agronomist',
    cooperative: 'Cooperative', ngo: 'NGO', admin: 'Administrator', super_admin: 'Administrator'
  };

  function readSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
    catch { return null; }
  }

  function writeSession(session) {
    try {
      if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      else localStorage.removeItem(SESSION_KEY);
    } catch {
      throw new Error('Your browser is blocking local storage. Allow site data for this website and try again.');
    }
  }

  function publicUser(user, profile = null) {
    if (!user) return null;
    const metadata = user.user_metadata || {};
    const rawRole = profile?.role || metadata.role || 'farmer';
    return {
      id: user.id,
      name: profile?.full_name || metadata.full_name || metadata.name || user.email?.split('@')[0] || 'AgriSmart user',
      email: user.email || '',
      phone: profile?.phone || metadata.phone || user.phone || '',
      organization: profile?.organization || metadata.organization || 'WHSF',
      role: roleLabels[rawRole] || roleLabels[profile?.account_type] || 'User',
      rawRole,
      accountType: profile?.account_type || metadata.account_type || 'farmer',
      country: profile?.country || metadata.country || 'Nigeria',
      businessName: profile?.business_name || metadata.business_name || '',
      registrationNumber: profile?.registration_number || '',
      address: profile?.address || '',
      verificationStatus: profile?.verification_status || 'draft',
      verificationNote: profile?.verification_note || '',
      verificationEvidenceUrl: profile?.verification_evidence_url || '',
      verificationSubmittedAt: profile?.verification_submitted_at || '',
      verifiedAt: profile?.verified_at || '',
      status: profile?.status || 'active',
      createdAt: profile?.created_at || user.created_at || ''
    };
  }

  async function request(path, options = {}) {
    let response;
    try {
      response = await fetch(`${SUPABASE_URL}${path}`, {
        ...options,
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: options.token ? `Bearer ${options.token}` : `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          ...(options.headers || {})
        }
      });
    } catch {
      throw new Error('The AgriSmart cloud service could not be reached. Check your internet connection and try again.');
    }

    const text = await response.text();
    const payload = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
    if (!response.ok) {
      const message = payload?.msg || payload?.message || payload?.error_description || payload?.error || 'Cloud request failed.';
      throw new Error(message);
    }
    return payload;
  }

  function saveAuthPayload(payload) {
    if (!payload?.access_token || !payload?.user) return null;
    const previous = readSession();
    const session = {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token || previous?.refreshToken || '',
      expiresAt: Date.now() + Number(payload.expires_in || 3600) * 1000,
      user: payload.user,
      profile: previous?.user?.id === payload.user.id ? previous.profile || null : null
    };
    writeSession(session);
    emit('agrismart:authchange', publicUser(session.user, session.profile));
    return publicUser(session.user, session.profile);
  }

  async function apiRequest(path, options = {}) {
    let session = readSession();
    if (!session?.accessToken) throw new Error('Sign in to use AgriSmart cloud services.');
    if (session.expiresAt && session.expiresAt <= Date.now() && session.refreshToken) {
      await refreshSession();
      session = readSession();
    }
    return request(path, { ...options, token: session.accessToken });
  }

  async function refreshProfile() {
    const session = readSession();
    if (!session?.accessToken || !session?.user?.id) return null;
    const profiles = await apiRequest(`/rest/v1/profiles?id=eq.${encodeURIComponent(session.user.id)}&select=*`);
    session.profile = Array.isArray(profiles) ? profiles[0] || null : profiles;
    writeSession(session);
    const user = publicUser(session.user, session.profile);
    emit('agrismart:authchange', user);
    return user;
  }

  async function register(input = {}) {
    const name = String(input.name || '').trim();
    const email = String(input.email || '').trim().toLowerCase();
    const password = String(input.password || '');
    const phone = String(input.phone || '').trim();
    const organization = String(input.organization || 'WHSF').trim();
    const accountType = String(input.accountType || 'farmer').trim().toLowerCase();
    const country = String(input.country || 'Nigeria').trim();
    const businessName = String(input.businessName || '').trim();

    if (!name || !email || password.length < 8) {
      throw new Error('Enter your full name, a valid email and a password of at least 8 characters.');
    }

    const payload = await request('/auth/v1/signup', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        data: { full_name: name, phone, organization, account_type: accountType, country, business_name: businessName }
      })
    });

    const signedInUser = saveAuthPayload(payload);
    if (signedInUser) {
      const user = await refreshProfile().catch(() => signedInUser);
      return { user, confirmationRequired: false, message: 'Account created successfully. You are now signed in.' };
    }
    return {
      user: publicUser(payload.user),
      confirmationRequired: true,
      message: 'Account created. Check your email and click the confirmation link, then return here to sign in.'
    };
  }

  async function signIn(input = {}) {
    const email = String(input.email || '').trim().toLowerCase();
    const password = String(input.password || '');
    if (!email || !password) throw new Error('Enter your email and password.');
    const payload = await request('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    const user = saveAuthPayload(payload);
    if (!user) throw new Error('Sign-in did not return a valid session. Please try again.');
    return refreshProfile().catch(() => user);
  }

  async function refreshSession() {
    const session = readSession();
    if (!session?.refreshToken) return null;
    const payload = await request('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: session.refreshToken })
    });
    const user = saveAuthPayload(payload);
    return refreshProfile().catch(() => user);
  }

  async function signOut() {
    const session = readSession();
    if (session?.accessToken) await request('/auth/v1/logout', { method: 'POST', token: session.accessToken }).catch(() => null);
    writeSession(null);
    emit('agrismart:authchange', null);
    return true;
  }

  function getCurrentUser() {
    const session = readSession();
    if (!session?.user || !session?.accessToken) return null;
    if (session.expiresAt && session.expiresAt <= Date.now()) return null;
    return publicUser(session.user, session.profile);
  }

  function getSession() {
    const session = readSession();
    if (!session?.user || !session?.accessToken) return null;
    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken || '',
      expiresAt: session.expiresAt || 0,
      user: publicUser(session.user, session.profile)
    };
  }

  function isAuthenticated() { return Boolean(getCurrentUser()); }

  async function updateProfile(input = {}) {
    const session = readSession();
    if (!session?.accessToken) throw new Error('Sign in to update your profile.');
    const currentMetadata = session.user?.user_metadata || {};
    const name = String(input.name || currentMetadata.full_name || '').trim();
    const phone = String(input.phone || '').trim();
    const organization = String(input.organization || '').trim();
    const payload = await apiRequest('/auth/v1/user', {
      method: 'PUT',
      body: JSON.stringify({ data: { ...currentMetadata, full_name: name, phone, organization } })
    });
    session.user = payload;
    writeSession(session);
    await apiRequest(`/rest/v1/profiles?id=eq.${encodeURIComponent(payload.id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ full_name: name, phone, organization })
    });
    return refreshProfile();
  }

  async function submitVerification(input = {}) {
    await apiRequest('/rest/v1/rpc/submit_profile_verification', {
      method: 'POST',
      body: JSON.stringify({
        requested_account_type: String(input.accountType || 'farmer').toLowerCase(),
        requested_country: String(input.country || '').trim(),
        requested_business_name: String(input.businessName || '').trim(),
        requested_registration_number: String(input.registrationNumber || '').trim(),
        requested_address: String(input.address || '').trim(),
        requested_evidence_url: String(input.evidenceUrl || '').trim()
      })
    });
    return refreshProfile();
  }

  async function listVerificationQueue() {
    return apiRequest('/rest/v1/profiles?select=id,full_name,phone,organization,role,status,account_type,country,business_name,registration_number,address,verification_status,verification_evidence_url,verification_note,verification_submitted_at,verified_at,created_at&order=verification_submitted_at.desc.nullslast');
  }

  async function reviewVerification(profileId, decision, note = '') {
    return apiRequest('/rest/v1/rpc/review_profile_verification', {
      method: 'POST',
      body: JSON.stringify({ target_profile_id: profileId, decision, review_note: String(note).trim() })
    });
  }

  async function changePassword(_currentPassword, newPassword) {
    if (String(newPassword || '').length < 8) throw new Error('New password must be at least 8 characters.');
    await apiRequest('/auth/v1/user', { method: 'PUT', body: JSON.stringify({ password: String(newPassword) }) });
    emit('agrismart:passwordchange', { userId: readSession()?.user?.id });
    return true;
  }

  async function sendPasswordReset(email) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail) throw new Error('Enter your email address first.');
    await request('/auth/v1/recover', { method: 'POST', body: JSON.stringify({ email: cleanEmail }) });
    return true;
  }

  window.AgriSmartAuth = Object.freeze({
    register, signIn, signOut, getCurrentUser, getSession, isAuthenticated, updateProfile,
    submitVerification, listVerificationQueue, reviewVerification, changePassword,
    refreshSession, refreshProfile, sendPasswordReset, apiRequest
  });
})();
