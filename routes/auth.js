const router = require('express').Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { Admin } = require('../models');
const { requireAuth } = require('../middleware/auth');
const { wrap, httpErr } = require('../utils');

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Try again later.' } });
const strong = p => typeof p === 'string' && p.length >= 10 && p.length <= 128 && /[a-zA-Z]/.test(p) && /\d/.test(p);
const DUMMY = bcrypt.hashSync('not-a-real-password', 12);
const regen = req => new Promise((ok, no) => req.session.regenerate(e => (e ? no(e) : ok())));

router.post('/login', limiter, wrap(async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  const pw = String(req.body.password || '');
  const admin = await Admin.findOne({ email });
  if (admin && admin.lockUntil && admin.lockUntil > Date.now()) throw httpErr(429, 'Account temporarily locked. Try again in a few minutes.');
  const ok = await bcrypt.compare(pw, admin ? admin.passwordHash : DUMMY);
  if (!admin || !ok) {
    if (admin) {
      admin.loginAttempts += 1;
      if (admin.loginAttempts >= 5) { admin.lockUntil = new Date(Date.now() + 15 * 60000); admin.loginAttempts = 0; }
      await admin.save();
    }
    throw httpErr(401, 'Invalid email or password');
  }
  admin.loginAttempts = 0; admin.lockUntil = null; admin.lastLoginAt = new Date();
  await admin.save();
  await regen(req);
  req.session.adminId = admin.id;
  res.json({ ok: true });
}));

router.post('/logout', (req, res) => {
  req.session.destroy(() => { res.clearCookie('sid'); res.json({ ok: true }); });
});

router.get('/me', requireAuth, wrap(async (req, res) => {
  const a = await Admin.findById(req.session.adminId);
  if (!a) throw httpErr(401, 'Authentication required');
  res.json({ email: a.email, name: a.name, lastLoginAt: a.lastLoginAt });
}));

router.post('/change-password', requireAuth, wrap(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!strong(newPassword)) throw httpErr(400, 'New password must be 10+ characters and include letters and numbers.');
  const a = await Admin.findById(req.session.adminId);
  if (!a || !(await bcrypt.compare(String(currentPassword || ''), a.passwordHash))) throw httpErr(400, 'Current password is incorrect.');
  a.passwordHash = await bcrypt.hash(newPassword, 12);
  await a.save();
  await regen(req);
  req.session.adminId = a.id;
  res.json({ ok: true });
}));

// Password reset suited to Render: only works while ADMIN_RESET_TOKEN is set in the environment.
router.post('/reset', limiter, wrap(async (req, res) => {
  const token = process.env.ADMIN_RESET_TOKEN || '';
  if (token.length < 24) throw httpErr(404, 'Password reset is not enabled.');
  const given = Buffer.from(String(req.body.token || ''));
  const real = Buffer.from(token);
  if (given.length !== real.length || !crypto.timingSafeEqual(given, real)) throw httpErr(403, 'Invalid reset token.');
  if (!strong(req.body.newPassword)) throw httpErr(400, 'New password must be 10+ characters and include letters and numbers.');
  const a = await Admin.findOne({ email: String(req.body.email || '').toLowerCase().trim() });
  if (!a) throw httpErr(403, 'Invalid reset token.');
  a.passwordHash = await bcrypt.hash(req.body.newPassword, 12);
  a.loginAttempts = 0; a.lockUntil = null;
  await a.save();
  res.json({ ok: true });
}));

module.exports = router;
