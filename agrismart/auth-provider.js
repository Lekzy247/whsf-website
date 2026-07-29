(() => {
  'use strict';

  const SUPABASE_URL = 'https://ophymlgqnfilgxsuzcuz.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_tA1TRg0XkBKKXZ5UwFbu4Q_qGIST2Xh';
  const SESSION_KEY = 'agrismart-cloud-auth-session-v2';

  const emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));

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

  function publicUser(user) {
    if (!user) return null;
    const metadata = user.user_metadata || {};
    return {
      id: user.id,
      name: metadata.full_name || metadata.name || user.email?.split('@')[0] || 'AgriSmart user',
      email: user.email || '',
      phone: metadata.phone || user.phone || '',
      organization: metadata.organization || 'WHSF',
      role: metadata.role || 'User',
      status: 'Active',
      createdAt: user.created_at || ''
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
      throw new Error('The authentication service could not be reached. Check your internet connection and try again.');
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload.msg || payload.message || payload.error_description || payload.error || 'Authentication request failed.';
      throw new Error(message);
    }
    return payload;
  }

  function saveAuthPayload(payload) {
    if (!payload?.access_token || !payload?.user) return null;
    const session = {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token || '',
      expiresAt: Date.now() + Number(payload.expires_in || 3600) * 1000,
      user: payload.user
    };
    writeSession(session);
    emit('agrismart:authchange', publicUser(payload.user));
    return publicUser(payload.user);
  }

  async function register(input = {}) {
    const name = String(input.name || '').trim();
    const email = String(input.email || '').trim().toLowerCase();
    const password = String(input.password || '');
    const phone = String(input.phone || '').trim();
    const organization = String(input.organization || 'WHSF').trim();

    if (!name || !email || password.length < 8) {
      throw new Error('Enter your full name, a valid email and a password of at least 8 characters.');
    }

    const payload = await request('/auth/v1/signup', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        data: { full_name: name, phone, organization, role: 'User' }
      })
    });

    const signedInUser = saveAuthPayload(payload);
    if (signedInUser) return { user: signedInUser, confirmationRequired: false };

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
    return user;
  }

  async function refreshSession() {
    const session = readSession();
    if (!session?.refreshToken) return null;
    const payload = await request('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: session.refreshToken })
    });
    return saveAuthPayload(payload);
  }

  async function signOut() {
    const session = readSession();
    if (session?.accessToken) {
      await request('/auth/v1/logout', { method: 'POST', token: session.accessToken }).catch(() => null);
    }
    writeSession(null);
    emit('agrismart:authchange', null);
    return true;
  }

  function getCurrentUser() {
    const session = readSession();
    if (!session?.user || !session?.accessToken) return null;
    if (session.expiresAt && session.expiresAt <= Date.now()) return null;
    return publicUser(session.user);
  }

  function isAuthenticated() { return Boolean(getCurrentUser()); }

  async function updateProfile(input = {}) {
    const session = readSession();
    if (!session?.accessToken) throw new Error('Sign in to update your profile.');

    const current = session.user || {};
    const currentMetadata = current.user_metadata || {};
    const payload = await request('/auth/v1/user', {
      method: 'PUT',
      token: session.accessToken,
      body: JSON.stringify({
        data: {
          ...currentMetadata,
          full_name: String(input.name || currentMetadata.full_name || '').trim(),
          phone: String(input.phone || '').trim(),
          organization: String(input.organization || '').trim()
        }
      })
    });

    session.user = payload;
    writeSession(session);
    emit('agrismart:authchange', publicUser(payload));
    return publicUser(payload);
  }

  async function changePassword(_currentPassword, newPassword) {
    const session = readSession();
    if (!session?.accessToken) throw new Error('Sign in to change your password.');
    if (String(newPassword || '').length < 8) throw new Error('New password must be at least 8 characters.');

    await request('/auth/v1/user', {
      method: 'PUT',
      token: session.accessToken,
      body: JSON.stringify({ password: String(newPassword) })
    });
    emit('agrismart:passwordchange', { userId: session.user?.id });
    return true;
  }

  async function sendPasswordReset(email) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail) throw new Error('Enter your email address first.');
    await request('/auth/v1/recover', {
      method: 'POST',
      body: JSON.stringify({ email: cleanEmail })
    });
    return true;
  }

  window.AgriSmartAuth = Object.freeze({
    register,
    signIn,
    signOut,
    getCurrentUser,
    isAuthenticated,
    updateProfile,
    changePassword,
    refreshSession,
    sendPasswordReset
  });
})();