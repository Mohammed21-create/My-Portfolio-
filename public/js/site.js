(() => {
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const url = u => (/^(https?:\/\/|\/)/i.test(u || '') ? esc(u) : '#');
const qs = new URLSearchParams(location.search);
const page = document.body.dataset.page;
const get = async (p, admin) => {
  const r = await fetch((admin ? '/api/admin' : '/api/public') + p);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Request failed');
  return d;
};
const fmt = d => (d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '');
const rich = t => String(t || '').split(/\n{2,}/).map(b => {
  b = b.trim(); if (!b) return '';
  if (/^##\s/.test(b)) return `<h3>${esc(b.slice(3))}</h3>`;
  const ls = b.split('\n');
  if (ls.every(l => /^[-*]\s/.test(l.trim()))) return `<ul>${ls.map(l => `<li>${esc(l.trim().slice(2))}</li>`).join('')}</ul>`;
  return `<p>${esc(b).replace(/\n/g, '<br>')}</p>`;
}).join('');
const pic = (i, alt) => (i && i.url ? `<img src="${url(i.url)}" alt="${esc(alt)}" loading="lazy">` : `<div class="ph">${esc((alt || '?')[0].toUpperCase())}</div>`);
const chips = (a, cls = '') => (a || []).map(x => `<span class="chip ${cls}">${esc(x)}</span>`).join('');
const app = $('#app');
const msg = t => (app.innerHTML = `<div class="wrap center"><p class="muted">${esc(t)}</p></div>`);
let S = {}, P = {};

const projectCard = p => `<a class="card" href="/project?slug=${encodeURIComponent(p.slug)}">${pic(p.mainImage, p.name)}<div class="b"><h3>${esc(p.name)}</h3><p>${esc(p.shortDescription)}</p><div class="chips">${chips((p.technologies || []).slice(0, 5))}</div><div class="chips"><span class="chip a">${esc(p.developmentStatus)}</span>${p.featured ? '<span class="chip a">★ Featured</span>' : ''}</div></div></a>`;
const postCard = p => `<a class="card" href="/article?slug=${encodeURIComponent(p.slug)}">${p.coverImage && p.coverImage.url ? pic(p.coverImage, p.title) : ''}<div class="b"><div class="chips">${p.category ? `<span class="chip a">${esc(p.category)}</span>` : ''}<span class="chip">${fmt(p.publishAt || p.publishedAt)}</span></div><h3>${esc(p.title)}</h3><p>${esc(p.excerpt)}</p></div></a>`;

function shell() {
  const sec = S.sections || {}, on = k => sec[k] !== false;
  document.documentElement.dataset.theme = S.theme || 'auto';
  if (S.accentColor) document.documentElement.style.setProperty('--accent', S.accentColor);
  if (S.faviconUrl || (S.favicon && S.favicon.url)) { const l = document.createElement('link'); l.rel = 'icon'; l.href = (S.favicon || {}).url; document.head.append(l); }
  const links = [['/', 'Home', 1, 'index'], ['/about', 'About', on('about'), 'about'], ['/skills', 'Skills', on('skills'), 'skills'], ['/projects', 'Projects', on('projects'), 'projects'], ['/journal', 'Journal', on('journal'), 'journal'], ['/contact', 'Contact', on('contact'), 'contact']]
    .filter(l => l[2]).map(l => `<a href="${l[0]}" class="${page === l[3] || (page === 'project' && l[3] === 'projects') || (page === 'article' && l[3] === 'journal') ? 'on' : ''}">${l[1]}</a>`).join('');
  $('#hdr').innerHTML = `<div class="wrap nav"><a class="brand" href="/">${S.logo && S.logo.url ? `<img src="${url(S.logo.url)}" alt="">` : ''}${esc(S.portfolioName || P.fullName || 'Portfolio')}</a><button id="mb" aria-label="Menu">☰</button><nav class="links" id="lk">${links}${on('cv') ? '<a href="/api/public/cv" target="_blank" rel="noopener">CV</a>' : ''}</nav></div>`;
  $('#mb').onclick = () => $('#lk').classList.toggle('open');
  const gh = S.githubUrl || P.github, li = S.linkedinUrl || P.linkedin, wa = String(S.whatsapp || P.whatsapp || '').replace(/\D/g, '');
  const social = [[gh, 'GitHub'], [li, 'LinkedIn'], [wa && 'https://wa.me/' + wa, 'WhatsApp'], [P.twitter, 'X'], [P.youtube, 'YouTube']].filter(x => x[0]).map(x => `<a href="${url(x[0])}" target="_blank" rel="noopener">${x[1]}</a>`).join(' · ');
  $('#ftr').innerHTML = `<div class="wrap"><span>${esc(S.footerText || `© ${new Date().getFullYear()} ${S.portfolioName || ''}`)}</span><span>${social}</span></div>`;
  const t = { index: 'Home', projects: 'Projects', about: 'About', skills: 'Skills', journal: 'Developer Journal', contact: 'Contact' }[page];
  document.title = t ? `${t} | ${S.seoTitle || S.portfolioName || 'Portfolio'}` : (S.seoTitle || S.portfolioName || 'Portfolio');
  const m = $('meta[name=description]'); if (m) m.content = S.seoDescription || S.description || '';
}

const R = {
  async index() {
    const sec = S.sections || {}, on = k => sec[k] !== false;
    const [fp, ps, js] = await Promise.all([
      on('projects') ? get('/projects?limit=6').catch(() => []) : [],
      on('skills') ? get('/skills').catch(() => []) : [],
      on('journal') ? get('/journal?limit=3').catch(() => []) : []
    ]);
    const av = S.availability || 'available', avt = { available: 'Available for work', limited: 'Limited availability', unavailable: 'Not available' }[av];
    const feat = fp.filter(p => p.featured).concat(fp.filter(p => !p.featured)).slice(0, 3);
    app.innerHTML = `<div class="wrap"><section class="hero"><div><span class="badge ${av}"><i></i>${esc(S.availabilityNote || avt)}</span><h1>${esc(P.fullName)}</h1><h3 class="muted">${esc(P.title)}</h3><p>${esc(P.intro || S.description)}</p><p>${on('projects') ? '<a class="btn" href="/projects">View projects</a> ' : ''}${on('cv') ? '<a class="btn ghost" target="_blank" rel="noopener" href="/api/public/cv">Download CV</a> ' : ''}${on('contact') ? '<a class="btn ghost" href="/contact">Contact me</a>' : ''}</p></div>${P.photo && P.photo.url ? `<img class="photo" src="${url(P.photo.url)}" alt="${esc(P.fullName)}">` : ''}</section>
    ${feat.length ? `<section class="blk"><div class="sh"><h2>Featured projects</h2><a href="/projects">All projects →</a></div><div class="grid">${feat.map(projectCard).join('')}</div></section>` : ''}
    ${ps.length ? `<section class="blk"><div class="sh"><h2>Skills</h2><a href="/skills">Details →</a></div>${ps.slice(0, 18).map(k => `<span class="sk">${k.icon && k.icon.url ? `<img src="${url(k.icon.url)}" alt="">` : esc(k.iconText || '')} ${esc(k.name)}</span>`).join('')}</section>` : ''}
    ${js.length ? `<section class="blk"><div class="sh"><h2>From the journal</h2><a href="/journal">All articles →</a></div><div class="grid">${js.map(postCard).join('')}</div></section>` : ''}</div>`;
  },
  async projects() {
    const list = await get('/projects');
    const cats = [...new Set(list.map(p => p.category).filter(Boolean))];
    app.innerHTML = `<div class="wrap blk"><div class="sh"><h2>Projects</h2></div><div class="bar"><input id="q" type="search" placeholder="Search projects or technologies…"></div><div class="bar" id="cats">${cats.length ? ['All', ...cats].map((c, i) => `<button class="pill ${i ? '' : 'on'}" data-c="${i ? esc(c) : ''}">${esc(c)}</button>`).join('') : ''}</div><div class="grid" id="g"></div></div>`;
    let cat = '';
    const draw = () => {
      const q = $('#q').value.toLowerCase();
      const r = list.filter(p => (!cat || p.category === cat) && (!q || [p.name, p.shortDescription, ...(p.technologies || [])].join(' ').toLowerCase().includes(q)));
      $('#g').innerHTML = r.map(projectCard).join('') || '<p class="muted">No projects found.</p>';
    };
    $('#q').oninput = draw;
    $('#cats').onclick = e => { const b = e.target.closest('[data-c]'); if (!b) return; cat = b.dataset.c; document.querySelectorAll('#cats .pill').forEach(x => x.classList.toggle('on', x === b)); draw(); };
    draw();
  },
  async project() {
    const prev = qs.get('preview');
    const p = prev ? await get('/projects/' + encodeURIComponent(prev), true) : await get('/projects/' + encodeURIComponent(qs.get('slug') || ''));
    document.title = `${p.name} | ${S.portfolioName || ''}`;
    app.innerHTML = `${prev ? '<div class="banner">Preview — this is how the project will look. Status: ' + esc(p.status) + '</div>' : ''}<div class="wrap blk hd"><a href="/projects">← All projects</a><h1>${esc(p.name)}</h1><p class="muted">${esc(p.shortDescription)}</p><div class="chips"><span class="chip a">${esc(p.developmentStatus)}</span>${p.category ? `<span class="chip">${esc(p.category)}</span>` : ''}${chips(p.technologies)}</div><p>${p.liveUrl ? `<a class="btn" href="${url(p.liveUrl)}" target="_blank" rel="noopener">Live demo</a> ` : ''}${p.githubUrl ? `<a class="btn ghost" href="${url(p.githubUrl)}" target="_blank" rel="noopener">GitHub</a>` : ''}</p>${p.mainImage && p.mainImage.url ? `<img class="cover" src="${url(p.mainImage.url)}" alt="${esc(p.name)}">` : ''}<div class="prose">${rich(p.description)}${(p.features || []).length ? `<h3>Key features</h3><ul>${p.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}<p class="muted">${p.startDate ? 'Started ' + fmt(p.startDate) : ''}${p.completionDate ? ' · Completed ' + fmt(p.completionDate) : ''}</p></div>${(p.images || []).length ? `<div class="gal">${p.images.map(i => `<a href="${url(i.url)}" target="_blank" rel="noopener"><img src="${url(i.url)}" alt="" loading="lazy"></a>`).join('')}</div>` : ''}</div>`;
  },
  async about() {
    const sk = (a, t) => (a && a.length ? `<h3>${t}</h3><ul>${a.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '');
    app.innerHTML = `<div class="wrap blk"><div class="hero" style="padding-top:0"><div class="prose"><h1>${esc(P.fullName)}</h1><h3 class="muted">${esc(P.title)}${P.location ? ' · ' + esc(P.location) : ''}</h3>${rich(P.bio)}${P.intro ? '<h3>Professional introduction</h3>' + rich(P.intro) : ''}${P.careerGoals ? '<h3>Career goals</h3>' + rich(P.careerGoals) : ''}${sk(P.strengths, 'Professional strengths')}${sk(P.education, 'Education')}${P.nssExperience ? '<h3>NSS experience</h3>' + rich(P.nssExperience) : ''}${P.email ? `<p><a href="mailto:${esc(P.email)}">${esc(P.email)}</a>${P.phone ? ' · ' + esc(P.phone) : ''}</p>` : ''}</div>${P.photo && P.photo.url ? `<img class="photo" src="${url(P.photo.url)}" alt="${esc(P.fullName)}">` : ''}</div></div>`;
  },
  async skills() {
    const list = await get('/skills');
    const cats = ['Frontend Development', 'Backend Development', 'Database Management', 'Tools and Deployment', 'Programming Languages', 'Automation and AI'];
    app.innerHTML = `<div class="wrap blk"><div class="sh"><h2>Skills</h2></div>${cats.map(c => { const r = list.filter(s => s.category === c); return r.length ? `<div class="skillg"><h3>${c}</h3>${r.map(k => `<span class="sk">${k.icon && k.icon.url ? `<img src="${url(k.icon.url)}" alt="">` : esc(k.iconText || '')} ${esc(k.name)} <small>${esc(k.learningStatus)}</small></span>`).join('')}</div>` : ''; }).join('') || '<p class="muted">Skills coming soon.</p>'}</div>`;
  },
  async journal() {
    const list = await get('/journal');
    const cats = [...new Set(list.map(p => p.category).filter(Boolean))];
    app.innerHTML = `<div class="wrap blk"><div class="sh"><h2>Developer Journal</h2></div><div class="bar"><input id="q" type="search" placeholder="Search articles…"></div><div class="bar" id="cats">${cats.length ? ['All', ...cats].map((c, i) => `<button class="pill ${i ? '' : 'on'}" data-c="${i ? esc(c) : ''}">${esc(c)}</button>`).join('') : ''}</div><div class="grid" id="g"></div></div>`;
    let cat = '';
    const draw = () => { const q = $('#q').value.toLowerCase(); $('#g').innerHTML = list.filter(p => (!cat || p.category === cat) && (!q || [p.title, p.excerpt, ...(p.tags || [])].join(' ').toLowerCase().includes(q))).map(postCard).join('') || '<p class="muted">No articles yet.</p>'; };
    $('#q').oninput = draw;
    $('#cats').onclick = e => { const b = e.target.closest('[data-c]'); if (!b) return; cat = b.dataset.c; document.querySelectorAll('#cats .pill').forEach(x => x.classList.toggle('on', x === b)); draw(); };
    draw();
  },
  async article() {
    const prev = qs.get('preview');
    const p = prev ? await get('/journal/' + encodeURIComponent(prev), true) : await get('/journal/' + encodeURIComponent(qs.get('slug') || ''));
    document.title = `${p.title} | ${S.portfolioName || ''}`;
    app.innerHTML = `${prev ? '<div class="banner">Preview — status: ' + esc(p.status) + '</div>' : ''}<div class="wrap blk hd"><a href="/journal">← Journal</a><h1>${esc(p.title)}</h1><div class="chips">${p.category ? `<span class="chip a">${esc(p.category)}</span>` : ''}<span class="chip">${fmt(p.publishAt || p.publishedAt || p.createdAt)}</span>${chips(p.tags)}</div>${p.coverImage && p.coverImage.url ? `<img class="cover" src="${url(p.coverImage.url)}" alt="">` : ''}<div class="prose">${rich(p.content)}</div></div>`;
  },
  async contact() {
    app.innerHTML = `<div class="wrap blk"><div class="sh"><h2>Contact</h2></div><p class="muted">${esc(S.contactEmail || P.email || '')} ${esc(S.phone || P.phone || '')}</p><form class="form" id="cf"><div class="hp"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div><input name="name" placeholder="Your name" required minlength="2" maxlength="100"><input name="email" type="email" placeholder="Your email" required maxlength="150"><input name="subject" placeholder="Subject" maxlength="150"><textarea name="message" rows="6" placeholder="Your message" required minlength="10" maxlength="5000"></textarea><button class="btn">Send message</button><div id="out"></div></form></div>`;
    const t0 = Date.now();
    $('#cf').onsubmit = async e => {
      e.preventDefault();
      const f = e.target, b = $('button', f), out = $('#out');
      b.disabled = true; out.innerHTML = '';
      try {
        const body = Object.fromEntries(new FormData(f)); body.t = t0;
        const r = await fetch('/api/public/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || 'Could not send');
        f.reset(); out.innerHTML = '<div class="note ok">Thanks! Your message was sent.</div>';
      } catch (err) { out.innerHTML = `<div class="note err">${esc(err.message)}</div>`; }
      b.disabled = false;
    };
  }
};
const SEC = { projects: 'projects', project: 'projects', about: 'about', skills: 'skills', journal: 'journal', article: 'journal', contact: 'contact' };

(async () => {
  try { [S, P] = await Promise.all([get('/settings'), get('/profile')]); } catch (e) {}
  shell();
  if (SEC[page] && S.sections && S.sections[SEC[page]] === false) return msg('This section is not available.');
  try { await R[page](); } catch (e) { msg(e.message); }
})();
})();
