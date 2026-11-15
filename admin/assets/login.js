document.getElementById('f').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, b = f.querySelector('button'), err = document.getElementById('err');
  b.disabled = true; err.textContent = '';
  try {
    const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: f.email.value, password: f.password.value }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Login failed');
    location.href = '/admin/dashboard';
  } catch (x) { err.textContent = x.message; b.disabled = false; }
});
