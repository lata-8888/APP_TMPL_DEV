/* App Template – Vanilla-JS-PWA (kein Build-Schritt). Login per Handynummer + PIN, Events, Admin, Profil. de/en. */
(function () {
  'use strict';

  /* ---------- Konfiguration & Supabase ---------- */
  var cfg = window.APP_CONFIG || {};
  var configured = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && cfg.SUPABASE_URL.indexOf('DEIN-PROJEKT') === -1);
  var sb = configured && window.supabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  };

  /* ---------- Sprachen (de, en) ---------- */
  var LANGS = ['de', 'en'], LANG_NAMES = { de: 'Deutsch', en: 'English' }, LOCALE = { de: 'de-CH', en: 'en-GB' };
  var DICT = window.APP_DICT || {}, lang = 'de';
  function L(key, p) {
    var s = (DICT[lang] && DICT[lang][key]) || (DICT.de && DICT.de[key]) || key;
    if (p) Object.keys(p).forEach(function (k) { s = s.split('{' + k + '}').join(p[k]); });
    return s;
  }
  function setLang(l) {
    if (LANGS.indexOf(l) < 0) return;
    lang = l; document.documentElement.lang = l;
    try { localStorage.setItem('app-lang', l); } catch (e) { /* ignorieren */ }
  }
  (function () {
    var l = null;
    try { l = localStorage.getItem('app-lang'); } catch (e) { /* ignorieren */ }
    if (LANGS.indexOf(l) < 0) l = (navigator.language || 'de').slice(0, 2);
    setLang(LANGS.indexOf(l) > -1 ? l : 'de');
  })();

  /* ---------- Darstellung: Hell / Dunkel / Automatisch ('' = automatisch) ---------- */
  var theme = '';
  try { var t0 = localStorage.getItem('app-theme'); if (t0 === 'light' || t0 === 'dark') theme = t0; } catch (e) { /* ignorieren */ }
  function applyTheme() { if (theme) document.documentElement.setAttribute('data-theme', theme); else document.documentElement.removeAttribute('data-theme'); }
  applyTheme();
  function setTheme(t) {
    theme = (t === 'light' || t === 'dark') ? t : '';
    try { if (theme) localStorage.setItem('app-theme', theme); else localStorage.removeItem('app-theme'); } catch (e) { /* ignorieren */ }
    applyTheme();
  }

  /* ---------- Telefon & PIN ---------- */
  // Akzeptiert 079 123 45 67, +41 79 …, 0041 79 …; gespeichert wird +41791234567.
  function normPhone(raw) {
    var d = String(raw).replace(/\(0\)/g, '').replace(/[^\d+]/g, '');
    if (d.indexOf('00') === 0) d = '+' + d.slice(2);
    else if (d.indexOf('0') === 0) d = '+' + (cfg.DEFAULT_COUNTRY_CODE || '41') + d.slice(1);
    else if (d.indexOf('+') !== 0) d = '+' + d;
    return /^\+\d{9,15}$/.test(d) ? d : null;
  }
  function fmtPhone(p) { return /^\+41\d{9}$/.test(p) ? '+41 ' + p.slice(3, 5) + ' ' + p.slice(5, 8) + ' ' + p.slice(8, 10) + ' ' + p.slice(10) : p; }
  function defaultPin(p) { return String(p).replace(/\D/g, '').slice(-6); }
  function pinWeak(pin, phone) {
    if (!/^\d{6}$/.test(pin)) return false;
    if (/^(\d)\1{5}$/.test(pin)) return true;
    var d = pin.split('').map(Number), up = true, down = true;
    for (var i = 1; i < 6; i++) { if (d[i] !== d[i - 1] + 1) up = false; if (d[i] !== d[i - 1] - 1) down = false; }
    return up || down || (!!phone && pin === defaultPin(phone));
  }
  // EMAIL_DOMAIN steht in config.js UND in app_settings (schema.sql) – beide müssen übereinstimmen.
  function phoneToEmail(p) { return p.replace('+', '') + '@' + (cfg.EMAIL_DOMAIN || 'phone-login.app'); }

  /* ---------- Zustand ---------- */
  var S = { step: 'login', err: '', busy: false, session: null, me: null, members: [], events: [], resp: [], tab: 'events', adminTab: 'events', phone: '' };
  var installEvt = null;
  var isAdmin = function () { return !!(S.me && S.me.is_admin); };

  /* ---------- UI-Bausteine ---------- */
  var toastTimer;
  function toast(msg) {
    var el = document.getElementById('toast'); if (!el) return;
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.classList.remove('show'); }, 3200);
  }
  // Bottom-Sheet mit Formular → Promise(Werte | null)
  function askForm(title, fields, okLabel, intro) {
    return new Promise(function (resolve) {
      var wrap = document.createElement('div'); wrap.className = 'ccsheet-bg';
      wrap.innerHTML = '<form class="ccsheet" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><h3>' + esc(title) + '</h3>' +
        (intro ? '<p class="muted">' + esc(intro) + '</p>' : '') +
        fields.map(function (f) {
          return '<label class="fld"><span>' + esc(f.label) + '</span><input name="' + f.name + '" type="' + (f.type || 'text') + '" value="' + esc(f.value || '') + '" autocomplete="off"></label>';
        }).join('') +
        '<div class="row"><button type="button" class="btn ghost" data-x="cancel">' + esc(L('cancel')) + '</button><button class="btn" type="submit">' + esc(okLabel || L('save')) + '</button></div></form>';
      document.body.appendChild(wrap);
      var form = wrap.querySelector('form'), close = function (v) { wrap.remove(); resolve(v); };
      wrap.addEventListener('click', function (e) { if (e.target === wrap || e.target.dataset.x === 'cancel') close(null); });
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var out = {}; fields.forEach(function (f) { out[f.name] = form.elements[f.name].value.trim(); });
        close(out);
      });
      var first = form.querySelector('input'); if (first) first.focus();
    });
  }
  function askConfirm(title, message, danger) {
    return new Promise(function (resolve) {
      var wrap = document.createElement('div'); wrap.className = 'ccsheet-bg';
      wrap.innerHTML = '<div class="ccsheet" role="alertdialog" aria-modal="true"><h3>' + esc(title) + '</h3><p>' + esc(message) + '</p>' +
        '<div class="row"><button class="btn ghost" data-v="0">' + esc(L('cancel')) + '</button><button class="btn' + (danger ? ' danger' : '') + '" data-v="1">' + esc(L('confirm')) + '</button></div></div>';
      document.body.appendChild(wrap);
      wrap.addEventListener('click', function (e) {
        if (e.target === wrap) { wrap.remove(); resolve(false); }
        else if (e.target.dataset.v) { wrap.remove(); resolve(e.target.dataset.v === '1'); }
      });
    });
  }
  function errText(e) {
    var m = (e && e.message) || '';
    if (/PHONE_TAKEN|duplicate key/i.test(m)) return L('phoneTaken');
    if (/DEFAULT_ADMIN_PROTECTED/.test(m)) return L('protectedAdmin');
    return m ? L('error') + ': ' + m : L('error');
  }
  // Aktion → Toast → neu laden → neu zeichnen. Fehler werden angezeigt, nie verschluckt.
  async function act(fn, okMsg) {
    try { await fn(); if (okMsg) toast(okMsg); await loadAll(); render(); return true; }
    catch (e) { console.error(e); toast(errText(e)); return false; }
  }
  var ICON = {
    cal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    user: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>',
    gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg>'
  };

  /* ---------- Daten laden & Live-Aktualisierung ---------- */
  async function loadAll() {
    var uid = S.session.user.id;
    var r = await Promise.all([
      sb.from('profiles').select('*').order('name'),
      sb.from('events').select('*').order('starts_at'),
      sb.from('event_responses').select('*')
    ]);
    r.forEach(function (x) { if (x.error) throw x.error; });
    S.members = r[0].data; S.events = r[1].data; S.resp = r[2].data;
    S.me = S.members.filter(function (m) { return m.id === uid; })[0] || null;
  }
  var reloadTimer, channel;
  function scheduleReload() {
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(function () {
      if (S.step === 'app' && !document.querySelector('.ccsheet-bg')) loadAll().then(render, function (e) { console.error(e); });
    }, 400);
  }
  function subscribe() { if (!channel) channel = sb.channel('app-data').on('postgres_changes', { event: '*', schema: 'public' }, scheduleReload).subscribe(); }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && S.step === 'app') scheduleReload(); });

  /* ---------- Anmeldung ---------- */
  async function handleLogin(g) {
    var phone = normPhone(g('phone'));
    S.phone = g('phone');
    if (!phone) { S.err = L('phoneInvalid'); return render(); }
    var custom = g('pin');
    if (custom && !/^\d{6}$/.test(custom)) { S.err = L('pinExact'); return render(); }
    S.busy = true; S.err = ''; render();
    try {
      var res = await sb.auth.signInWithPassword({ email: phoneToEmail(phone), password: custom || defaultPin(phone) });
      if (res.error) throw res.error;
      S.busy = false; await enter(res.data.session);
    } catch (e) {
      console.error(e); S.busy = false; S.step = 'login';
      S.err = /invalid login|credentials/i.test(e.message || '') ? L('authFail') : errText(e);
      render();
    }
  }
  async function enter(session) {
    S.session = session; S.step = 'loading'; render();
    try {
      await loadAll();
      if (!S.me) throw new Error(L('noProfile'));
      if (S.me.language && LANGS.indexOf(S.me.language) > -1) setLang(S.me.language);
      if (S.me.theme) setTheme(S.me.theme);
      S.tab = 'events'; S.step = 'app'; S.err = ''; subscribe(); render(); window.scrollTo(0, 0);
    } catch (e) { console.error(e); S.step = 'login'; S.err = errText(e); try { await sb.auth.signOut(); } catch (e2) { /* ignorieren */ } render(); }
  }
  async function logout() {
    try { if (channel) { sb.removeChannel(channel); channel = null; } await sb.auth.signOut(); } catch (e) { console.error(e); }
    S.session = null; S.me = null; S.step = 'login'; render();
  }

  /* ---------- Ansichten ---------- */
  function fld(label, name, type, val, extra) {
    return '<label class="fld"><span>' + esc(label) + '</span><input name="' + name + '" type="' + type + '" value="' + esc(val || '') + '" ' + (extra || '') + ' autocomplete="off"></label>';
  }
  function fmtDate(iso) {
    return new Date(iso).toLocaleString(LOCALE[lang], { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function toLocalInput(iso) {
    var d = new Date(iso), p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function nameOf(id) { var m = S.members.filter(function (x) { return x.id === id; })[0]; return m ? m.name : '?'; }

  function viewLogin() {
    return '<main class="authwrap"><div class="authcard"><h1>' + esc(cfg.APP_NAME || 'App') + '</h1><p class="muted">' + esc(L('loginHint')) + '</p>' +
      '<form data-form="login">' + fld(L('phone'), 'phone', 'tel', S.phone, 'inputmode="tel" placeholder="079 123 45 67"') +
      fld(L('pinOptional'), 'pin', 'password', '', 'inputmode="numeric" maxlength="6"') +
      (S.err ? '<p class="err" role="alert">' + esc(S.err) + '</p>' : '') +
      '<button class="btn" type="submit"' + (S.busy ? ' disabled' : '') + '>' + esc(L('login')) + '</button></form></div></main>';
  }

  function eventCard(e) {
    var rs = S.resp.filter(function (r) { return r.event_id === e.id; });
    var yes = rs.filter(function (r) { return r.answer === 'yes'; }), no = rs.filter(function (r) { return r.answer === 'no'; });
    var mine = rs.filter(function (r) { return r.user_id === S.me.id; })[0];
    var names = function (a) { return a.length ? a.map(function (r) { return esc(nameOf(r.user_id)); }).join(', ') : esc(L('evNobody')); };
    var btn = function (v, label) { return '<button class="chip' + (mine && mine.answer === v ? ' on' : '') + '" data-act="answer" data-id="' + e.id + '" data-val="' + v + '" aria-pressed="' + !!(mine && mine.answer === v) + '">' + esc(label) + '</button>'; };
    return '<details class="ccel" data-k="' + e.id + '"><summary><span><strong>' + esc(e.title) + '</strong><br><small class="muted">' + esc(fmtDate(e.starts_at)) + (e.place ? ' · ' + esc(e.place) : '') + '</small></span>' +
      '<small class="muted">' + (mine ? (mine.answer === 'yes' ? '✔ ' + esc(L('evYes')) : '✖ ' + esc(L('evNo'))) : esc(L('evNoAnswer'))) + '</small></summary><div class="ccbody">' +
      (e.description ? '<p>' + esc(e.description) + '</p>' : '') +
      '<div class="chips">' + btn('yes', L('evYes')) + btn('no', L('evNo')) + '</div>' +
      '<p><strong>' + esc(L('evParticipants', { n: yes.length })) + '</strong><br>' + names(yes) + '</p>' +
      '<p><strong>' + esc(L('evDeclined', { n: no.length })) + '</strong><br>' + names(no) + '</p></div></details>';
  }
  function viewEvents() {
    var limit = Date.now() - 3 * 3600e3;
    var up = S.events.filter(function (e) { return new Date(e.starts_at).getTime() >= limit; });
    var past = S.events.filter(function (e) { return new Date(e.starts_at).getTime() < limit; }).reverse();
    return '<h2>' + esc(L('evUpcoming')) + '</h2>' + (up.length ? up.map(eventCard).join('') : '<p class="muted">' + esc(L('evEmpty')) + '</p>') +
      (past.length ? '<h2>' + esc(L('evPast')) + '</h2>' + past.map(eventCard).join('') : '');
  }

  function viewProfile() {
    var opt = function (v, l) { return '<button type="button" class="segbtn' + (theme === v ? ' on' : '') + '" data-act="set-theme" data-val="' + v + '" aria-pressed="' + (theme === v) + '">' + esc(l) + '</button>'; };
    var standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    var install = standalone ? '<p class="muted">' + esc(L('installDone')) + '</p>'
      : installEvt ? '<p class="muted">' + esc(L('installHint')) + '</p><button class="btn" data-act="install">' + esc(L('installBtn')) + '</button>'
      : '<p class="muted">' + esc(ios ? L('installIos') : L('installHint')) + '</p>';
    return '<section class="card"><h2>' + esc(L('myAccount')) + '</h2><p class="muted">' + esc(fmtPhone(S.me.phone)) + ' · ' + esc(S.me.is_admin ? L('roleAdmin') : L('roleUser')) + '</p>' +
      '<form data-form="profile">' + fld(L('fullName'), 'name', 'text', S.me.name) +
      '<label class="fld"><span>' + esc(L('language')) + '</span><select name="language">' + LANGS.map(function (l) { return '<option value="' + l + '"' + (l === lang ? ' selected' : '') + '>' + LANG_NAMES[l] + '</option>'; }).join('') + '</select></label>' +
      '<button class="btn" type="submit">' + esc(L('save')) + '</button></form></section>' +
      '<section class="card"><h2>' + esc(L('theme')) + '</h2><div class="segctl">' + opt('light', L('themeLight')) + opt('dark', L('themeDark')) + opt('', L('themeAuto')) + '</div></section>' +
      '<section class="card"><h2>' + esc(L('pin')) + '</h2><form data-form="pin">' + fld(L('newPin'), 'pin', 'password', '', 'inputmode="numeric" maxlength="6"') +
      '<button class="btn" type="submit">' + esc(L('changePin')) + '</button></form></section>' +
      '<section class="card"><h2>' + esc(L('installTitle')) + '</h2>' + install + '</section>' +
      '<section class="card"><button class="btn ghost" data-act="logout">' + esc(L('logout')) + '</button></section>';
  }

  function viewAdmin() {
    var seg = function (v, l) { return '<button type="button" class="segbtn' + (S.adminTab === v ? ' on' : '') + '" data-act="admin-tab" data-val="' + v + '">' + esc(l) + '</button>'; };
    var head = '<div class="segctl pad0">' + seg('events', L('adminEvents')) + seg('users', L('adminUsers')) + '</div>';
    if (S.adminTab === 'events') {
      var rows = S.events.slice().reverse().map(function (e) {
        return '<section class="card"><strong>' + esc(e.title) + '</strong><br><small class="muted">' + esc(fmtDate(e.starts_at)) + (e.place ? ' · ' + esc(e.place) : '') + '</small>' +
          '<div class="chips mt"><button class="chip" data-act="ev-edit" data-id="' + e.id + '">' + esc(L('edit')) + '</button><button class="chip danger" data-act="ev-del" data-id="' + e.id + '">' + esc(L('del')) + '</button></div></section>';
      }).join('');
      return head + '<section class="card"><button class="btn" data-act="ev-new">' + esc(L('evNew')) + '</button></section>' + (rows || '<p class="muted">' + esc(L('evAdminEmpty')) + '</p>');
    }
    var users = S.members.map(function (m) {
      var self = m.id === S.me.id;
      return '<details class="ccel" data-k="u' + m.id + '"><summary><span>' + esc(m.name) + (m.is_admin ? ' ★' : '') + '</span><small class="muted">' + esc(fmtPhone(m.phone)) + (m.pin_changed ? '' : ' · ' + esc(L('defaultPin'))) + '</small></summary>' +
        '<div class="ccbody"><div class="chips">' +
        (!self ? '<button class="chip" data-act="admin" data-id="' + m.id + '" data-val="' + (!m.is_admin) + '">' + esc(m.is_admin ? L('revokeAdmin') : L('makeAdmin')) + '</button>' : '') +
        '<button class="chip" data-act="edit-user" data-id="' + m.id + '">' + esc(L('edit')) + '</button>' +
        '<button class="chip" data-act="reset-pin" data-id="' + m.id + '">' + esc(L('resetPin')) + '</button>' +
        (!self ? '<button class="chip danger" data-act="remove" data-id="' + m.id + '">' + esc(L('remove')) + '</button>' : '') +
        '</div></div></details>';
    }).join('');
    return head + '<section class="card"><button class="btn" data-act="add-user">' + esc(L('addUser')) + '</button></section>' + users;
  }

  function render() {
    var app = document.getElementById('app'), nav = document.getElementById('nav');
    if (!configured) { app.innerHTML = '<main class="authwrap"><div class="authcard"><h1>Setup</h1><p>' + esc(L('notConfigured')) + '</p></div></main>'; nav.hidden = true; return; }
    if (S.step === 'loading') { app.innerHTML = '<main class="authwrap"><p class="muted">…</p></main>'; nav.hidden = true; return; }
    if (S.step === 'login') { app.innerHTML = viewLogin(); nav.hidden = true; return; }
    var tabs = [{ id: 'events', label: L('navEvents'), icon: ICON.cal }, { id: 'profile', label: L('navProfile'), icon: ICON.user }];
    if (isAdmin()) tabs.push({ id: 'admin', label: L('navAdmin'), icon: ICON.gear });
    if (!tabs.some(function (t) { return t.id === S.tab; })) S.tab = 'events';
    var open = Array.prototype.map.call(document.querySelectorAll('details.ccel[open]'), function (d) { return d.dataset.k; });
    var banner = S.me.pin_changed ? '' : '<div class="pinbanner" role="status">' + esc(L('pinBanner')) + ' <button class="chip" data-act="goto" data-val="profile">' + esc(L('changePin')) + '</button></div>';
    var body = S.tab === 'profile' ? viewProfile() : S.tab === 'admin' ? viewAdmin() : viewEvents();
    app.innerHTML = banner + '<div class="shell">' + body + '</div>';
    nav.hidden = false;
    nav.innerHTML = tabs.map(function (t) {
      return '<button class="tab' + (t.id === S.tab ? ' on' : '') + '" data-act="goto" data-val="' + t.id + '" aria-current="' + (t.id === S.tab) + '">' + t.icon + '<span>' + esc(t.label) + '</span></button>';
    }).join('');
    open.forEach(function (k) { var d = document.querySelector('details.ccel[data-k="' + k + '"]'); if (d) d.open = true; });
  }

  /* ---------- Ereignisse ---------- */
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('form[data-form]'); if (!f) return;
    e.preventDefault();
    var g = function (n) { return f.elements[n] ? f.elements[n].value.trim() : ''; }, kind = f.dataset.form;
    if (kind === 'login') return handleLogin(g);
    if (kind === 'profile') {
      return act(async function () {
        var r = await sb.from('profiles').update({ name: g('name'), language: g('language') }).eq('id', S.me.id); if (r.error) throw r.error;
        setLang(g('language'));
      }, L('saved'));
    }
    if (kind === 'pin') {
      if (!/^\d{6}$/.test(g('pin'))) return toast(L('pinExact'));
      if (pinWeak(g('pin'), S.me.phone)) return toast(L('pinWeak'));
      return act(async function () {
        var r = await sb.auth.updateUser({ password: g('pin') }); if (r.error) throw r.error;
        r = await sb.from('profiles').update({ pin_changed: true }).eq('id', S.me.id); if (r.error) throw r.error;
      }, L('pinChanged'));
    }
  });

  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvt = e; if (S.step === 'app') render(); });

  async function eventForm(ev) {
    var f = await askForm(ev ? L('evEdit') : L('evNew'), [
      { name: 'title', label: L('evTitle'), value: ev && ev.title }, { name: 'place', label: L('evPlace'), value: ev && ev.place },
      { name: 'description', label: L('evDesc'), value: ev && ev.description }, { name: 'when', label: L('evWhen'), type: 'datetime-local', value: ev ? toLocalInput(ev.starts_at) : '' }
    ]);
    if (!f) return;
    if (!f.title || !f.when) return toast(L('evMissing'));
    var row = { title: f.title, place: f.place || null, description: f.description || null, starts_at: new Date(f.when).toISOString() };
    return act(async function () {
      var r = ev ? await sb.from('events').update(row).eq('id', ev.id) : await sb.from('events').insert(row);
      if (r.error) throw r.error;
    }, L('saved'));
  }

  document.addEventListener('click', async function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return;
    var a = el.dataset.act, id = el.dataset.id, v = el.dataset.val;
    var member = S.members.filter(function (m) { return m.id === id; })[0];
    var ev = S.events.filter(function (x) { return x.id === id; })[0];
    var rpc = function (fn, args, msg) { return act(async function () { var r = await sb.rpc(fn, args); if (r.error) throw r.error; }, msg); };
    switch (a) {
      case 'goto': S.tab = v; render(); return window.scrollTo(0, 0);
      case 'admin-tab': S.adminTab = v; return render();
      case 'logout': return logout();
      case 'install': if (installEvt) { installEvt.prompt(); installEvt = null; render(); } return;
      case 'set-theme':
        setTheme(v); render();
        sb.from('profiles').update({ theme: v || null }).eq('id', S.me.id).then(function () {}, function () {});
        return;
      case 'answer': {
        var mine = S.resp.filter(function (r) { return r.event_id === id && r.user_id === S.me.id; })[0];
        return act(async function () {
          var r = mine && mine.answer === v ? await sb.from('event_responses').delete().eq('event_id', id).eq('user_id', S.me.id)
            : await sb.from('event_responses').upsert({ event_id: id, user_id: S.me.id, answer: v });
          if (r.error) throw r.error;
        });
      }
      case 'ev-new': return eventForm(null);
      case 'ev-edit': return eventForm(ev);
      case 'ev-del':
        if (isAdmin() && await askConfirm(L('del'), L('evDeleteAsk', { name: ev.title }), true))
          return act(async function () { var r = await sb.from('events').delete().eq('id', id); if (r.error) throw r.error; }, L('removed'));
        return;
      case 'admin': return rpc('set_admin', { target: id, make_admin: v === 'true' }, L('saved'));
      case 'reset-pin':
        if (await askConfirm(L('resetPin'), L('resetPinAsk', { name: member.name }))) return rpc('reset_pin', { target: id }, L('pinReset'));
        return;
      case 'remove':
        if (await askConfirm(L('remove'), L('removeAsk', { name: member.name }), true)) return rpc('remove_member', { target: id }, L('removed'));
        return;
      case 'edit-user': {
        var r = await askForm(L('edit'), [{ name: 'name', label: L('fullName'), value: member.name }, { name: 'phone', label: L('phone'), value: member.phone, type: 'tel' }], null, L('editPhoneNote'));
        if (!r) return;
        var ph = normPhone(r.phone); if (!ph) return toast(L('phoneInvalid'));
        return rpc('admin_update_member', { target: id, new_name: r.name, new_phone: ph }, L('saved'));
      }
      case 'add-user': {
        var f = await askForm(L('addUser'), [{ name: 'name', label: L('fullName') }, { name: 'phone', label: L('phone'), type: 'tel' }], L('addUser'), L('addUserNote'));
        if (!f) return;
        var p2 = normPhone(f.phone); if (!f.name || !p2) return toast(L('phoneInvalid'));
        return rpc('admin_create_user', { p_name: f.name, p_phone: p2 }, L('userAdded'));
      }
    }
  });

  /* ---------- Start ---------- */
  async function start() {
    render();
    if (!configured) return;
    try {
      var s = await sb.auth.getSession();
      if (s.data && s.data.session) await enter(s.data.session); else { S.step = 'login'; render(); }
    } catch (e) { console.error(e); S.step = 'login'; render(); }
  }
  document.addEventListener('DOMContentLoaded', start);
  if ('serviceWorker' in navigator) window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
})();
