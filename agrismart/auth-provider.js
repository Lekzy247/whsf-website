(() => {
  'use strict';

  const USERS_KEY = 'agrismart-auth-users-v1';
  const SESSION_KEY = 'agrismart-auth-session-v1';
  const uid = () => `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const readUsers = () => { try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); } catch { return []; } };
  const writeUsers = users => localStorage.setItem(USERS_KEY, JSON.stringify(users));
  const readSession = () => { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; } };
  const emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));

  async function hash(value) {
    const bytes = new TextEncoder().encode(String(value));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function publicUser(user) {
    if (!user) return null;
    const { passwordHash, ...safe } = user;
    return safe;
  }

  async function register(input) {
    const users = readUsers();
    const name = String(input.name || '').trim();
    const email = String(input.email || '').trim().toLowerCase();
    const password = String(input.password || '');
    if (!name || !email || password.length < 8) throw new Error('Enter a name, valid email and a password of at least 8 characters.');
    if (users.some(user => user.email === email)) throw new Error('An account with this email already exists.');
    const user = {
      id: uid(), name, email, phone: String(input.phone || '').trim(),
      organization: String(input.organization || 'WHSF').trim(),
      role: users.length ? 'User' : 'Administrator',
      status: 'Active', passwordHash: await hash(password), createdAt: new Date().toISOString()
    };
    users.push(user); writeUsers(users);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id, signedInAt: new Date().toISOString() }));
    emit('agrismart:authchange', publicUser(user));
    return publicUser(user);
  }

  async function signIn(input = {}) {
    const email = String(input.email || '').trim().toLowerCase();
    const password = String(input.password || '');
    const user = readUsers().find(item => item.email === email);
    if (!user || user.passwordHash !== await hash(password)) throw new Error('Incorrect email or password.');
    if (user.status !== 'Active') throw new Error('This account is inactive.');
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id, signedInAt: new Date().toISOString() }));
    emit('agrismart:authchange', publicUser(user));
    return publicUser(user);
  }

  async function signOut() {
    localStorage.removeItem(SESSION_KEY);
    emit('agrismart:authchange', null);
    return true;
  }

  function getCurrentUser() {
    const session = readSession();
    if (!session?.userId) return null;
    return publicUser(readUsers().find(user => user.id === session.userId && user.status === 'Active'));
  }

  function isAuthenticated() { return !!getCurrentUser(); }

  function updateProfile(input) {
    const current = getCurrentUser();
    if (!current) throw new Error('Sign in to update your profile.');
    const users = readUsers();
    const user = users.find(item => item.id === current.id);
    if (!user) throw new Error('User account not found.');
    user.name = String(input.name || user.name).trim();
    user.phone = String(input.phone || '').trim();
    user.organization = String(input.organization || '').trim();
    writeUsers(users);
    emit('agrismart:authchange', publicUser(user));
    return publicUser(user);
  }

  async function changePassword(currentPassword, newPassword) {
    const current = getCurrentUser();
    if (!current) throw new Error('Sign in to change your password.');
    if (String(newPassword || '').length < 8) throw new Error('New password must be at least 8 characters.');
    const users = readUsers();
    const user = users.find(item => item.id === current.id);
    if (!user || user.passwordHash !== await hash(currentPassword)) throw new Error('Current password is incorrect.');
    user.passwordHash = await hash(newPassword); writeUsers(users);
    emit('agrismart:passwordchange', { userId: user.id });
    return true;
  }

  window.AgriSmartAuth = Object.freeze({ register, signIn, signOut, getCurrentUser, isAuthenticated, updateProfile, changePassword });
})();