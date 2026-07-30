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
    setTimeout(() => node.remove(), 3500);
  }

  function setBusy(form, busy, label) {
    const button = form?.querySelector('button[type="submit"]');
    if (!button) return;
    if (!button.dataset.defaultLabel) button.dataset.defaultLabel = button.textContent;
    button.disabled = busy;
    button.textContent = busy ? label : button.dataset.defaultLabel;
  }

  function createGate() {
    let gate = document.querySelector('[data-auth-gate]');
    if (gate) return gate;

    gate = document.createElement('div');
    gate.dataset.authGate = '';
    Object.assign(gate.style, {
      position: 'fixed', inset: '0', zIndex: '10000', display: 'grid', placeItems: 'center',
      padding: '20px', background: 'linear-gradient(135deg,#063c2c,#0d6a49)'
    });

    gate.innerHTML = `<section class="panel" style="width:min(520px,100%);max-height:92vh;overflow:auto">
      <div class="panel-head"><div><p class="eyebrow">Secure access</p><h2>AgriSmart Connect</h2><p>Sign in or create your account to continue.</p></div></div>
      <div style="display:flex;gap:10px;margin-bottom:18px">
        <button class="primary-btn" type="button" data-auth-tab="signin">Sign in</button>
        <button class="secondary-btn" type="button" data-auth-tab="register">Create account</button>
      </div>
      <form class="form-grid" data-signin-form>
        <label class="field full"><span>Email</span><input name="email" type="email" autocomplete="email" required></label>
        <label class="field full"><span>Password</span><input name="password" type="password" autocomplete="current-password" required></label>
        <button class="primary-btn" type="submit">Sign in</button>
        <button class="secondary-btn" type="button" data-forgot-password>Forgot password?</button>
      </form>
      <form class="form-grid" data-register-form hidden>
        <label class="field"><span>Full name</span><input name="name" autocomplete="name" required></label>
        <label class="field"><span>Email</span><input name="email" type="email" autocomplete="email" required></label>
        <label class="field"><span>Phone</span><input name="phone" autocomplete="tel"></label>
        <label class="field"><span>Account type</span><select name="accountType"><option value="farmer">Farmer</option><option value="buyer">Buyer</option><option value="supplier">Supplier</option><option value="agronomist">Agronomist</option><option value="cooperative">Cooperative</option></select></label>
        <label class="field"><span>Country</span><input name="country" value="Nigeria" required></label>
        <label class="field"><span>Business or farm name</span><input name="businessName"></label>
        <label class="field"><span>Organization</span><input name="organization" value="WHSF"></label>
        <label class="field full"><span>Password</span><input name="password" type="password" minlength="8" autocomplete="new-password" required></label>
        <button class="primary-btn" type="submit">Create account</button>
      </form>
      <p class="notice" data-auth-message style="margin-top:14px">Create an account with a valid email address. Email confirmation may be required.</p>
    </section>`;

    document.body.appendChild(gate);
    const signinForm = gate.querySelector('[data-signin-form]');
    const registerForm = gate.querySelector('[data-register-form]');
    const message = gate.querySelector('[data-auth-message]');

    gate.querySelectorAll('[data-auth-tab]').forEach(button => button.addEventListener('click', () => {
      const signin = button.dataset.authTab === 'signin';
      signinForm.hidden = !signin;
      registerForm.hidden = signin;
      gate.querySelector('[data-auth-tab="signin"]').className = signin ? 'primary-btn' : 'secondary-btn';
      gate.querySelector('[data-auth-tab="register"]').className = signin ? 'secondary-btn' : 'primary-btn';
      message.textContent = signin
        ? 'Enter the email and password used when you created your account.'
        : 'Use a valid email address and a password of at least 8 characters.';
    }));

    signinForm.addEventListener('submit', async event => {
      event.preventDefault();
      setBusy(signinForm, true, 'Signing in...');
      message.textContent = 'Checking your account...';
      try {
        await auth().signIn(Object.fromEntries(new FormData(signinForm)));
        gate.remove();
        renderAccount();
        addUserBadge();
        toast('Signed in successfully.');
      } catch (error) {
        message.textContent = error.message;
      } finally {
        setBusy(signinForm, false);
      }
    });

    registerForm.addEventListener('submit', async event => {
      event.preventDefault();
      setBusy(registerForm, true, 'Creating account...');
      message.textContent = 'Creating your secure account...';
      try {
        const result = await auth().register(Object.fromEntries(new FormData(registerForm)));
        if (result?.confirmationRequired) {
          registerForm.reset();
          registerForm.hidden = true;
          signinForm.hidden = false;
          message.textContent = result.message || 'Account created. Check your email, confirm the account, then sign in.';
          toast('Account created. Check your email to confirm it.');
          return;
        }
        gate.remove();
        renderAccount();
        addUserBadge();
        toast('Account created successfully.');
      } catch (error) {
        message.textContent = error.message;
      } finally {
        setBusy(registerForm, false);
      }
    });

    gate.querySelector('[data-forgot-password]').addEventListener('click', async () => {
      const email = signinForm.querySelector('[name="email"]').value.trim();
      if (!email) {
        message.textContent = 'Enter your email address, then select Forgot password.';
        signinForm.querySelector('[name="email"]').focus();
        return;
      }
      message.textContent = 'Sending password reset instructions...';
      try {
        await auth().sendPasswordReset(email);
        message.textContent = 'Password reset instructions were sent. Check your email inbox and spam folder.';
      } catch (error) {
        message.textContent = error.message;
      }
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
    const verificationLabel = user?.verificationStatus
      ? user.verificationStatus.charAt(0).toUpperCase() + user.verificationStatus.slice(1)
      : 'Draft';
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
        <section class="panel account-verification-panel"><div class="panel-head"><div><h3>Trusted account</h3><p>Submit business or farm details for administrator review.</p></div><span class="verification-badge status-${esc(user.verificationStatus || 'draft')}">${esc(verificationLabel)}</span></div>
          ${user.verificationNote ? `<p class="notice">${esc(user.verificationNote)}</p>` : ''}
          <form class="form-grid" data-verification-form>
            <label class="field"><span>Account type</span><select name="accountType"><option value="farmer">Farmer</option><option value="buyer">Buyer</option><option value="supplier">Supplier</option><option value="agronomist">Agronomist</option><option value="cooperative">Cooperative</option></select></label>
            <label class="field"><span>Country</span><input name="country" value="${esc(user.country || '')}" required></label>
            <label class="field"><span>Business or farm name</span><input name="businessName" value="${esc(user.businessName || '')}"></label>
            <label class="field"><span>Registration number</span><input name="registrationNumber" value="${esc(user.registrationNumber || '')}"></label>
            <label class="field full"><span>Business or farm address</span><textarea name="address" rows="2">${esc(user.address || '')}</textarea></label>
            <label class="field full"><span>Evidence link (optional)</span><input name="evidenceUrl" type="url" value="${esc(user.verificationEvidenceUrl || '')}" placeholder="https://..."></label>
            <button class="primary-btn full" type="submit">${user.verificationStatus === 'pending' ? 'Update pending application' : 'Submit for verification'}</button>
          </form>
        </section>
        <section class="panel"><div class="panel-head"><h3>Account security</h3></div>
          <form class="form-grid" data-password-form>
            <label class="field full"><span>New password</span><input name="newPassword" type="password" minlength="8" required></label>
            <button class="primary-btn" type="submit">Change password</button>
          </form>
          <button class="secondary-btn" type="button" data-sign-out style="margin-top:14px">Sign out</button>
        </section>
      </div>` : '<section class="panel"><h3>Account</h3><p>You are not signed in.</p><button class="primary-btn" data-open-signin>Sign in</button></section>';

    root.prepend(wrapper);
    const accountType = wrapper.querySelector('[data-verification-form] [name="accountType"]');
    if (accountType) accountType.value = user.accountType || 'farmer';
    wrapper.querySelector('[data-profile-form]')?.addEventListener('submit', async event => {
      event.preventDefault();
      try {
        await auth().updateProfile(Object.fromEntries(new FormData(event.currentTarget)));
        toast('Profile updated.');
      } catch (error) { toast(error.message, true); }
    });
    wrapper.querySelector('[data-password-form]')?.addEventListener('submit', async event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget));
      try {
        await auth().changePassword('', data.newPassword);
        event.currentTarget.reset();
        toast('Password changed.');
      } catch (error) { toast(error.message, true); }
    });
    wrapper.querySelector('[data-verification-form]')?.addEventListener('submit', async event => {
      event.preventDefault();
      setBusy(event.currentTarget, true, 'Submitting...');
      try {
        await auth().submitVerification(Object.fromEntries(new FormData(event.currentTarget)));
        toast('Verification application submitted.');
      } catch (error) {
        toast(error.message, true);
      } finally {
        setBusy(event.currentTarget, false);
      }
    });
    wrapper.querySelector('[data-sign-out]')?.addEventListener('click', async () => {
      await auth().signOut();
      wrapper.remove();
      document.querySelector('[data-user-badge]')?.remove();
      createGate();
    });
    wrapper.querySelector('[data-open-signin]')?.addEventListener('click', createGate);
  }

  function addUserBadge() {
    const top = document.querySelector('.top-actions');
    if (!top || top.querySelector('[data-user-badge]')) return;
    const user = auth()?.getCurrentUser?.();
    if (!user) return;
    const badge = document.createElement('button');
    badge.type = 'button';
    badge.className = 'secondary-btn';
    badge.dataset.userBadge = '';
    const badgeRole = user.verificationStatus === 'verified' ? 'Verified' : user.role;
    badge.textContent = `${user.name} · ${badgeRole}`;
    badge.addEventListener('click', () => window.AgriSmartNavigation?.showView?.('settings'));
    top.prepend(badge);
  }

  async function init() {
    if (!auth()) {
      toast('Authentication could not load. Please refresh the page.', true);
      return;
    }

    if (!auth().isAuthenticated?.()) {
      try { await auth().refreshSession?.(); } catch { /* expired or invalid session */ }
    }

    if (!auth().isAuthenticated?.()) createGate();
    renderAccount();
    addUserBadge();
  }

  window.addEventListener('agrismart:authchange', () => {
    document.querySelector('[data-account-settings]')?.remove();
    document.querySelector('[data-user-badge]')?.remove();
    renderAccount();
    addUserBadge();
  });
  window.addEventListener('agrismart:extendedmodulesready', renderAccount);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true }); else init();
})();
