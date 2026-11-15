# Portfolio CMS — Yahaya Mohammed

A public developer portfolio powered by a private admin CMS.
Stack: Node.js, Express, MongoDB (Mongoose), vanilla HTML/CSS/JS, Cloudinary for uploads.

## Quick start (local)
1. `npm install`
2. `cp .env.example .env` and fill in `MONGODB_URI`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
   (generate a secret: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`).
3. `npm start` → public site at http://localhost:3000, admin at http://localhost:3000/admin
4. On first start the admin account is created from `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Then **delete `ADMIN_PASSWORD` from your environment**.

Without Cloudinary credentials, uploads are saved to `./uploads` (development only). In production
(`NODE_ENV=production`) uploads are refused unless Cloudinary is configured.

## Deploy on Render
1. Push this folder to GitHub. Create a **Web Service**: build `npm install`, start `npm start`.
2. Create a free MongoDB Atlas cluster; allow Render's IPs (or 0.0.0.0/0) and copy the connection string.
3. Create a free Cloudinary account; copy the `CLOUDINARY_URL` (or cloud name / key / secret).
4. Set environment variables on Render: `NODE_ENV=production`, `MONGODB_URI`, `SESSION_SECRET`,
   `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`, and the Cloudinary values.
5. Deploy, open `/admin/login`, sign in, then remove `ADMIN_PASSWORD` from Render's environment.

## Password reset
Set `ADMIN_RESET_TOKEN` (24+ random characters) in the environment, then:
```
curl -X POST https://YOUR-SITE/api/auth/reset -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","token":"THE_TOKEN","newPassword":"NewPassw0rdHere"}'
```
Remove the variable afterwards; the endpoint is disabled whenever it is unset.

## Daily workflow
Log in at `/admin/login` → Projects → **Add New Project** → fill in details, upload screenshots,
add GitHub / demo links → **Save & Preview** → **Publish**. The public site reads from the API on
every request, so there is no redeploy. Same for skills, journal, About Me, CV, and settings.

Text fields support simple formatting: blank line = new paragraph, `## Heading`, and `- list item`.

## Structure
- `server.js` — app setup, sessions, security headers, page routes, admin seeding
- `models/index.js` — Admin, Project, Skill, Profile, JournalPost, ContactMessage, PortfolioSettings, UploadedFile
- `routes/auth.js` · `routes/admin.js` (protected) · `routes/public.js` (published content only)
- `middleware/` — auth guard, upload validation (magic-byte checks) + Cloudinary storage
- `public/` — public site (multi-page) · `admin/` — dark dashboard (separate design)

## Security notes
bcrypt (cost 12) password hashes; HTTP-only, SameSite=Strict, Secure (production) session cookies stored in MongoDB;
login rate-limit + account lockout; every `/api/admin/*` route requires a session; cross-origin write requests rejected;
CSP/helmet headers; no inline scripts; all user content escaped on render; upload size/type validation;
contact form has honeypot, timing check, rate limit, link and duplicate filters.

## Install the admin as an app (PWA)
Open `/admin/login` over HTTPS (your Render URL) in Chrome/Edge and use the install icon in the address bar,
or on a phone use "Add to Home screen". The service worker never caches content, so data is always live.
