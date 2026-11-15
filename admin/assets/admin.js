(() => {
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const view = $('#view'), title = $('#title');
const loading = () => (view.innerHTML = '<div class="loading"><span class="spin"></span></div>');
const fmtDate = d => (d ? new Date(d).toLocaleString() : '');
const kb = n => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');

async function api(method, path, body) {
  const o = { method, headers: {} };
  if (body instanceof FormData) o.body = body;
  else if (body !== undefined) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(body); }
  const r = await fetch('/api' + path, o);
  if (r.status === 401) { location.href = '/admin/login'; throw new Error('Session expired'); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Request failed');
  return d;
}
function toast(m, t = 'ok') { const e = document.createElement('div'); e.className = 'toast ' + t; e.textContent = m; $('#toasts').append(e); setTimeout(() => e.remove(), 4000); }
const fail = e => toast(e.message, 'err');
function confirmBox(msg, label = 'Confirm') {
  return new Promise(res => {
    const d = $('#dlg'); d.returnValue = '';
    d.innerHTML = `<form method="dialog"><p>${esc(msg)}</p><div class="row"><button value="no" class="btn ghost">Cancel</button><button value="yes" class="btn danger">${esc(label)}</button></div></form>`;
    d.onclose = () => res(d.returnValue === 'yes'); d.showModal();
  });
}
function modal(html) {
  const d = $('#dlg2'); d.innerHTML = `<div class="mbox">${html}</div>`; d.showModal();
  d.onclick = e => { if (e.target === d) d.close(); };
  return d;
}

/* ---------- form builder ---------- */
const toLocal = v => { const d = new Date(v); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const lbl = (f, inner) => `<label class="fld ${f.w || ''}"><span>${esc(f.l)}${f.req ? ' *' : ''}</span>${inner}</label>`;
function inputHtml(f, v) {
  if (f.t === 'sub') return `<h4 class="sub">${esc(f.l)}</h4>`;
  const n = `name="${f.n}"`, r = f.req ? 'required' : '';
  switch (f.t) {
    case 'textarea': return lbl(f, `<textarea ${n} rows="${f.rows || 4}" ${r}>${esc(v)}</textarea>`);
    case 'lines': return lbl(f, `<textarea ${n} rows="${f.rows || 4}" placeholder="One per line">${esc((v || []).join('\n'))}</textarea>`);
    case 'select': return lbl(f, `<select ${n}>${f.opts.map(o => { const [a, b] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(a)}" ${a === v ? 'selected' : ''}>${esc(b)}</option>`; }).join('')}</select>`);
    case 'bool': return `<label class="fld chk"><input type="checkbox" ${n} ${v ? 'checked' : ''}><span>${esc(f.l)}</span></label>`;
    case 'tags': return lbl(f, `<input ${n} value="${esc((v || []).join(', '))}" placeholder="comma, separated">`);
    case 'date': return lbl(f, `<input type="date" ${n} value="${v ? String(v).slice(0, 10) : ''}">`);
    case 'datetime': return lbl(f, `<input type="datetime-local" ${n} value="${v ? toLocal(v) : ''}">`);
    case 'image': case 'images':
      return `<div class="fld up" data-n="${f.n}" data-multi="${f.t === 'images' ? 1 : ''}" data-purpose="${f.purpose || 'media'}"><span>${esc(f.l)}</span><div class="thumbs"></div><input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/x-icon" ${f.t === 'images' ? 'multiple' : ''}></div>`;
    default: return lbl(f, `<input type="${f.t || 'text'}" ${n} ${r} value="${esc(v)}" ${f.max ? `maxlength="${f.max}"` : ''}>`);
  }
}
function paint(f, u) {
  const n = u.dataset.n, v = f._img[n], arr = Array.isArray(v) ? v : (v ? [v] : []);
  $('.thumbs', u).innerHTML = arr.map((im, i) => `<div class="th"><img src="${esc(im.url)}" alt=""><button type="button" data-rm="${i}" title="Remove">×</button></div>`).join('') || '<em class="muted">No image</em>';
  $$('[data-rm]', u).forEach(b => (b.onclick = () => { if (Array.isArray(f._img[n])) f._img[n].splice(+b.dataset.rm, 1); else f._img[n] = null; paint(f, u); }));
}
function bindUpload(f, u) {
  const inp = $('input[type=file]', u), n = u.dataset.n, multi = !!u.dataset.multi;
  inp.onchange = async () => {
    u.classList.add('busy');
    try {
      for (const file of inp.files) {
        const fd = new FormData(); fd.append('purpose', u.dataset.purpose); fd.append('file', file);
        const d = await api('POST', '/admin/upload', fd), im = { url: d.url, publicId: d.publicId };
        if (multi) f._img[n].push(im); else f._img[n] = im;
      }
      paint(f, u);
    } catch (e) { fail(e); } finally { u.classList.remove('busy'); inp.value = ''; }
  };
}
function collect(fields, f) {
  const o = {};
  for (const x of fields) {
    if (x.t === 'sub') continue;
    if (x.t === 'image' || x.t === 'images') { o[x.n] = f._img[x.n]; continue; }
    const el = f.elements[x.n];
    if (x.t === 'bool') { o[x.n] = el.checked; continue; }
    let v = el.value;
    if (x.t === 'tags') v = v.split(',').map(s => s.trim()).filter(Boolean);
    else if (x.t === 'lines') v = v.split('\n').map(s => s.trim()).filter(Boolean);
    else if (x.t === 'datetime') v = v ? new Date(v).toISOString() : null;
    else if (x.t === 'date') v = v || null;
    else if (x.t === 'number') v = v === '' ? 0 : Number(v);
    else v = v.trim();
    o[x.n] = v;
  }
  return o;
}
function buildForm(fields, data, { buttons, onSubmit }) {
  const f = document.createElement('form'); f.className = 'form'; f.autocomplete = 'off'; f._img = {};
  f.innerHTML = fields.map(x => inputHtml(x, data[x.n])).join('') + `<div class="actions">${buttons}</div>`;
  $$('.up', f).forEach(u => { const n = u.dataset.n; f._img[n] = u.dataset.multi ? [...(data[n] || [])] : (data[n] || null); paint(f, u); bindUpload(f, u); });
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const btns = $$('button', f); btns.forEach(b => (b.disabled = true));
    try { await onSubmit(collect(fields, f), e.submitter && e.submitter.value, f); } catch (err) { fail(err); } finally { btns.forEach(b => (b.disabled = false)); }
  });
  return f;
}

/* ---------- generic list + editor ---------- */
function crudView(c) {
  const self = async sub => {
    title.textContent = c.title;
    const st = { trash: false }; let cache = [], t;
    view.innerHTML = `<div class="bar"><input id="q" type="search" placeholder="Search ${esc(c.title.toLowerCase())}…">${c.filters ? `<select id="flt">${c.filters.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>` : ''}${c.soft ? '<button class="btn ghost" id="trash">Trash</button>' : ''}<button class="btn" id="add">+ ${esc(c.add)}</button></div><div id="items" class="cards"></div>`;
    const items = $('#items');
    const back = () => { if (location.hash === '#' + c.path) self(); else location.hash = c.path; };
    async function load() {
      items.innerHTML = '<div class="loading"><span class="spin"></span></div>';
      const p = new URLSearchParams(); const q = $('#q').value.trim(); if (q) p.set('q', q);
      const fl = $('#flt'); if (fl && fl.value) p.set(c.filterKey, fl.value);
      if (st.trash) p.set('trash', '1');
      try { cache = await api('GET', `/admin/${c.path}?${p}`); } catch (e) { items.innerHTML = ''; return fail(e); }
      if (!cache.length) { items.innerHTML = `<div class="empty">${st.trash ? 'Trash is empty.' : 'Nothing here yet. Click “' + esc(c.add) + '” to get started.'}</div>`; return; }
      items.innerHTML = cache.map(it => {
        const d = c.card(it);
        return `<article class="item"><div class="thumb">${d.img ? `<img src="${esc(d.img)}" alt="">` : `<span>${esc((d.title || '?')[0].toUpperCase())}</span>`}</div><div class="body"><h4>${esc(d.title)}</h4><p>${esc(d.sub || '')}</p><div class="chips">${d.badges.map(([x, k]) => `<span class="chip ${k}">${esc(x)}</span>`).join('')}</div></div><div class="acts">${c.actions(it, st).map(([k, l, x]) => `<button class="btn sm ${x || 'ghost'}" data-k="${k}" data-id="${it._id}">${l}</button>`).join('')}</div></article>`;
      }).join('');
    }
    const run = {
      edit: it => editor(it),
      delete: async it => { if (await confirmBox(c.soft ? `Move “${it[c.nameKey]}” to trash? You can restore it later.` : `Delete “${it[c.nameKey]}” permanently?`, c.soft ? 'Move to trash' : 'Delete')) { await api('DELETE', `/admin/${c.path}/${it._id}`); toast(c.soft ? 'Moved to trash' : 'Deleted'); return 1; } },
      restore: async it => { await api('POST', `/admin/${c.path}/${it._id}/restore`); toast('Restored (as draft)'); return 1; },
      purge: async it => { if (await confirmBox(`Permanently delete “${it[c.nameKey]}”? This cannot be undone.`, 'Delete forever')) { await api('DELETE', `/admin/${c.path}/${it._id}?permanent=1`); toast('Deleted permanently'); return 1; } },
      ...(c.run || {})
    };
    items.onclick = async e => {
      const b = e.target.closest('[data-k]'); if (!b) return;
      const it = cache.find(x => x._id === b.dataset.id); if (!it) return;
      b.disabled = true;
      try { if (await run[b.dataset.k](it)) await load(); } catch (err) { fail(err); }
      b.disabled = false;
    };
    function editor(it) {
      title.textContent = (it ? 'Edit ' : 'New ') + c.single;
      view.innerHTML = '<p><button class="btn ghost" id="back">← Back to list</button></p><section class="panel"><div id="fm"></div></section>';
      $('#back').onclick = back;
      const f = buildForm(c.fields, it || c.defaults || {}, {
        buttons: c.buttons,
        onSubmit: async (data, btn) => {
          if (btn === 'draft' || btn === 'published') data.status = btn;
          else if (btn === 'preview') data.status = it ? it.status : 'draft';
          const w = btn === 'preview' ? window.open('about:blank', '_blank') : null;
          try {
            const saved = it ? await api('PUT', `/admin/${c.path}/${it._id}`, data) : await api('POST', `/admin/${c.path}`, data);
            toast(saved.status === 'scheduled' ? 'Saved — scheduled for publication' : saved.status === 'published' && c.path !== 'skills' ? 'Saved & published' : 'Saved');
            if (w) w.location = c.previewUrl(saved);
            if (btn === 'preview') { it = saved; title.textContent = 'Edit ' + c.single; } else back();
          } catch (e) { if (w) w.close(); throw e; }
        }
      });
      $('#fm').append(f);
    }
    $('#q').oninput = () => { clearTimeout(t); t = setTimeout(load, 300); };
    if ($('#flt')) $('#flt').onchange = load;
    if (c.soft) $('#trash').onclick = () => { st.trash = !st.trash; $('#trash').textContent = st.trash ? '← Back to list' : 'Trash'; load(); };
    $('#add').onclick = () => editor(null);
    if (sub === 'new') editor(null); else await load();
  };
  return self;
}
const PUB_BTNS = '<button class="btn" value="published">Publish</button><button class="btn ghost" value="draft">Save as Draft</button><button class="btn ghost" value="preview">Save &amp; Preview</button>';
const statusChip = s => [s, s === 'published' ? 'ok' : s === 'scheduled' ? 'warn' : ''];

const projects = crudView({
  title: 'Projects', single: 'Project', add: 'Add New Project', path: 'projects', soft: true, nameKey: 'name', filterKey: 'status',
  filters: [['', 'All statuses'], ['published', 'Published'], ['draft', 'Drafts']],
  defaults: { developmentStatus: 'In Development' }, buttons: PUB_BTNS, previewUrl: p => '/project?preview=' + p._id,
  fields: [
    { n: 'name', l: 'Project Name', req: 1, max: 120 }, { n: 'slug', l: 'Project Slug (auto if empty)', max: 80 },
    { n: 'shortDescription', l: 'Short Description', t: 'textarea', rows: 2, w: 'full', max: 300 },
    { n: 'description', l: 'Full Project Description (blank line = new paragraph, “## ” = heading, “- ” = list)', t: 'textarea', rows: 9, w: 'full' },
    { n: 'category', l: 'Project Category' },
    { n: 'developmentStatus', l: 'Development Status', t: 'select', opts: ['Planning', 'In Development', 'Completed', 'Maintenance'] },
    { n: 'technologies', l: 'Technologies Used', t: 'tags', w: 'full' }, { n: 'features', l: 'Key Features', t: 'lines', w: 'full' },
    { n: 'mainImage', l: 'Main Project Screenshot', t: 'image', purpose: 'project' }, { n: 'images', l: 'Additional Project Images', t: 'images', purpose: 'gallery' },
    { n: 'githubUrl', l: 'GitHub Repository URL', t: 'url' }, { n: 'liveUrl', l: 'Live Demo URL', t: 'url' },
    { n: 'startDate', l: 'Project Start Date', t: 'date' }, { n: 'completionDate', l: 'Project Completion Date', t: 'date' },
    { n: 'featured', l: 'Featured project', t: 'bool' }
  ],
  card: p => ({ img: p.mainImage && p.mainImage.url, title: p.name, sub: p.shortDescription, badges: [statusChip(p.status), [p.developmentStatus, ''], ...(p.featured ? [['★ Featured', 'star']] : [])] }),
  actions: (p, st) => st.trash ? [['restore', 'Restore'], ['purge', 'Delete forever', 'danger']] : [['edit', 'Edit'], ['preview', 'Preview'], ['toggle', p.status === 'published' ? 'Unpublish' : 'Publish'], ['feature', p.featured ? 'Unfeature' : 'Feature'], ['delete', 'Delete', 'danger']],
  run: {
    preview: p => { window.open('/project?preview=' + p._id, '_blank'); },
    toggle: async p => { await api('PUT', '/admin/projects/' + p._id, { status: p.status === 'published' ? 'draft' : 'published' }); toast(p.status === 'published' ? 'Unpublished' : 'Published — now live'); return 1; },
    feature: async p => { await api('PUT', '/admin/projects/' + p._id, { featured: !p.featured }); toast(p.featured ? 'Unfeatured' : 'Featured'); return 1; }
  }
});

const CATS = ['Frontend Development', 'Backend Development', 'Database Management', 'Tools and Deployment', 'Programming Languages', 'Automation and AI'];
const skills = crudView({
  title: 'Skills', single: 'Skill', add: 'Add Skill', path: 'skills', nameKey: 'name', filterKey: 'category',
  filters: [['', 'All categories'], ...CATS.map(c => [c, c])], defaults: { category: CATS[0], learningStatus: 'Practicing' },
  buttons: '<button class="btn" value="save">Save Skill</button>',
  fields: [
    { n: 'name', l: 'Skill name', req: 1, max: 60 }, { n: 'category', l: 'Category', t: 'select', opts: CATS },
    { n: 'learningStatus', l: 'Learning status', t: 'select', opts: ['Learning', 'Practicing', 'Experienced'] },
    { n: 'order', l: 'Sort order (lower first)', t: 'number' },
    { n: 'iconText', l: 'Icon emoji or short text (optional)', max: 8 }, { n: 'icon', l: 'Technology icon (optional upload)', t: 'image', purpose: 'branding' }
  ],
  card: s => ({ img: s.icon && s.icon.url, title: (s.iconText ? s.iconText + ' ' : '') + s.name, sub: s.category, badges: [[s.learningStatus, s.learningStatus === 'Experienced' ? 'ok' : s.learningStatus === 'Practicing' ? 'warn' : '']] }),
  actions: () => [['edit', 'Edit'], ['delete', 'Delete', 'danger']]
});

const journal = crudView({
  title: 'Developer Journal', single: 'Article', add: 'Write Journal Article', path: 'journal', nameKey: 'title', filterKey: 'status',
  filters: [['', 'All'], ['published', 'Published'], ['draft', 'Drafts'], ['scheduled', 'Scheduled']], buttons: PUB_BTNS, previewUrl: p => '/article?preview=' + p._id,
  fields: [
    { n: 'title', l: 'Title', req: 1, max: 160 }, { n: 'slug', l: 'Slug (auto if empty)', max: 80 },
    { n: 'excerpt', l: 'Excerpt', t: 'textarea', rows: 2, w: 'full', max: 400 },
    { n: 'content', l: 'Article (blank line = new paragraph, “## ” = heading, “- ” = list)', t: 'textarea', rows: 14, w: 'full' },
    { n: 'category', l: 'Category' }, { n: 'tags', l: 'Tags', t: 'tags' },
    { n: 'coverImage', l: 'Cover image', t: 'image', purpose: 'journal' },
    { n: 'publishAt', l: 'Publish date / schedule (future date + Publish = scheduled)', t: 'datetime' }
  ],
  card: p => ({ img: p.coverImage && p.coverImage.url, title: p.title, sub: p.excerpt, badges: [statusChip(p.status), ...(p.category ? [[p.category, '']] : [])] }),
  actions: p => [['edit', 'Edit'], ['preview', 'Preview'], ['toggle', p.status === 'draft' ? 'Publish' : 'Unpublish'], ['delete', 'Delete', 'danger']],
  run: {
    preview: p => { window.open('/article?preview=' + p._id, '_blank'); },
    toggle: async p => { const pub = p.status === 'draft'; await api('PUT', '/admin/journal/' + p._id, { status: pub ? 'published' : 'draft' }); toast(pub ? 'Published' : 'Unpublished'); return 1; }
  }
});

/* ---------- dashboard ---------- */
async function dashboard() {
  title.textContent = 'Dashboard'; loading();
  const s = await api('GET', '/admin/stats');
  const secs = ['about', 'skills', 'projects', 'journal', 'cv', 'contact'];
  view.innerHTML = `<div class="stats">${[['Published projects', s.publishedProjects], ['Draft projects', s.draftProjects], ['Published articles', s.publishedPosts], ['Contact messages', s.messages + (s.unread ? ` · ${s.unread} new` : '')]].map(([a, b]) => `<div class="stat"><b>${esc(b)}</b><span>${a}</span></div>`).join('')}</div>
  <div class="quick"><a class="btn" href="#projects/new">+ Add New Project</a><a class="btn" href="#journal/new">✎ Write Journal Article</a><a class="btn ghost" href="#about">Update About Me</a><a class="btn ghost" href="#skills">Update Skills</a><a class="btn ghost" href="#cv">Update CV</a><a class="btn ghost" href="/" target="_blank" rel="noopener">View Live Portfolio ↗</a></div>
  <div class="two"><section class="panel"><h3>Recently added projects</h3>${s.recentProjects.map(p => `<p><a href="#projects">${esc(p.name)}</a> <span class="chip ${p.status === 'published' ? 'ok' : 'warn'}">${p.status}</span><br><small class="muted">${fmtDate(p.createdAt)}</small></p>`).join('') || '<p class="muted">No projects yet.</p>'}</section>
  <section class="panel"><h3>Recent messages</h3>${s.recentMessages.map(m => `<p><a href="#messages">${esc(m.name)}</a>${m.isRead ? '' : ' <span class="chip warn">new</span>'}<br><small class="muted">${esc(m.subject || '(no subject)')} · ${fmtDate(m.createdAt)}</small></p>`).join('') || '<p class="muted">No messages yet.</p>'}</section></div>
  <section class="panel"><h3>Portfolio publication status</h3><div class="chips">${secs.map(k => `<span class="chip ${s.sections[k] === false ? 'bad' : 'ok'}">${k}: ${s.sections[k] === false ? 'hidden' : 'public'}</span>`).join('')}<span class="chip ${s.activeCv ? 'ok' : 'warn'}">CV: ${s.activeCv ? 'uploaded' : 'none'}</span><span class="chip">${s.draftPosts} unpublished article(s)</span></div></section>`;
}

/* ---------- about ---------- */
async function about() {
  title.textContent = 'About Me'; loading();
  const p = await api('GET', '/admin/profile');
  const fields = [
    { n: 'fullName', l: 'Full name', req: 1 }, { n: 'title', l: 'Professional title' }, { n: 'location', l: 'Location' },
    { n: 'photo', l: 'Profile photograph', t: 'image', purpose: 'profile' },
    { n: 'bio', l: 'Biography', t: 'textarea', rows: 6, w: 'full' }, { n: 'intro', l: 'Professional introduction', t: 'textarea', rows: 3, w: 'full' },
    { n: 'careerGoals', l: 'Career goals', t: 'textarea', rows: 3, w: 'full' }, { n: 'strengths', l: 'Professional strengths', t: 'lines', w: 'full' },
    { n: 'education', l: 'Educational background', t: 'lines', w: 'full' }, { n: 'nssExperience', l: 'NSS experience', t: 'textarea', rows: 4, w: 'full' },
    { t: 'sub', l: 'Social media links' }, { n: 'github', l: 'GitHub', t: 'url' }, { n: 'linkedin', l: 'LinkedIn', t: 'url' }, { n: 'twitter', l: 'X / Twitter', t: 'url' }, { n: 'youtube', l: 'YouTube', t: 'url' },
    { t: 'sub', l: 'Contact information' }, { n: 'email', l: 'Email', t: 'email' }, { n: 'phone', l: 'Phone' }, { n: 'whatsapp', l: 'WhatsApp number (with country code)' }
  ];
  view.innerHTML = '<section class="panel" id="fm"></section>';
  $('#fm').append(buildForm(fields, p, { buttons: '<button class="btn">Save changes</button><a class="btn ghost" href="/about" target="_blank" rel="noopener">View About page ↗</a>', onSubmit: async d => { await api('PUT', '/admin/profile', d); toast('About page updated'); } }));
}

/* ---------- messages ---------- */
async function messages() {
  title.textContent = 'Contact Messages';
  view.innerHTML = '<div class="bar"><input id="q" type="search" placeholder="Search messages…"><select id="box"><option value="inbox">Inbox</option><option value="unread">Unread</option><option value="archived">Archived</option></select></div><div id="items"></div>';
  let list = [], t;
  async function load() {
    $('#items').innerHTML = '<div class="loading"><span class="spin"></span></div>';
    list = await api('GET', '/admin/messages?' + new URLSearchParams({ box: $('#box').value, q: $('#q').value.trim() }));
    $('#items').innerHTML = list.length ? `<div class="panel tbl"><table class="rs"><thead><tr><th>From</th><th>Subject</th><th>Received</th><th></th></tr></thead><tbody>${list.map(m => `<tr class="${m.isRead ? '' : 'unread'}"><td>${esc(m.name)}<small>${esc(m.email)}</small></td><td>${esc(m.subject || '(no subject)')}</td><td>${fmtDate(m.createdAt)}</td><td><button class="btn sm ghost" data-open="${m._id}">Open</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No messages here.</div>';
  }
  $('#items').onclick = e => {
    const b = e.target.closest('[data-open]'); if (!b) return;
    const m = list.find(x => x._id === b.dataset.open); if (!m) return;
    const d = modal(`<h3>${esc(m.subject || '(no subject)')}</h3><p class="muted">From <b>${esc(m.name)}</b> &lt;${esc(m.email)}&gt;<br>${fmtDate(m.createdAt)}</p><pre>${esc(m.message)}</pre><div class="row"><a class="btn sm" href="mailto:${esc(m.email)}?subject=${encodeURIComponent('Re: ' + (m.subject || ''))}">Reply</a><button class="btn sm ghost" data-a="read">Mark ${m.isRead ? 'unread' : 'read'}</button><button class="btn sm ghost" data-a="arch">${m.archived ? 'Unarchive' : 'Archive'}</button><button class="btn sm danger" data-a="del">Delete</button><button class="btn sm ghost" data-a="x">Close</button></div>`);
    if (!m.isRead) api('PUT', '/admin/messages/' + m._id, { isRead: true }).then(load).catch(() => {});
    d.onclick = async ev => {
      if (ev.target === d) return d.close();
      const a = ev.target.closest('[data-a]'); if (!a) return;
      try {
        if (a.dataset.a === 'x') return d.close();
        if (a.dataset.a === 'read') await api('PUT', '/admin/messages/' + m._id, { isRead: !m.isRead });
        if (a.dataset.a === 'arch') await api('PUT', '/admin/messages/' + m._id, { archived: !m.archived });
        if (a.dataset.a === 'del') { if (!(await confirmBox('Delete this message permanently?', 'Delete'))) return; await api('DELETE', '/admin/messages/' + m._id); toast('Message deleted'); }
        d.close(); load();
      } catch (err) { fail(err); }
    };
  };
  $('#q').oninput = () => { clearTimeout(t); t = setTimeout(load, 300); };
  $('#box').onchange = load;
  await load();
}

/* ---------- CV ---------- */
async function cvView() {
  title.textContent = 'CV Manager'; loading();
  const list = await api('GET', '/admin/cv');
  view.innerHTML = `<section class="panel"><h3>Upload a new CV (PDF, max 10 MB)</h3><p class="muted">The newest upload becomes the active CV used by the public “Download CV” button.</p><form id="cvf" class="row"><input type="file" accept="application/pdf" required style="max-width:340px"><button class="btn">Upload &amp; activate</button></form></section><div id="cvs" class="cards">${list.length ? list.map(c => `<article class="item"><div class="body"><h4>📄 ${esc(c.originalName)}</h4><p>${kb(c.size)} · ${fmtDate(c.createdAt)}</p><div class="chips">${c.isActiveCv ? '<span class="chip ok">Active</span>' : '<span class="chip">Archived</span>'}</div></div><div class="acts"><button class="btn sm ghost" data-k="prev" data-id="${c._id}">Preview</button>${c.isActiveCv ? '' : `<button class="btn sm" data-k="act" data-id="${c._id}">Set active</button>`}<a class="btn sm ghost" href="${esc(c.url)}" target="_blank" rel="noopener" download>Download</a><button class="btn sm danger" data-k="rm" data-id="${c._id}">Remove</button></div></article>`).join('') : '<div class="empty">No CV uploaded yet.</div>'}</div>`;
  $('#cvf').onsubmit = async e => {
    e.preventDefault(); const b = $('button', e.target); b.disabled = true;
    try { const fd = new FormData(); fd.append('purpose', 'cv'); fd.append('file', $('input', e.target).files[0]); await api('POST', '/admin/upload', fd); toast('CV uploaded and set as active'); cvView(); } catch (x) { fail(x); b.disabled = false; }
  };
  $('#cvs').onclick = async e => {
    const b = e.target.closest('[data-k]'); if (!b) return; const c = list.find(x => x._id === b.dataset.id);
    try {
      if (b.dataset.k === 'prev') modal(`<h3>${esc(c.originalName)}</h3><iframe class="pdf" src="${esc(c.url)}" title="CV preview"></iframe><p><a href="${esc(c.url)}" target="_blank" rel="noopener">Open in new tab</a></p>`);
      if (b.dataset.k === 'act') { await api('POST', `/admin/cv/${c._id}/activate`); toast('Active CV updated'); cvView(); }
      if (b.dataset.k === 'rm' && await confirmBox(`Remove “${c.originalName}”?`, 'Remove')) { await api('DELETE', '/admin/media/' + c._id); toast('CV removed'); cvView(); }
    } catch (x) { fail(x); }
  };
}

/* ---------- media ---------- */
async function media() {
  title.textContent = 'Media Library';
  const P = ['project', 'gallery', 'profile', 'journal', 'branding', 'media'];
  view.innerHTML = `<section class="panel"><h3>Upload</h3><form id="uf" class="row"><select name="purpose" style="width:auto">${P.map(p => `<option>${p}</option>`).join('')}</select><input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/x-icon" required style="max-width:320px"><button class="btn">Upload</button></form></section><div class="bar"><select id="pf"><option value="">All files</option>${[...P, 'cv'].map(p => `<option>${p}</option>`).join('')}</select></div><div id="mg"></div>`;
  let list = [];
  async function load() {
    $('#mg').innerHTML = '<div class="loading"><span class="spin"></span></div>';
    list = await api('GET', '/admin/media' + ($('#pf').value ? '?purpose=' + $('#pf').value : ''));
    $('#mg').innerHTML = list.length ? `<div class="media">${list.map(m => `<div class="tile"><div class="pv">${m.resourceType === 'image' ? `<img src="${esc(m.url)}" alt="" loading="lazy">` : '📄'}</div><div class="tb"><div class="chips"><span class="chip">${esc(m.purpose)}</span></div><div>${esc(m.originalName)}</div><div class="muted">${kb(m.size)}</div><div class="row" style="margin-top:6px"><button class="btn sm ghost" data-c="${m._id}">Copy URL</button><button class="btn sm danger" data-d="${m._id}">Delete</button></div></div></div>`).join('')}</div>` : '<div class="empty">No files uploaded.</div>';
  }
  $('#pf').onchange = load;
  $('#uf').onsubmit = async e => {
    e.preventDefault(); const b = $('button', e.target); b.disabled = true;
    try { const fd = new FormData(); fd.append('purpose', e.target.purpose.value); fd.append('file', $('input[type=file]', e.target).files[0]); await api('POST', '/admin/upload', fd); toast('Uploaded'); e.target.reset(); await load(); } catch (x) { fail(x); }
    b.disabled = false;
  };
  $('#mg').onclick = async e => {
    const c = e.target.closest('[data-c]'), d = e.target.closest('[data-d]');
    try {
      if (c) { const m = list.find(x => x._id === c.dataset.c); await navigator.clipboard.writeText(new URL(m.url, location.origin).href); toast('URL copied'); }
      if (d && await confirmBox('Delete this file? Pages using it will show a broken image.', 'Delete')) { await api('DELETE', '/admin/media/' + d.dataset.d); toast('File deleted'); load(); }
    } catch (x) { fail(x); }
  };
  await load();
}

/* ---------- settings ---------- */
async function settings() {
  title.textContent = 'Portfolio Settings'; loading();
  const [s, p] = await Promise.all([api('GET', '/admin/settings'), api('GET', '/admin/profile')]);
  const keys = ['about', 'skills', 'projects', 'journal', 'cv', 'contact'];
  const data = { ...s.toObject?.() ?? s, photo: p.photo };
  keys.forEach(k => (data['sec_' + k] = !s.sections || s.sections[k] !== false));
  const fields = [
    { t: 'sub', l: 'Branding' }, { n: 'portfolioName', l: 'Portfolio name', req: 1 }, { n: 'logo', l: 'Website logo', t: 'image', purpose: 'branding' },
    { n: 'favicon', l: 'Browser favicon', t: 'image', purpose: 'branding' }, { n: 'photo', l: 'Profile photograph (shared with About Me)', t: 'image', purpose: 'profile' },
    { t: 'sub', l: 'SEO' }, { n: 'description', l: 'Website description', t: 'textarea', rows: 2, w: 'full', max: 500 }, { n: 'seoTitle', l: 'SEO title', max: 70 }, { n: 'seoDescription', l: 'SEO description', t: 'textarea', rows: 2, max: 170 },
    { t: 'sub', l: 'Contact & links' }, { n: 'contactEmail', l: 'Contact email', t: 'email' }, { n: 'phone', l: 'Phone number' }, { n: 'githubUrl', l: 'GitHub URL', t: 'url' }, { n: 'linkedinUrl', l: 'LinkedIn URL', t: 'url' }, { n: 'whatsapp', l: 'WhatsApp number (with country code)' },
    { t: 'sub', l: 'Appearance & availability' }, { n: 'theme', l: 'Theme', t: 'select', opts: ['auto', 'light', 'dark'] }, { n: 'accentColor', l: 'Accent colour', t: 'color' },
    { n: 'footerText', l: 'Footer information', w: 'full', max: 300 }, { n: 'availability', l: 'Professional availability', t: 'select', opts: [['available', 'Available for work'], ['limited', 'Limited availability'], ['unavailable', 'Not available']] }, { n: 'availabilityNote', l: 'Availability note (optional)', max: 200 },
    { t: 'sub', l: 'Show these sections on the public site' }, ...keys.map(k => ({ n: 'sec_' + k, l: k[0].toUpperCase() + k.slice(1), t: 'bool' }))
  ];
  view.innerHTML = '<section class="panel" id="fm"></section>';
  $('#fm').append(buildForm(fields, data, {
    buttons: '<button class="btn">Save settings</button>',
    onSubmit: async d => {
      const photo = d.photo; delete d.photo;
      d.sections = {}; keys.forEach(k => { d.sections[k] = d['sec_' + k]; delete d['sec_' + k]; });
      await api('PUT', '/admin/settings', d); await api('PUT', '/admin/profile', { photo });
      toast('Settings saved');
    }
  }));
}

/* ---------- security ---------- */
async function security() {
  title.textContent = 'Security Settings'; loading();
  const me = await api('GET', '/auth/me');
  view.innerHTML = `<section class="panel"><h3>Account</h3><p>Signed in as <b>${esc(me.email)}</b><br><small class="muted">Last login: ${fmtDate(me.lastLoginAt) || 'n/a'}</small></p></section><section class="panel"><h3>Change password</h3><div id="fm"></div><p class="muted">Forgot your password? Set <code>ADMIN_RESET_TOKEN</code> on the server, then POST to <code>/api/auth/reset</code> (see README).</p></section>`;
  $('#fm').append(buildForm([{ n: 'currentPassword', l: 'Current password', t: 'password', req: 1 }, { n: 'newPassword', l: 'New password (10+ chars, letters and numbers)', t: 'password', req: 1 }, { n: 'confirm', l: 'Confirm new password', t: 'password', req: 1 }], {}, {
    buttons: '<button class="btn">Update password</button>',
    onSubmit: async (d, _, f) => {
      if (d.newPassword !== d.confirm) throw new Error('Passwords do not match');
      await api('POST', '/auth/change-password', { currentPassword: d.currentPassword, newPassword: d.newPassword });
      f.reset(); toast('Password updated');
    }
  }));
}

/* ---------- shell & routing ---------- */
const NAV = [['dashboard', 'Dashboard', '▦', dashboard], ['projects', 'Projects', '▣', projects], ['skills', 'Skills', '✦', skills], ['journal', 'Developer Journal', '✎', journal], ['about', 'About Me', '☺', about], ['cv', 'CV Manager', '▤', cvView], ['messages', 'Contact Messages', '✉', messages], ['media', 'Media Library', '▨', media], ['settings', 'Portfolio Settings', '⚙', settings], ['security', 'Security Settings', '🔒', security]];
$('#nav').innerHTML = NAV.map(n => `<a href="#${n[0]}" data-p="${n[0]}"><span>${n[2]}</span>${n[1]}</a>`).join('') + '<hr><a href="/" target="_blank" rel="noopener"><span>↗</span>View Public Portfolio</a><button id="lo"><span>⏻</span>Logout</button>';
$('#lo').onclick = async () => { await fetch('/api/auth/logout', { method: 'POST' }); location.href = '/admin/login'; };
$('#menu').onclick = () => $('#side').classList.toggle('open');
async function route() {
  const [pg, sub] = (location.hash.slice(1) || 'dashboard').split('/');
  const item = NAV.find(n => n[0] === pg) || NAV[0];
  $$('#nav a[data-p]').forEach(a => a.classList.toggle('on', a.dataset.p === item[0]));
  $('#side').classList.remove('open'); loading();
  try { await item[3](sub); } catch (e) { fail(e); view.innerHTML = `<div class="empty">Something went wrong: ${esc(e.message)}</div>`; }
}
addEventListener('hashchange', route);
route();
})();
