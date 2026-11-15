exports.requireAuth = (req, res, next) =>
  req.session && req.session.adminId ? next() : res.status(401).json({ error: 'Authentication required' });
exports.requireAuthPage = (req, res, next) =>
  req.session && req.session.adminId ? next() : res.redirect('/admin/login');
