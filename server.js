require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const connectDb = require('./config/db');
const { Admin, Profile, PortfolioSettings } = require('./models');
const { requireAuthPage } = require('./middleware/auth');

const prod = process.env.NODE_ENV === 'production';
const { MONGODB_URI, SESSION_SECRET } = process.env;
if (!MONGODB_URI) throw new Error('MONGODB_URI is required');
if (!SESSION_SECRET || SESSION_SECRET.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'], fontSrc: ["'self'"], connectSrc: ["'self'"],
      frameSrc: ["'self'", 'https://res.cloudinary.com'], objectSrc: ["'none'"], frameAncestors: ["'self'"],
      'upgrade-insecure-requests': prod ? [] : null
    }
  },
  crossOriginResourcePolicy: false
}));
app.use(express.json({ limit: '200kb' }));
app.use(session({
  name: 'sid', secret: SESSION_SECRET, resave: false, saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: MONGODB_URI, ttl: 8 * 60 * 60 }),
  cookie: { httpOnly: true, sameSite: 'strict', secure: prod, maxAge: 8 * 60 * 60 * 1000 }
}));

// CSRF defence: reject cross-origin state-changing API calls (cookies are also SameSite=Strict)
app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const o = req.get('origin');
  try { if (o && new URL(o).host !== req.get('host')) return res.status(403).json({ error: 'Cross-origin request blocked' }); }
  catch { return res.status(403).json({ error: 'Bad origin' }); }
  next();
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/public', require('./routes/public'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

/* admin pages */
const page = (res, f) => { res.set('Cache-Control', 'no-store'); res.sendFile(path.join(__dirname, 'admin/views', f)); };
app.use('/admin-assets', express.static(path.join(__dirname, 'admin/assets')));
app.get('/admin/sw.js', (req, res) => { res.set('Cache-Control', 'no-cache'); res.type('application/javascript').sendFile(path.join(__dirname, 'admin/assets/sw.js')); });
app.get('/admin', (req, res) => res.redirect(req.session.adminId ? '/admin/dashboard' : '/admin/login'));
app.get('/admin/login', (req, res) => (req.session.adminId ? res.redirect('/admin/dashboard') : page(res, 'login.html')));
app.get('/admin/dashboard', requireAuthPage, (req, res) => page(res, 'dashboard.html'));
app.get('/admin/*', (req, res) => res.redirect('/admin'));

/* public site */
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { index: false, dotfiles: 'deny' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'], maxAge: 0 }));
app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'public/404.html')));

app.use((err, req, res, next) => {
  let code = err.status || 500, msg = err.message;
  if (err.name === 'ValidationError') { code = 400; msg = Object.values(err.errors).map(e => e.message).join('; '); }
  else if (err.name === 'CastError') { code = 400; msg = `Invalid value for ${err.path}`; }
  else if (err.code === 11000) { code = 409; msg = 'That value already exists (duplicate).'; }
  else if (err.code === 'LIMIT_FILE_SIZE') { code = 413; msg = 'File too large (max 10 MB).'; }
  else if (err.type === 'entity.parse.failed') { code = 400; msg = 'Invalid JSON'; }
  else if (code >= 500) { console.error(err); msg = 'Server error'; }
  res.status(code).json({ error: msg });
});

async function seed() {
  if (!(await Admin.countDocuments())) {
    const { ADMIN_EMAIL: email, ADMIN_PASSWORD: pw, ADMIN_NAME: name } = process.env;
    if (email && pw && pw.length >= 10) {
      await Admin.create({ email, name: name || 'Admin', passwordHash: await bcrypt.hash(pw, 12) });
      console.log('Initial admin created:', email, '(remove ADMIN_PASSWORD from the environment now)');
    } else console.warn('No admin exists. Set ADMIN_EMAIL and ADMIN_PASSWORD (10+ chars) and restart.');
  }
  if (!(await Profile.countDocuments())) await Profile.create({ fullName: 'Yahaya Mohammed', title: 'Full-Stack Developer' });
  if (!(await PortfolioSettings.countDocuments())) await PortfolioSettings.create({ portfolioName: 'Yahaya Mohammed' });
}

connectDb(MONGODB_URI).then(seed).then(() => {
  app.listen(process.env.PORT || 3000, () => console.log('Portfolio running on port', process.env.PORT || 3000));
}).catch(e => { console.error(e); process.exit(1); });
