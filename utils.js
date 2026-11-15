exports.wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
exports.pick = (o = {}, keys) => keys.reduce((a, k) => { if (o[k] !== undefined) a[k] = o[k]; return a; }, {});
exports.httpErr = (status, message) => Object.assign(new Error(message), { status });
exports.escapeRx = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const slugify = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim()
  .replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'item';
exports.slugify = slugify;
exports.uniqueSlug = async (Model, base, excludeId) => {
  const s = slugify(base); let n = s, i = 1;
  while (await Model.exists({ slug: n, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })) n = `${s}-${++i}`;
  return n;
};
