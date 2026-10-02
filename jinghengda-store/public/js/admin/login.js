(function () {
  'use strict';
  const { api, escapeHtml } = window.Admin;
  const form = document.getElementById('login-form');
  const errorBox = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.innerHTML = '';
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    try {
      await api('/login', {
        method: 'POST',
        allow401: true,
        body: { email: form.elements.email.value, password: form.elements.password.value },
      });
      location.href = '/admin/dashboard.html';
    } catch (err) {
      errorBox.innerHTML = `<div class="notice notice-error" role="alert">${escapeHtml(err.message)}</div>`;
      btn.disabled = false;
      btn.textContent = 'Sign in';
      form.elements.password.value = '';
      form.elements.password.focus();
    }
  });

  // Already signed in? Go straight to the dashboard.
  api('/me', { allow401: true }).then(() => { location.href = '/admin/dashboard.html'; }).catch(() => {});
})();
