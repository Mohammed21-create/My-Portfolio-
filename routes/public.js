const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { Project, Skill, Profile, JournalPost, ContactMessage, PortfolioSettings, UploadedFile, visibleJournal } = require('../models');
const { wrap, httpErr } = require('../utils');

router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }); // content changes appear instantly

const gate = key => wrap(async (req, res, next) => {
  const s = await PortfolioSettings.findOne().lean();
  if (s && s.sections && s.sections[key] === false) throw httpErr(404, 'This section is not available.');
  next();
});

router.get('/settings', wrap(async (req, res) => res.json((await PortfolioSettings.findOne().lean()) || {})));
router.get('/profile', wrap(async (req, res) => res.json((await Profile.findOne().lean()) || {})));

router.get('/projects', gate('projects'), wrap(async (req, res) => {
  const f = { status: 'published', deletedAt: null };
  if (req.query.featured === '1') f.featured = true;
  const limit = Math.min(parseInt(req.query.limit) || 100, 100);
  res.json(await Project.find(f).select('-description').sort({ featured: -1, publishedAt: -1 }).limit(limit).lean());
}));
router.get('/projects/:slug', gate('projects'), wrap(async (req, res) => {
  const p = await Project.findOne({ slug: req.params.slug, status: 'published', deletedAt: null }).lean();
  if (!p) throw httpErr(404, 'Project not found');
  res.json(p);
}));

router.get('/skills', gate('skills'), wrap(async (req, res) => res.json(await Skill.find().sort({ category: 1, order: 1, name: 1 }).lean())));

router.get('/journal', gate('journal'), wrap(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 100);
  res.json(await JournalPost.find(visibleJournal()).select('-content').sort({ publishAt: -1, publishedAt: -1 }).limit(limit).lean());
}));
router.get('/journal/:slug', gate('journal'), wrap(async (req, res) => {
  const p = await JournalPost.findOne({ slug: req.params.slug, ...visibleJournal() }).lean();
  if (!p) throw httpErr(404, 'Article not found');
  res.json(p);
}));

router.get('/cv', gate('cv'), wrap(async (req, res) => {
  const cv = (await UploadedFile.findOne({ purpose: 'cv', isActiveCv: true })) || (await UploadedFile.findOne({ purpose: 'cv' }).sort({ createdAt: -1 }));
  if (!cv) throw httpErr(404, 'No CV has been uploaded yet.');
  res.redirect(cv.url);
}));

const contactLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many messages. Please try again later.' } });
router.post('/contact', contactLimiter, gate('contact'), wrap(async (req, res) => {
  const b = req.body || {};
  if (b.website) return res.json({ ok: true }); // honeypot: silently drop bots
  const t = Number(b.t);
  if (!t || Date.now() - t < 3000 || Date.now() - t > 86400000) throw httpErr(400, 'Please wait a moment and try again.');
  const clean = s => String(s || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
  const name = clean(b.name).slice(0, 100), email = clean(b.email).toLowerCase().slice(0, 150);
  const subject = clean(b.subject).slice(0, 150), message = clean(b.message);
  if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || message.length < 10 || message.length > 5000) throw httpErr(400, 'Please fill in all fields correctly.');
  if ((message.match(/https?:\/\//gi) || []).length > 2) throw httpErr(400, 'Too many links in your message.');
  if (await ContactMessage.exists({ email, message, createdAt: { $gt: new Date(Date.now() - 3600000) } })) return res.json({ ok: true });
  await ContactMessage.create({ name, email, subject, message, ip: req.ip, userAgent: (req.get('user-agent') || '').slice(0, 200) });
  res.json({ ok: true });
}));

module.exports = router;
