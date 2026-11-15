const router = require('express').Router();
const { Project, Skill, Profile, JournalPost, ContactMessage, PortfolioSettings, UploadedFile } = require('../models');
const { requireAuth } = require('../middleware/auth');
const { upload, storeFile, removeFile } = require('../middleware/upload');
const { wrap, pick, httpErr, escapeRx, uniqueSlug } = require('../utils');

router.use(requireAuth);
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

/* ---------- generic CRUD factory (admin only) ---------- */
function crud(path, Model, { fields, search = [], slugFrom, soft = false, filters = [], sort = { createdAt: -1 } }) {
  router.get(path, wrap(async (req, res) => {
    const f = {};
    if (soft) f.deletedAt = req.query.trash === '1' ? { $ne: null } : null;
    for (const k of filters) if (req.query[k]) f[k] = String(req.query[k]);
    if (req.query.q && search.length) { const rx = new RegExp(escapeRx(req.query.q), 'i'); f.$or = search.map(k => ({ [k]: rx })); }
    res.json(await Model.find(f).sort(sort).limit(500));
  }));
  router.get(path + '/:id', wrap(async (req, res) => {
    const d = await Model.findById(req.params.id);
    if (!d) throw httpErr(404, 'Not found');
    res.json(d);
  }));
  router.post(path, wrap(async (req, res) => {
    const data = pick(req.body, fields);
    if (slugFrom) data.slug = await uniqueSlug(Model, data.slug || data[slugFrom]);
    res.status(201).json(await Model.create(data));
  }));
  router.put(path + '/:id', wrap(async (req, res) => {
    const d = await Model.findById(req.params.id);
    if (!d) throw httpErr(404, 'Not found');
    const data = pick(req.body, fields);
    if (slugFrom && data.slug !== undefined && data.slug !== d.slug) data.slug = await uniqueSlug(Model, data.slug || d[slugFrom] || d.name, d._id);
    else delete data.slug;
    d.set(data);
    await d.save();
    res.json(d);
  }));
  router.delete(path + '/:id', wrap(async (req, res) => {
    const d = await Model.findById(req.params.id);
    if (!d) throw httpErr(404, 'Not found');
    if (soft && req.query.permanent !== '1') { d.deletedAt = new Date(); d.status = 'draft'; d.featured = false; await d.save(); }
    else await d.deleteOne();
    res.json({ ok: true });
  }));
  if (soft) router.post(path + '/:id/restore', wrap(async (req, res) => {
    const d = await Model.findByIdAndUpdate(req.params.id, { deletedAt: null }, { new: true });
    if (!d) throw httpErr(404, 'Not found');
    res.json(d);
  }));
}

crud('/projects', Project, {
  fields: ['name', 'slug', 'shortDescription', 'description', 'category', 'technologies', 'mainImage', 'images', 'features', 'developmentStatus', 'githubUrl', 'liveUrl', 'startDate', 'completionDate', 'featured', 'status'],
  search: ['name', 'category', 'technologies'], slugFrom: 'name', soft: true, filters: ['status']
});
crud('/skills', Skill, { fields: ['name', 'category', 'learningStatus', 'icon', 'iconText', 'order'], search: ['name'], filters: ['category'], sort: { category: 1, order: 1, name: 1 } });
crud('/journal', JournalPost, {
  fields: ['title', 'slug', 'excerpt', 'content', 'coverImage', 'category', 'tags', 'status', 'publishAt'],
  search: ['title', 'category', 'tags'], slugFrom: 'title', filters: ['status']
});

/* ---------- dashboard ---------- */
router.get('/stats', wrap(async (req, res) => {
  const live = { deletedAt: null };
  const [publishedProjects, draftProjects, publishedPosts, draftPosts, messages, unread, recentProjects, recentMessages, settings, cv] = await Promise.all([
    Project.countDocuments({ ...live, status: 'published' }),
    Project.countDocuments({ ...live, status: 'draft' }),
    JournalPost.countDocuments({ status: 'published' }),
    JournalPost.countDocuments({ status: { $ne: 'published' } }),
    ContactMessage.countDocuments(),
    ContactMessage.countDocuments({ isRead: false, archived: false }),
    Project.find(live).sort({ createdAt: -1 }).limit(5).select('name status mainImage createdAt'),
    ContactMessage.find({ archived: false }).sort({ createdAt: -1 }).limit(5).select('name subject isRead createdAt'),
    PortfolioSettings.findOne().lean(),
    UploadedFile.exists({ purpose: 'cv' })
  ]);
  res.json({ publishedProjects, draftProjects, publishedPosts, draftPosts, messages, unread, recentProjects, recentMessages, sections: (settings && settings.sections) || {}, activeCv: !!cv });
}));

/* ---------- singletons ---------- */
const profileFields = ['fullName', 'title', 'bio', 'location', 'intro', 'careerGoals', 'strengths', 'education', 'nssExperience', 'photo', 'linkedin', 'github', 'twitter', 'youtube', 'whatsapp', 'email', 'phone'];
const settingsFields = ['portfolioName', 'logo', 'favicon', 'description', 'seoTitle', 'seoDescription', 'contactEmail', 'phone', 'githubUrl', 'linkedinUrl', 'whatsapp', 'theme', 'accentColor', 'footerText', 'availability', 'availabilityNote', 'sections'];
const singleton = (path, Model, fields) => {
  router.get(path, wrap(async (req, res) => res.json((await Model.findOne()) || (await Model.create({})))));
  router.put(path, wrap(async (req, res) => {
    const d = (await Model.findOne()) || new Model();
    d.set(pick(req.body, fields));
    await d.save();
    res.json(d);
  }));
};
singleton('/profile', Profile, profileFields);
singleton('/settings', PortfolioSettings, settingsFields);

/* ---------- messages ---------- */
router.get('/messages', wrap(async (req, res) => {
  const f = {};
  if (req.query.box === 'archived') f.archived = true;
  else { f.archived = false; if (req.query.box === 'unread') f.isRead = false; }
  if (req.query.q) { const rx = new RegExp(escapeRx(req.query.q), 'i'); f.$or = [{ name: rx }, { email: rx }, { subject: rx }, { message: rx }]; }
  res.json(await ContactMessage.find(f).sort({ createdAt: -1 }).limit(300));
}));
router.put('/messages/:id', wrap(async (req, res) => {
  const m = await ContactMessage.findByIdAndUpdate(req.params.id, pick(req.body, ['isRead', 'archived']), { new: true });
  if (!m) throw httpErr(404, 'Not found');
  res.json(m);
}));
router.delete('/messages/:id', wrap(async (req, res) => { await ContactMessage.findByIdAndDelete(req.params.id); res.json({ ok: true }); }));

/* ---------- uploads, media, CV ---------- */
const PURPOSES = ['project', 'gallery', 'profile', 'journal', 'cv', 'branding', 'media'];
router.post('/upload', upload.single('file'), wrap(async (req, res) => {
  if (!req.file) throw httpErr(400, 'No file received');
  const purpose = PURPOSES.includes(req.body.purpose) ? req.body.purpose : 'media';
  const doc = await storeFile(req.file, purpose);
  if (purpose === 'cv') { // newest CV becomes the active one
    await UploadedFile.updateMany({ purpose: 'cv', _id: { $ne: doc._id } }, { isActiveCv: false });
    doc.isActiveCv = true; await doc.save();
  }
  res.status(201).json(doc);
}));
router.get('/media', wrap(async (req, res) => {
  const f = req.query.purpose && PURPOSES.includes(req.query.purpose) ? { purpose: req.query.purpose } : {};
  res.json(await UploadedFile.find(f).sort({ createdAt: -1 }).limit(300));
}));
router.delete('/media/:id', wrap(async (req, res) => {
  const d = await UploadedFile.findById(req.params.id);
  if (!d) throw httpErr(404, 'Not found');
  await removeFile(d); await d.deleteOne();
  if (d.purpose === 'cv' && d.isActiveCv) { // promote newest remaining CV
    const next = await UploadedFile.findOne({ purpose: 'cv' }).sort({ createdAt: -1 });
    if (next) { next.isActiveCv = true; await next.save(); }
  }
  res.json({ ok: true });
}));
router.get('/cv', wrap(async (req, res) => res.json(await UploadedFile.find({ purpose: 'cv' }).sort({ createdAt: -1 }))));
router.post('/cv/:id/activate', wrap(async (req, res) => {
  const d = await UploadedFile.findOne({ _id: req.params.id, purpose: 'cv' });
  if (!d) throw httpErr(404, 'Not found');
  await UploadedFile.updateMany({ purpose: 'cv' }, { isActiveCv: false });
  d.isActiveCv = true; await d.save();
  res.json(d);
}));

module.exports = router;
