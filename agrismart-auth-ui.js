(() => {
  'use strict';

  const auth = () => window.AgriSmartAuth;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function toast(message, error = false) {
    document.querySelector('.toast')?.remove();
    const node = document.createElement('div');
    node.className = 'toast';
    node.textContent = message;
    node.style.background = error ? '#9f2f2f' : '';
    document.body.appendChild(node);
    setTimeout(() => node.remove(), 3000);
  }

  function createGate() {
    let gate = document.querySelector('[data-auth-gate]');
    if (gate) return gate;
    gate = document.createElement('div');
    gate.dataset.authGate = '';
    Object.assign(gate.style, { position:'fixed', inset:'0', zIndex:'10000', display:'grid', placeItems:'center', padding:'20px', background:'linear-gradient(135deg,#063c2c,#0d6a49)' });
    gate.innerHTML = `<section class="panel" style="width:min(520px,100%);max-height:92vh;overflow:auto">
      <div class="panel-head"><div><p class="eyebrow">Secure access</p><h2>AgriSmart Connect</h2><p>Sign in or create your account to continue.</p></div></div>
      <div style="display:flex;gap:10px;margin-bottom:18px"><button class="primary-btn" type="button" data-auth-tab="signin">Sign in</button><button class="secondary-btn" type="button" data-auth-tab="register">Create account</button></div>
      <form class="form-grid" data-signin-form>
        <label class="field full"><span>Email</span><input name="email" type="email" autocomplete="email" required></label>
        <label class="field full"><span>Password</span><input name="password" type="password" autocomplete="current-password" required></label>
        <button class="primary-btn" type="submit">Sign in</button>
      </form>
      <form class="form-grid" data-register-form hidden>
        <label class="field"><span>Full name</span><input name="name" autocomplete="name" required></label>
        <label class="field"><span>Email</span><input name="email" type="email" autocomplete="email" required></label>
        <label class="field"><span>Phone</span><input name="phone" autocomplete="tel"></label>
        <label class="field"><span>Organization</span><input name="organization" value="WHSF"></label>
        <label class="field full"><span>Password</span><input name="password" type="password" minlength="8" autocomplete="new-password" required></label>
        <button class="primary-btn" type="submit">Create account</button>
      </form>
      <p class="notice" data-auth-message style="margin-top:14px">Your account is stored on this device for the current MVP.</p>
    </section>`;
    document.body.appendChild(gate);
    gate.querySelectorAll('[data-auth-tab]').forEach(button => button.addEventListener('click', () => {
      const signin = button.dataset.authTab === 'signin';
      gate.querySelector('[data-signin-form]').hidden = !signin;
      gate.querySelector('[data-register-form]').hidden = signin;
    }));
    gate.querySelector('[data-signin-form]').addEventListener('submit', async event => {
      event.preventDefault();
      try { await auth().signIn(Object.fromEntries(new FormData(event.currentTarget))); gate.remove(); renderAccount(); toast('Signed in successfully.'); }
      catch (error) { gate.querySelector('[data-auth-message]').textContent = error.message; }
    });
    gate.querySelector('[data-register-form]').addEventListener('submit', async event => {
      event.preventDefault();
      try { await auth().register(Object.fromEntries(new FormData(event.currentTarget))); gate.remove(); renderAccount(); toast('Account created successfully.'); }
      catch (error) { gate.querySelector('[data-auth-message]').textContent = error.message; }
    });
    return gate;
  }

  function renderAccount() {
    const root = document.querySelector('[data-settings-panel]');
    if (!root || root.querySelector('[data-account-settings]')) return;
    const user = auth()?.getCurrentUser?.();
    const wrapper = document.createElement('div');
    wrapper.dataset.accountSettings = '';
    wrapper.style.marginBottom = '18px';
    wrapper.innerHTML = user ? `
      <div class="dashboard-grid">
        <section class="panel"><div class="panel-head"><div><h3>User profile</h3><p>Manage your account details.</p></div><span class="chip">${esc(user.role)}</span></div>
          <form class="form-grid" data-profile-form>
            <label class="field"><span>Full name</span><input name="name" value="${esc(user.name)}" required></label>
            <label class="field"><span>Email</span><input value="${esc(user.email)}" disabled></label>
            <label class="field"><span>Phone</span><input name="phone" value="${esc(user.phone || '')}"></label>
            <label class="field"><span>Organization</span><input name="organization" value="${esc(user.organization || '')}"></label>
            <button class="primary-btn" type="submit">Save profile</button>
          </form>
        </section>
        <section class="panel"><div class="panel-head"><h3>Account security</h3></div>
          <form class="form-grid" data-password-form>
            <label class="field full"><span>Current password</span><input name="currentPassword" type="password" required></label>
            <label class="field full"><span>New password</span><input name="newPassword" type="password" minlength="8" required></label>
            <button class="primary-btn" type="submit">Change password</button>
          </form>
          <button class="secondary-btn" type="button" data-sign-out style="margin-top:14px">Sign out</button>
        </section>
      </div>` : '<section class="panel"><h3>Account</h3><p>You are not signed in.</p><button class="primary-btn" data-open-signin>Sign in</button></section>';
    root.prepend(wrapper);
    wrapper.querySelector('[data-profile-form]')?.addEventListener('submit', event => {
      event.preventDefault();
      try { auth().updateProfile(Object.fromEntries(new FormData(event.currentTarget))); toast('Profile updated.'); }
      catch (error) { toast(error.message, true); }
    });
    wrapper.querySelector('[data-password-form]')?.addEventListener('submit', async event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget));
      try { await auth().changePassword(data.currentPassword, data.newPassword); event.currentTarget.reset(); toast('Password changed.'); }
      catch (error) { toast(error.message, true); }
    });
    wrapper.querySelector('[data-sign-out]')?.addEventListener('click', async () => { await auth().signOut(); createGate(); wrapper.remove(); });
    wrapper.querySelector('[data-open-signin]')?.addEventListener('click', createGate);
  }

  function addUserBadge() {
    const top = document.querySelector('.top-actions');
    if (!top || top.querySelector('[data-user-badge]')) return;
    const user = auth()?.getCurrentUser?.();
    if (!user) return;
    const badge = document.createElement('button');
    badge.type = 'button'; badge.className = 'secondary-btn'; badge.dataset.userBadge = '';
    badge.textContent = `${user.name} · ${user.role}`;
    badge.addEventListener('click', () => window.AgriSmartNavigation?.showView?.('settings'));
    top.prepend(badge);
  }

  function init() {
    if (!auth()?.isAuthenticated?.()) createGate();
    renderAccount();
    addUserBadge();
  }

  window.addEventListener('agrismart:authchange', () => { document.querySelector('[data-account-settings]')?.remove(); document.querySelector('[data-user-badge]')?.remove(); renderAccount(); addUserBadge(); });
  window.addEventListener('agrismart:extendedmodulesready', renderAccount);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true }); else init();
})();