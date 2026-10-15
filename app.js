/* App Template – Vanilla-JS-PWA (kein Build-Schritt). Login per Handynummer + PIN, Events, Admin, Profil. de/en. */
(function () {
  'use strict';

  /* ---------- Konfiguration & Supabase ---------- */
  var cfg = window.APP_CONFIG || {};
  var SFX = cfg.STORAGE_SUFFIX || '';   // trennt lokale Einstellungen, wenn mehrere Apps denselben Ursprung teilen (in der Vorlage leer)
  var configured = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && cfg.SUPABASE_URL.indexOf('DEIN-PROJEKT') === -1);
  var sb = configured && window.supabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  };

  /* ---------- Sprachen (de, en, nl) ---------- */
  var LANGS = ['de', 'en', 'nl'], LANG_NAMES = { de: 'Deutsch', en: 'English', nl: 'Nederlands' }, LOCALE = { de: 'de-CH', en: 'en-GB', nl: 'nl-NL' };
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
    // Reihenfolge: eigene Wahl → Standardsprache der App (zuletzt bekannt) → Gerätesprache
    if (LANGS.indexOf(l) < 0) { try { l = localStorage.getItem('app-default-lang'); } catch (e) { /* ignorieren */ } }
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

  /* ---------- Design (vom Admin für alle gewählt; in app_settings gespeichert, lokal zwischengespeichert) ---------- */
  var DESIGNS = [
    { id: 'light', colors: ['#4A5568', '#EDEFF2', '#FBFBFC'] },
    { id: 'standard', colors: ['#307CC0', '#E3EFF9', '#F3F4F0'] },
    { id: 'petrol', colors: ['#0E5F6F', '#2BAFC4', '#EAF4F6'] },
    { id: 'holland', colors: ['#EA580C', '#F97316', '#FFF7ED'] }
  ];
  var design = 'standard';        // wirksames Design (eigene Wahl, sonst Standard des Admins)
  var adminDesign = 'standard';   // Standard-Design der App (vom Admin)
  function applyDesign(d) {
    if (!DESIGNS.some(function (x) { return x.id === d; })) d = 'standard';
    design = d; document.documentElement.setAttribute('data-design', d);
    try { localStorage.setItem('app-design', d); } catch (e) { /* ignorieren */ }
  }
  try { applyDesign(localStorage.getItem('app-design')); } catch (e) { applyDesign('standard'); }

  /* ---------- Telefon & PIN ---------- */
  // Akzeptiert 079 123 45 67, +41 79 …, 0041 79 …; gespeichert wird +41791234567.
  /* Handynummer-Eingabe (wie in der FBRO-App): Länderauswahl (CH/DE/Andere) + Nummer ohne führende Null.
     Gespeichert wird das internationale Format (+41791234567). */
  var PHONE_CC = [{ c: '41', l: 'CH +41', ph: '79 123 45 67' }, { c: '49', l: 'DE +49', ph: '176 12345678' }];
  function ccInfo(c) { return PHONE_CC.filter(function (x) { return x.c === c; })[0] || null; }
  function fmtNational(cc, n) {
    n = String(n).replace(/\D/g, '');
    if (cc === '41') return [n.slice(0, 2), n.slice(2, 5), n.slice(5, 7), n.slice(7, 9)].filter(Boolean).join(' ');
    if (cc === '49') return [n.slice(0, 3), n.slice(3)].filter(Boolean).join(' ');
    return n;
  }
  // '+41796232345' → { cc: '41', nat: '79 623 23 45' }; unbekanntes Land → { cc: '', nat: '+43…' }
  function phoneParts(intl) {
    var raw = String(intl || '');
    var d = raw.replace(/\D/g, '');
    if (/^\+\d/.test(raw.replace(/\s/g, ''))) {
      for (var i = 0; i < PHONE_CC.length; i++) {
        if (d.indexOf(PHONE_CC[i].c) === 0) return { cc: PHONE_CC[i].c, nat: fmtNational(PHONE_CC[i].c, d.slice(PHONE_CC[i].c.length)) };
      }
      return { cc: '', nat: raw.replace(/\s/g, '') };
    }
    return { cc: '41', nat: fmtNational('41', d.replace(/^0+/, '')) };
  }
  // Länderwahl + Eingabe → Nummer für normPhone(). Eine vollständig internationale Eingabe (+… / 00…) gilt immer.
  function composePhone(cc, raw) {
    raw = String(raw || '').trim();
    if (/^(\+|00)/.test(raw.replace(/\s/g, ''))) return raw;
    if (!cc) return raw;
    var d = raw.replace(/\(0\)/g, '').replace(/\D/g, '');
    if (cc === '41' && d.length === 11 && d.indexOf('41') === 0) d = d.slice(2);   // «41 79 …» ohne +
    d = d.replace(/^0+/, '');
    return d ? '+' + cc + d : '';
  }
  function phoneField(intl, autoc) {
    var pp = phoneParts(intl), info = ccInfo(pp.cc);
    return '<div class="phonerow">' +
      '<select class="phonecc" name="phonecc" aria-label="' + esc(L('phoneCountry')) + '">' +
      PHONE_CC.map(function (x) { return '<option value="' + x.c + '"' + (pp.cc === x.c ? ' selected' : '') + '>' + x.l + '</option>'; }).join('') +
      '<option value=""' + (pp.cc === '' ? ' selected' : '') + '>' + esc(L('phoneOther')) + '</option></select>' +
      '<input name="phone" type="tel" inputmode="tel" autocomplete="' + (autoc || 'off') + '" placeholder="' + esc(info ? info.ph : '+43 …') + '" value="' + esc(pp.nat) + '"></div>';
  }
  function normPhone(raw, cc) {
    var d = String(raw).replace(/\(0\)/g, '').replace(/[^\d+]/g, '');
    if (d.indexOf('00') === 0) d = '+' + d.slice(2);
    else if (d.indexOf('0') === 0) d = '+' + (cc || cfg.DEFAULT_COUNTRY_CODE || '41') + d.slice(1);
    else if (d.indexOf('+') !== 0) d = '+' + d;
    return /^\+\d{9,15}$/.test(d) ? d : null;
  }
  // Anzeige: Schweizer Nummern immer als 079 123 45 67
  function fmtPhone(p) {
    if (/^\+41\d{9}$/.test(p)) return '0' + p.slice(3, 5) + ' ' + p.slice(5, 8) + ' ' + p.slice(8, 10) + ' ' + p.slice(10);
    if (/^\+49\d{10,11}$/.test(p)) return '+49 ' + p.slice(3, 6) + ' ' + p.slice(6);
    return p;
  }
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
  var S = { step: 'login', err: '', busy: false, session: null, me: null, members: [], events: [], resp: [], tasks: [], tab: 'events', sec: {}, open: {}, phone: '' };
  // Admin: alle Teilbereiche sind beim Öffnen eingeklappt
  var ADMIN_KEYS = ['events', 'members', 'recur', 'design', 'lang', 'a-tasks', 'g-user', 'g-guest'];
  ADMIN_KEYS.forEach(function (k) { S.sec[k] = false; });
  var installEvt = null;
  var isAdmin = function () { return !!(S.me && S.me.is_admin); };
  var canManageEvents = function () { return !!(S.me && (S.me.is_admin || S.me.is_event_manager)); };   // Admin oder Event Manager
  var roleLabels = function (m) {
    var r = [m.is_guest ? L('roleGuest') : L('roleUser')];
    if (m.is_admin) r.push(L('roleAdmin'));
    if (m.is_event_manager) r.push(L('roleEM'));
    return r;
  };

  /* ---------- UI-Bausteine ---------- */
  var toastTimer;
  function toast(msg) {
    var el = document.getElementById('toast'); if (!el) return;
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.classList.remove('show'); }, 3200);
  }
  // Bottom-Sheet mit Formular → Promise(Werte | null)
  function askForm(title, fields, okLabel, intro, extra) {
    return new Promise(function (resolve) {
      var wrap = document.createElement('div'); wrap.className = 'ccsheet-bg';
      wrap.innerHTML = '<form class="ccsheet" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><h3>' + esc(title) + '</h3>' +
        (intro ? '<p class="muted">' + esc(intro) + '</p>' : '') +
        fields.map(function (f, i) {
          var html;
          if (f.type === 'checkbox') html = '<label class="check"><input type="checkbox" name="' + f.name + '"' + (f.value ? ' checked' : '') + '><span>' + esc(f.label) + '</span></label>';
          else if (f.type === 'recurrence') html = recurrenceBlock();
          else if (f.type === 'note') html = '<p class="muted small recinfo">' + esc(f.text) + '</p>';
          else if (f.type === 'phone') html = '<div class="fld"><span>' + esc(f.label) + '</span>' + phoneField(f.value) + '</div>';
          else if (f.type === 'select') html = '<label class="fld"><span>' + esc(f.label) + '</span><select name="' + f.name + '">' + f.options.map(function (o) {
            return '<option value="' + esc(o.v) + '"' + (o.v === f.value ? ' selected' : '') + '>' + esc(o.l) + '</option>';
          }).join('') + '</select></label>';
          else html = '<label class="fld"><span>' + esc(f.label) + '</span><input name="' + f.name + '" type="' + (f.type || 'text') + '" value="' + esc(f.value || '') + '" autocomplete="off"></label>';
          // aufeinanderfolgende Felder mit half:true stehen nebeneinander (z. B. Datum | Zeit)
          var prev = fields[i - 1], next = fields[i + 1];
          if (f.half && !(prev && prev.half)) html = '<div class="grid2">' + html;
          if (f.half && !(next && next.half)) html += '</div>';
          return html;
        }).join('') +
        (extra ? '<button type="button" class="btn danger" data-x="extra">' + esc(extra) + '</button>' : '') + '<div class="row"><button type="button" class="btn ghost" data-x="cancel">' + esc(L('cancel')) + '</button><button class="btn" type="submit">' + esc(okLabel || L('save')) + '</button></div></form>';
      document.body.appendChild(wrap);
      var form = wrap.querySelector('form'), close = function (v) { wrap.remove(); resolve(v); };
      wrap.addEventListener('click', function (e) { if (e.target === wrap || e.target.dataset.x === 'cancel') close(null); else if (e.target.dataset.x === 'extra') close({ __extra: true }); });
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var out = {};
        fields.forEach(function (f) {
          if (f.type === 'note') return;
          if (f.type === 'recurrence') {
            out.every = parseInt(form.elements.every.value, 10) || 1;
            out.unit = form.elements.unit.value;
            out.wd = form.elements.wd.value ? [parseInt(form.elements.wd.value, 10)] : [];
            return;
          }
          var el = form.elements[f.name];
          out[f.name] = f.type === 'checkbox' ? el.checked : f.type === 'phone' ? composePhone(form.elements.phonecc ? form.elements.phonecc.value : '', el.value) : el.value.trim();
        });
        close(out);
      });
      // Wiederholungs-Block nur zeigen, wenn «Wiederkehrend» angehakt ist; Wochentage nur bei «Woche»
      var recBlock = form.querySelector('[data-dep]');
      if (recBlock) {
        var refresh = function () {
          var src = form.elements[recBlock.dataset.dep];
          recBlock.hidden = !(src && src.checked);
          var wk = recBlock.querySelector('[data-unit]');
          if (wk) wk.hidden = form.elements.unit.value !== wk.dataset.unit;
        };
        form.addEventListener('change', refresh); refresh();
      }
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
    if (/GUEST_NOT_ALLOWED/.test(m)) return L('guestNoAdmin');
    if (/TASK_FORBIDDEN/.test(m)) return L('taskForbidden');
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
    guest: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="8" r="4"/><path d="M2 21c0-4 3.5-7 8-7M17 14v6M14 17h6"/></svg>',
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
    gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.3 4.3c.4-1.8 2.9-1.8 3.4 0a1.7 1.7 0 0 0 2.6 1.1c1.5-.9 3.3.8 2.4 2.4a1.7 1.7 0 0 0 1 2.5c1.8.4 1.8 2.9 0 3.4a1.7 1.7 0 0 0-1 2.6c.9 1.5-.8 3.3-2.4 2.4a1.7 1.7 0 0 0-2.6 1c-.4 1.8-2.9 1.8-3.4 0a1.7 1.7 0 0 0-2.6-1c-1.5.9-3.3-.8-2.4-2.4a1.7 1.7 0 0 0-1-2.6c-1.8-.4-1.8-2.9 0-3.4a1.7 1.7 0 0 0 1-2.5c-.9-1.6.8-3.3 2.4-2.4c1 .6 2.3 0 2.6-1.1z"/><circle cx="12" cy="12" r="3"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>',
    tasks: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6h10M10 12h10M10 18h10"/><path d="M3.5 6l1.5 1.5L7.5 5M3.5 12l1.5 1.5L7.5 11M3.5 18l1.5 1.5L7.5 17"/></svg>',
    dots: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>',
    chev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>'
  };

  /* ---------- Daten laden & Live-Aktualisierung ---------- */
  async function loadAll() {
    var uid = S.session.user.id;
    var r = await Promise.all([
      sb.from('profiles').select('*').order('name'),
      sb.from('events').select('*').order('starts_at'),
      sb.from('event_responses').select('*'),
      sb.rpc('app_design'),
      sb.rpc('app_language'),
      sb.from('tasks').select('*').order('due_date')
    ]);
    r.forEach(function (x) { if (x.error) throw x.error; });
    S.members = r[0].data; S.events = r[1].data; S.resp = r[2].data; S.tasks = r[5].data;
    adminDesign = DESIGNS.some(function (x) { return x.id === r[3].data; }) ? r[3].data : 'standard';
    S.defaultLang = LANGS.indexOf(r[4].data) > -1 ? r[4].data : 'de';
    try { localStorage.setItem('app-default-lang', S.defaultLang); } catch (e) { /* ignorieren */ }
    S.me = S.members.filter(function (m) { return m.id === uid; })[0] || null;
    // jede Person kann ihr Design selbst wählen; ohne eigene Wahl gilt das Standard-Design des Admins
    applyDesign(S.me && DESIGNS.some(function (x) { return x.id === S.me.design; }) ? S.me.design : adminDesign);
    // Sprache: eigene Wahl im Profil, sonst die Standardsprache der App
    if (S.me) setLang(LANGS.indexOf(S.me.language) > -1 ? S.me.language : S.defaultLang);
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
      extendSeries().then(function () { render(); }, function (e2) { console.error(e2); });
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
      '<form data-form="login"><div class="fld"><span>' + esc(L('phone')) + '</span>' + phoneField(S.phone, 'tel') + '</div>' +
      fld(L('pinOptional'), 'pin', 'password', '', 'inputmode="numeric" maxlength="6"') +
      (S.err ? '<p class="err" role="alert">' + esc(S.err) + '</p>' : '') +
      '<button class="btn" type="submit"' + (S.busy ? ' disabled' : '') + '>' + esc(L('login')) + '</button></form></div></main>';
  }

  function eventCard(e) {
    var rs = S.resp.filter(function (r) { return r.event_id === e.id; });
    var yes = rs.filter(function (r) { return r.answer === 'yes'; }), no = rs.filter(function (r) { return r.answer === 'no'; });
    var mine = rs.filter(function (r) { return r.user_id === S.me.id; })[0];
    var open = !!S.open['ev:' + e.id];
    // Namen als Pillen; Gäste mit Rand, die eigene Person fett – wie in der FBRO-App
    var pills = function (a) {
      return a.length ? a.map(function (r) {
        var m = S.members.filter(function (x) { return x.id === r.user_id; })[0] || {}, me = r.user_id === S.me.id;
        return '<span class="ccp' + (m.is_guest ? ' g' : '') + (me ? ' me' : '') + '">' + esc(m.name || '?') + (me ? ' ' + esc(L('you')) : '') + '</span>';
      }).join('') : '<span class="small muted">' + esc(L('evNobody')) + '</span>';
    };
    var btn = function (v, cls, label) { return '<button type="button" class="resp ' + cls + '" data-act="answer" data-id="' + e.id + '" data-val="' + v + '" aria-pressed="' + !!(mine && mine.answer === v) + '">' + esc(label) + '</button>'; };
    var info = !!S.open['evc:' + e.id];   // Zeit und Ort: standardmässig eingeklappt
    var infoHtml = info ? '<p class="muted small">' + esc(e.time_set === false ? L('evNoTime') : fmtTime(e.starts_at)) + (e.place ? ' · ' + esc(e.place) : '') + '</p>' : '';
    // Antwort-Knöpfe nur, wenn für das Event eine Teilnahme nötig ist (rsvp)
    var rsvpHtml = e.rsvp === false ? '' :
      '<div class="actrow">' + btn('yes', 'yes', L('evYes')) + btn('no', 'no', L('evNo')) +
      '<button type="button" class="resp cntbtn' + (open ? ' is-open' : '') + '" data-act="who" data-id="' + e.id + '" aria-expanded="' + open + '"><b>' + yes.length + '</b>' + ICON.chev + '</button></div>' +
      (open ? '<div class="who"><div><h4>' + esc(L('evParticipants', { n: yes.length })) + '</h4><div class="chips">' + pills(yes) + '</div></div>' +
        '<div><h4>' + esc(L('evDeclined', { n: no.length })) + '</h4><div class="chips">' + pills(no) + '</div></div></div>' : '');
    return '<article class="ccel"><div class="cceh"><b>' + esc(fmtDay(e.starts_at)) + ' – ' + esc(e.title) + (e.series_id ? ' <span class="small muted" title="' + esc(L('evRepeat')) + '">&#8635;</span>' : '') + '</b>' +
      (canManageEvents() ? '<button type="button" class="hico" data-act="ev-edit" data-id="' + e.id + '" aria-label="' + esc(L('edit')) + '" title="' + esc(L('edit')) + '">' + ICON.dots + '</button>' : '') +
      '<button type="button" class="accfold' + (info ? ' open' : '') + '" data-act="ev-card" data-id="' + e.id + '" aria-expanded="' + info + '" aria-label="' + esc(L('evInfo')) + '" title="' + esc(L('evInfo')) + '">' + ICON.chev + '</button></div>' +
      (infoHtml || rsvpHtml ? '<div class="ccbody">' + infoHtml + rsvpHtml + '</div>' : '') + '</article>';
  }
  function fmtDay(iso) { return new Date(iso).toLocaleDateString(LOCALE[lang], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); }
  function fmtTime(iso) { return new Date(iso).toLocaleTimeString(LOCALE[lang], { hour: '2-digit', minute: '2-digit' }); }
  // Zeithorizont in Monaten (persönlich, nur auf diesem Gerät gespeichert); 0 = alle Events zeigen
  function evHorizon() {
    var v = null;
    try { v = localStorage.getItem('app-ev-horizon' + SFX); } catch (e) { /* ignorieren */ }
    var n = parseInt(v, 10);
    return isNaN(n) ? 3 : n;
  }
  function monthLabel(iso) { return new Date(iso).toLocaleDateString(LOCALE[lang], { month: 'long', year: 'numeric' }); }
  // Events mit Monatsüberschrift gruppiert (wie in der FBRO-App)
  function monthList(events) {
    var html = '', last = '';
    events.forEach(function (e) {
      var label = monthLabel(e.starts_at);
      if (label !== last) { html += '<h2 class="week">' + esc(label) + '</h2>'; last = label; }
      html += eventCard(e);
    });
    return html;
  }
  // Monatskalender: 7 Tage breit, 4–6 Wochen hoch; Tage mit Event zeigen ein Symbol, Antippen zeigt die Termine darunter
  function viewCalendar() {
    var now = new Date();
    var base = S.calMonth ? new Date(S.calMonth) : new Date(now.getFullYear(), now.getMonth(), 1);
    var y = base.getFullYear(), m = base.getMonth();
    var byDay = {};
    S.events.forEach(function (e) { var k = isoDate(new Date(e.starts_at)); (byDay[k] = byDay[k] || []).push(e); });
    var lead = (new Date(y, m, 1).getDay() + 6) % 7, dim = new Date(y, m + 1, 0).getDate(), weeks = Math.ceil((lead + dim) / 7);
    var todayKey = isoDate(now);
    var sel = S.calDay && S.calDay.slice(0, 7) === isoDate(base).slice(0, 7) ? S.calDay : '';
    var lastOk = new Date(now.getFullYear(), now.getMonth() + 12, 1);
    var html = '<div class="calnav"><button type="button" class="hico" data-act="cal-prev" aria-label="' + esc(L('evPrevMonth')) + '">' + ICON.chev + '</button>' +
      '<b>' + esc(base.toLocaleDateString(LOCALE[lang], { month: 'long', year: 'numeric' })) + '</b>' +
      '<button type="button" class="hico" data-act="cal-next" aria-label="' + esc(L('evNextMonth')) + '"' + (new Date(y, m + 1, 1) > lastOk ? ' disabled' : '') + '>' + ICON.chev + '</button></div>';
    html += '<div class="calgrid calwd">' + [1, 2, 3, 4, 5, 6, 7].map(function (d) { return '<span>' + esc(new Date(2024, 0, d).toLocaleDateString(LOCALE[lang], { weekday: 'short' })) + '</span>'; }).join('') + '</div>';
    var cells = '';
    for (var c = 0; c < weeks * 7; c++) {
      var dn = c - lead + 1;
      if (dn < 1 || dn > dim) { cells += '<span class="calday out"></span>'; continue; }
      var key = isoDate(new Date(y, m, dn)), evs = byDay[key] || [];
      var cls = 'calday' + (evs.length ? ' has' : '') + (key === todayKey ? ' today' : '') + (key === sel ? ' sel' : '');
      cells += evs.length
        ? '<button type="button" class="' + cls + '" data-act="cal-day" data-val="' + key + '" aria-pressed="' + (key === sel) + '"><span class="dn">' + dn + '</span>' + ICON.cal + (evs.length > 1 ? '<span class="cn">' + evs.length + '</span>' : '') + '</button>'
        : '<span class="' + cls + '"><span class="dn">' + dn + '</span></span>';
    }
    html += '<div class="calgrid">' + cells + '</div>';
    if (sel && byDay[sel]) html += '<div class="calsel">' + byDay[sel].map(eventCard).join('') + '</div>';
    else html += '<p class="muted small calhint">' + esc(L('evCalHint')) + '</p>';
    return html;
  }
  function viewEvents() {
    var limit = Date.now() - 3 * 3600e3;
    var yc = new Date(); yc.setFullYear(yc.getFullYear() + 1); var yearCut = yc.getTime();   // Agenda zeigt höchstens ein Jahr voraus
    var up = S.events.filter(function (e) { var t = new Date(e.starts_at).getTime(); if (e.time_set === false) t += 86400000;   // ohne Uhrzeit: bis Tagesende aktuell
      return t >= limit && t < yearCut; });
    var past = S.events.filter(function (e) { return new Date(e.starts_at).getTime() + (e.time_set === false ? 86400000 : 0) < limit; }).reverse();
    var hz = evHorizon(), cut = null;
    if (hz > 0) { var c = new Date(); c.setMonth(c.getMonth() + hz); cut = c.getTime(); }
    var near = cut === null ? up : up.filter(function (e) { return new Date(e.starts_at).getTime() < cut; });
    var far = cut === null ? [] : up.filter(function (e) { return new Date(e.starts_at).getTime() >= cut; });
    // «…» stellt den Zeithorizont ein (alle), «+» legt Events an (Admins und Event Manager)
    var html = '<div class="top"><div><h1 class="pagetitle">' + esc(L('navEvents')) + '</h1></div>' +
      '<button type="button" class="hico addbtn" data-act="ev-horizon" aria-label="' + esc(L('evHorizonTitle')) + '" title="' + esc(L('evHorizonTitle')) + '">' + ICON.dots + '</button>' +
      (canManageEvents() ? '<button type="button" class="hico addbtn" data-act="ev-new" aria-label="' + esc(L('evNew')) + '" title="' + esc(L('evNew')) + '">' + ICON.plus + '</button>' : '') + '</div>';
    // zwei Register: Liste | Kalender
    var evv = S.evView === 'cal' ? 'cal' : 'list';
    var etab = function (v, label) { var on = v === evv; return '<button type="button" role="tab" class="subtab' + (on ? ' on' : '') + '" aria-selected="' + on + '" data-act="ev-view" data-val="' + v + '">' + esc(label) + '</button>'; };
    html += '<div class="subtabs" role="tablist">' + etab('list', L('evTabList')) + etab('cal', L('evTabCal')) + '</div>';
    if (evv === 'cal') return html + viewCalendar();
    if (near.length) html += monthList(near);
    else html += '<div class="empty"><p>' + esc(far.length ? L('evNoneInHorizon', { n: hz }) : L('evEmpty')) + '</p></div>';
    if (far.length) {
      var more = !!S.open.evmore;
      html += '<button type="button" class="morebtn" data-act="ev-more" aria-expanded="' + more + '"><span>' + esc(L('evMore', { n: far.length })) + '</span>' + ICON.chev + '</button>';
      if (more) html += monthList(far);
    }
    if (past.length) html += '<h2 class="week">' + esc(L('evPast')) + '</h2>' + past.map(eventCard).join('');
    return html;
  }

  /* ---------- Tasks: jede Person kann einer anderen eine Aufgabe mit Wunschtermin zuweisen ---------- */
  function today() { var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
  function fmtDue(d) { return new Date(d + 'T12:00:00').toLocaleDateString(LOCALE[lang], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); }
  function taskRow(t) {
    var mine = t.assigned_to === S.me.id, canEdit = t.created_by === S.me.id || isAdmin(), canDone = mine || canEdit;
    var over = !t.done && t.due_date < today();
    var who = mine && t.created_by === S.me.id ? L('taskSelf') : mine ? L('taskFrom', { name: nameOf(t.created_by) }) : t.created_by === S.me.id ? L('taskTo', { name: nameOf(t.assigned_to) }) : L('taskFromTo', { from: nameOf(t.created_by), to: nameOf(t.assigned_to) });
    return '<li class="trow' + (t.done ? ' tdone' : '') + '">' +
      (canDone ? '<button type="button" role="checkbox" class="tchk' + (t.done ? ' on' : '') + '" data-act="task-done" data-id="' + t.id + '" aria-checked="' + t.done + '" aria-label="' + esc(t.done ? L('taskReopen') : L('taskDone')) + '" title="' + esc(t.done ? L('taskReopen') : L('taskDone')) + '">' + ICON.check + '</button>' : '') +
      '<div class="l"><b>' + esc(t.title) + '</b><span>' + esc(who) + '</span>' +
      '<span class="' + (over ? 'tover' : '') + '">' + esc(L('taskDueOn', { date: fmtDue(t.due_date) })) + (over ? ' · ' + esc(L('taskOverdue')) : '') + '</span>' +
      (t.note ? '<span class="tnote">' + esc(t.note) + '</span>' : '') + '</div>' +
      // Klar beschrifteter Knopf «Erledigt» / «Wieder öffnen» für die zugewiesene Person und die Person, die den Task erstellt hat
      '<div class="btnrow">' +
      (canEdit ? '<button type="button" class="mini" data-act="task-edit" data-id="' + t.id + '">' + esc(L('edit')) + '</button>' +
        '<button type="button" class="mini del" data-act="task-del" data-id="' + t.id + '">' + esc(L('del')) + '</button>' : '') + '</div></li>';
  }
  function viewTasks() {
    var open = function (a) { return a.filter(function (t) { return !t.done; }); };
    var sort = function (a) { return a.slice().sort(function (x, y) { return (x.done - y.done) || x.due_date.localeCompare(y.due_date); }); };
    var forMe = sort(S.tasks.filter(function (t) { return t.assigned_to === S.me.id; }));
    // Tasks an sich selbst stehen nur unter «Für mich»
    var fromMe = sort(S.tasks.filter(function (t) { return t.created_by === S.me.id && t.assigned_to !== S.me.id; }));
    var other = sort(S.tasks.filter(function (t) { return t.assigned_to !== S.me.id && t.created_by !== S.me.id; }));
    var list = function (a) { return a.length ? '<ul class="list">' + a.map(taskRow).join('') + '</ul>' : '<p class="muted">' + esc(L('taskEmpty')) + '</p>'; };
    var html = '<div class="top"><div><h1 class="pagetitle">' + esc(L('navTasks')) + '</h1></div>' +
      '<button type="button" class="hico addbtn" data-act="task-new" aria-label="' + esc(L('taskNew')) + '" title="' + esc(L('taskNew')) + '">' + ICON.plus + '</button></div>';
    // Register (Tabs) statt Abschnitte, wie im Einkauf
    var showOther = isAdmin() && other.length > 0;
    var tv = S.taskView === 'from' || (S.taskView === 'other' && showOther) ? S.taskView : 'me';
    var tab = function (v, label, n) { var on = v === tv; return '<button type="button" role="tab" class="subtab' + (on ? ' on' : '') + '" aria-selected="' + on + '" data-act="task-view" data-val="' + v + '">' + esc(label) + (n ? ' (' + n + ')' : '') + '</button>'; };
    html += '<div class="subtabs" role="tablist">' + tab('me', L('taskSecMine'), open(forMe).length) + tab('from', L('taskSecFrom'), open(fromMe).length) + (showOther ? tab('other', L('taskSecOther'), open(other).length) : '') + '</div>';
    html += list(tv === 'from' ? fromMe : tv === 'other' ? other : forMe);
    return html;
  }
  async function taskForm(t) {
    // Zuweisen darf man allen Personen, auch sich selbst
    var f = await askForm(t ? L('taskEdit') : L('taskNew'), [
      { name: 'title', label: L('taskTitle'), value: t && t.title },
      { name: 'assigned_to', label: L('taskAssignee'), type: 'select', value: t ? t.assigned_to : S.me.id, options: S.members.map(function (m) { return { v: m.id, l: m.name + (m.id === S.me.id ? ' (' + L('you') + ')' : '') }; }) },
      { name: 'due_date', label: L('taskDue'), type: 'date', value: t ? t.due_date : '' },
      { name: 'note', label: L('taskNote'), value: t && t.note }
    ], null, null);
    if (!f) return;
    if (!f.title || !f.due_date || !f.assigned_to) return toast(L('taskMissing'));
    var row = { title: f.title, assigned_to: f.assigned_to, due_date: f.due_date, note: f.note || null };
    if (!t) row.created_by = S.me.id;
    return act(async function () {
      var r = t ? await sb.from('tasks').update(row).eq('id', t.id) : await sb.from('tasks').insert(row);
      if (r.error) throw r.error;
    }, L('saved'));
  }

  function viewProfile() {
    var opt = function (v, l) { return '<button type="button" class="segbtn' + (theme === v ? ' on' : '') + '" data-act="set-theme" data-val="' + v + '" aria-pressed="' + (theme === v) + '">' + esc(l) + '</button>'; };
    var standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    var install = standalone ? '<p class="muted">' + esc(L('installDone')) + '</p>'
      : installEvt ? '<p class="muted">' + esc(L('installHint')) + '</p><button class="btn" data-act="install">' + esc(L('installBtn')) + '</button>'
      : '<p class="muted">' + esc(ios ? L('installIos') : L('installHint')) + '</p>';
    return '<div class="top"><div><h1 class="pagetitle">' + esc(L('navProfile')) + '</h1></div></div>' +
      '<section class="card"><h2>' + esc(L('myAccount')) + '</h2><p class="muted">' + esc(fmtPhone(S.me.phone)) + '</p>' +
      '<div class="profile-row"><span class="muted">' + esc(L('roles')) + '</span><span class="chips">' + roleLabels(S.me).map(function (r) { return '<span class="ccp">' + esc(r) + '</span>'; }).join('') + '</span></div>' +
      '<form data-form="profile">' + fld(L('fullName'), 'name', 'text', S.me.name) +
      '<label class="fld"><span>' + esc(L('language')) + '</span><select name="language">' + LANGS.map(function (l) { return '<option value="' + l + '"' + (l === lang ? ' selected' : '') + '>' + LANG_NAMES[l] + '</option>'; }).join('') + '</select></label>' +
      '<button class="btn" type="submit">' + esc(L('save')) + '</button></form></section>' +
      '<section class="card"><h2>' + esc(L('theme')) + '</h2><div class="segctl">' + opt('light', L('themeLight')) + opt('dark', L('themeDark')) + opt('', L('themeAuto')) + '</div></section>' +
      '<section class="card"><h2>' + esc(L('designTitle')) + '</h2><div class="segctl">' + DESIGNS.map(function (d) { return '<button type="button" class="segbtn' + (design === d.id ? ' on' : '') + '" data-act="set-design" data-val="' + d.id + '" aria-pressed="' + (design === d.id) + '">' + esc(L('design_' + d.id)) + '</button>'; }).join('') + '</div></section>' +
      '<section class="card"><h2>' + esc(L('pin')) + '</h2><form data-form="pin">' + fld(L('newPin'), 'pin', 'password', '', 'inputmode="numeric" maxlength="6"') +
      '<button class="btn" type="submit">' + esc(L('changePin')) + '</button></form></section>' +
      '<section class="card"><h2>' + esc(L('installTitle')) + '</h2>' + install + '</section>' +
      '<section class="card"><button class="btn ghost" data-act="logout">' + esc(L('logout')) + '</button></section>';
  }

  function viewAdmin() {
    // Aufbau wie in der FBRO-App: Titelzeile, Abschnitte als Akkordeon mit «+», Zeilen mit «Bearbeiten/Löschen» bzw. «…»-Menü
    var html = '<div class="top"><div><h1 class="pagetitle">' + esc(L('navAdmin')) + '</h1><p>' + esc(L('adminSub')) + '</p></div></div>';
    // Chronologisch: frühestes Event zuerst
    var evs = S.events.slice().sort(function (a, b) { return new Date(a.starts_at) - new Date(b.starts_at); });
    var evBody = evs.length ? '<ul class="list">' + evs.map(function (e) {
      return '<li><div class="l"><b>' + esc(e.title) + (e.series_id ? ' <span class="small muted">&#8635;</span>' : '') + '</b><span>' + esc(e.time_set === false ? fmtDay(e.starts_at) : fmtDate(e.starts_at)) + (e.place ? ' · ' + esc(e.place) : '') + '</span></div>' +
        '<div class="btnrow"><button type="button" class="mini" data-act="ev-edit" data-id="' + e.id + '">' + esc(L('edit')) + '</button>' +
        '<button type="button" class="mini del" data-act="ev-del" data-id="' + e.id + '">' + esc(L('del')) + '</button></div></li>';
    }).join('') + '</ul>' : '<p class="muted">' + esc(L('evAdminEmpty')) + '</p>';
    html += accordion('events', L('adminEvents'), evs.length, evBody, 'ev-new', L('evNew'));
    if (!isAdmin()) return html;   // Event Manager sehen nur die Events
    var tag = function (cls, label, icon) { return '<span class="mbic ' + cls + '" title="' + esc(label) + '" aria-label="' + esc(label) + '">' + icon + '</span>'; };
    var mbRow = function (m) {
      var self = m.id === S.me.id, lamp = m.pin_changed ? L('pinLampOk') : L('pinLampNo');
      return '<li class="mbrow"><div class="l"><b>' + esc(m.name) + ' <span class="pinlamp ' + (m.pin_changed ? 'ok' : 'no') + '" title="' + esc(lamp) + '" aria-label="' + esc(lamp) + '"></span>' +
        (self ? ' <span class="mbyou">' + esc(L('you')) + '</span>' : '') + '</b><span>' + esc(fmtPhone(m.phone)) + '</span></div>' +
        '<span class="mbicons">' + (m.is_admin ? tag('adm', L('roleAdmin'), ICON.gear) : '') + (m.is_event_manager ? tag('em', L('roleEM'), ICON.star) : '') + '</span>' +
        '<button type="button" class="hico" data-act="mb-menu" data-id="' + esc(m.id) + '" aria-label="' + esc(L('actions') + ': ' + m.name) + '" title="' + esc(L('actions')) + '">' + ICON.dots + '</button></li>';
    };
    // Zwei Gruppen: User und Gäste (klappbar wie die Gruppen in der FBRO-App)
    var group = function (key, label, list, icon) {
      var open = S.sec[key] !== false;
      return '<div class="mbgrp"><button type="button" class="mbgh" data-act="sec" data-id="' + key + '" aria-expanded="' + open + '">' +
        '<span class="mbcrown">' + icon + '</span><span>' + esc(label) + ' <span class="cnt">(' + list.length + ')</span></span><span class="sp"></span>' +
        '<span class="accfold' + (open ? ' open' : '') + '">' + ICON.chev + '</span></button>' +
        (open ? (list.length ? '<ul class="list">' + list.map(mbRow).join('') + '</ul>' : '<p class="muted small" style="padding:6px 0 10px">' + esc(L('nobody')) + '</p>') : '') + '</div>';
    };
    var users = S.members.filter(function (m) { return !m.is_guest; }), guests = S.members.filter(function (m) { return m.is_guest; });
    var mbBody = group('g-user', L('grpUsers'), users, ICON.user) + group('g-guest', L('grpGuests'), guests, ICON.guest);
    html += accordion('members', L('secMembers'), S.members.length, mbBody, 'add-user', L('addUser'));
    // Alle Tasks (Admin): bearbeiten, erledigen, löschen
    var allT = S.tasks.slice().sort(function (x, y) { return (x.done - y.done) || x.due_date.localeCompare(y.due_date); });
    html += accordion('a-tasks', L('adminTasks'), allT.length, (allT.length ? '<ul class="list">' + allT.map(taskRow).join('') + '</ul>' : '<p class="muted">' + esc(L('taskEmpty')) + '</p>'), 'task-new', L('taskNew'));
    // Design der ganzen App (nur Admins)
    var dsg = DESIGNS.map(function (d) {
      var on = d.id === adminDesign;
      return '<button type="button" class="dsgrow' + (on ? ' on' : '') + '" data-act="design" data-val="' + d.id + '" aria-pressed="' + on + '">' +
        '<span class="sw">' + d.colors.map(function (c) { return '<i style="background:' + c + '"></i>'; }).join('') + '</span>' +
        '<span class="nm"><b>' + esc(L('design_' + d.id)) + '</b><span>' + esc(L('design_' + d.id + '_d')) + '</span></span>' +
        (on ? '<span class="ok">' + ICON.check + '</span>' : '') + '</button>';
    }).join('');
    html += accordion('design', L('designDefault'), null, dsg);
    // Standardsprache der App (nur Admins); Personen können sie im Profil überschreiben
    var lng = '<p class="muted small" style="margin-bottom:10px">' + esc(L('langHint')) + '</p>' + LANGS.map(function (l) {
      var on = l === S.defaultLang;
      return '<button type="button" class="dsgrow' + (on ? ' on' : '') + '" data-act="applang" data-val="' + l + '" aria-pressed="' + on + '">' +
        '<span class="nm"><b>' + esc(LANG_NAMES[l]) + '</b></span>' + (on ? '<span class="ok">' + ICON.check + '</span>' : '') + '</button>';
    }).join('');
    html += accordion('lang', L('langTitle'), null, lng);
    return html;
  }

  // Abschnitt mit Titel (klappt auf/zu), «+»-Knopf und Pfeil ganz rechts – wie in der FBRO-App
  function accordion(id, title, count, body, addAct, addLabel) {
    var open = S.sec[id] !== false;   // standardmässig offen
    return '<section class="acc"><div class="acch">' +
      '<button type="button" class="acct" data-act="sec" data-id="' + id + '" aria-expanded="' + open + '">' + esc(title) + (count == null ? '' : ' <span class="cnt">(' + count + ')</span>') + '</button>' +
      (addAct ? '<button type="button" class="hico" data-act="' + addAct + '" aria-label="' + esc(addLabel) + '" title="' + esc(addLabel) + '">' + ICON.plus + '</button>' : '') +
      '<button type="button" class="accfold' + (open ? ' open' : '') + '" data-act="sec" data-id="' + id + '" aria-hidden="true" tabindex="-1">' + ICON.chev + '</button>' +
      '</div>' + (open ? '<div class="accbody">' + body + '</div>' : '') + '</section>';
  }

  // «…»-Menü einer Person: die Knöpfe tragen data-act und werden vom globalen Klick-Handler ausgeführt
  function memberMenu(m) {
    var self = m.id === S.me.id, wrap = document.createElement('div'); wrap.className = 'ccsheet-bg';
    var b = function (act, label, cls, val) {
      return '<button type="button" class="btn ' + cls + '" data-act="' + act + '" data-id="' + esc(m.id) + '"' + (val != null ? ' data-val="' + val + '"' : '') + '>' + esc(label) + '</button>';
    };
    wrap.innerHTML = '<div class="ccsheet" role="dialog" aria-modal="true" aria-label="' + esc(m.name) + '"><h3>' + esc(m.name) + '</h3><div class="menu">' +
      (!self ? b('admin', m.is_admin ? L('revokeAdmin') : L('makeAdmin'), 'ghost', !m.is_admin) : '') +
      b('em', m.is_event_manager ? L('revokeEM') : L('makeEM'), 'ghost', !m.is_event_manager) +
      b('guest', m.is_guest ? L('makeUser') : L('makeGuest'), 'ghost', !m.is_guest) +
      b('edit-user', L('edit'), 'ghost') + b('reset-pin', L('resetPin'), 'ghost') +
      (!self ? b('remove', L('remove'), 'danger') : '') +
      '<button type="button" class="btn ghost" data-x="cancel">' + esc(L('cancel')) + '</button></div></div>';
    document.body.appendChild(wrap);
    wrap.addEventListener('click', function (e) { if (e.target === wrap || e.target.closest('button')) wrap.remove(); });
  }

  function render() {
    var app = document.getElementById('app'), nav = document.getElementById('nav');
    if (!configured) { app.innerHTML = '<main class="authwrap"><div class="authcard"><h1>' + esc(L('setupTitle')) + '</h1><p>' + esc(L('notConfigured')) + '</p></div></main>'; nav.hidden = true; return; }
    if (S.step === 'loading') { app.innerHTML = '<main class="authwrap"><p class="muted">…</p></main>'; nav.hidden = true; return; }
    if (S.step === 'login') { app.innerHTML = viewLogin(); nav.hidden = true; return; }
    // Reihenfolge wie in der FBRO-App: Profil steht ganz rechts
    var tabs = [{ id: 'events', label: L('navEvents'), icon: ICON.cal }, { id: 'tasks', label: L('navTasks'), icon: ICON.tasks }];
    if (canManageEvents()) tabs.push({ id: 'admin', label: L('navAdmin'), icon: ICON.gear });
    tabs.push({ id: 'profile', label: L('navProfile'), icon: ICON.user });
    if (!tabs.some(function (t) { return t.id === S.tab; })) S.tab = 'events';
    var open = Array.prototype.map.call(document.querySelectorAll('details.ccel[open]'), function (d) { return d.dataset.k; });
    var banner = S.me.pin_changed ? '' : '<div class="pinbanner" role="status">' + esc(L('pinBanner')) + ' <button class="chip" data-act="goto" data-val="profile">' + esc(L('changePin')) + '</button></div>';
    var body = S.tab === 'profile' ? viewProfile() : S.tab === 'admin' ? viewAdmin() : S.tab === 'tasks' ? viewTasks() : viewEvents();
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
    var g = function (n) {
      if (n === 'phone' && f.elements.phonecc) return composePhone(f.elements.phonecc.value, f.elements.phone.value);
      return f.elements[n] ? f.elements[n].value.trim() : '';
    }, kind = f.dataset.form;
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

  // Wiederholung wie in Outlook: «Wiederholen alle [n] [Tag|Woche|Monat|Jahr]», Wochentage, «Bis»
  function isoDate(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function oneYear() { var d = new Date(); d.setFullYear(d.getFullYear() + 1); return isoDate(d); }
  // unbegrenzte Serien laufend bis ein Jahr voraus ergänzen (nur Admin/Event Manager, beim Öffnen)
  async function extendSeries() {
    if (!canManageEvents()) return;
    var bySid = {};
    S.events.forEach(function (e) { if (e.series_id && e.series_open && e.series_rule) (bySid[e.series_id] = bySid[e.series_id] || []).push(e); });
    var rows = [];
    Object.keys(bySid).forEach(function (sid) {
      var list = bySid[sid], r = list[0].series_rule;
      var last = Math.max.apply(null, list.map(function (e) { return new Date(e.starts_at).getTime(); }));
      genOccurrences(r.start, r.time, r.every, r.unit, r.wd, oneYear(), today()).forEach(function (iso) {
        if (new Date(iso).getTime() > last) rows.push({ title: list[0].title, place: list[0].place, rsvp: list[0].rsvp, time_set: list[0].time_set, starts_at: iso, series_id: sid, series_open: true, series_rule: r });
      });
    });
    if (!rows.length) return;
    var res = await sb.from(T('events')).insert(rows);
    if (res.error) console.error(res.error); else await loadAll();
  }
  function recurrenceBlock() {
    var sel = function (name, label, opts, val, extra) {
      return '<label class="fld"' + (extra || '') + '><span>' + esc(label) + '</span><select name="' + name + '">' + opts.map(function (o) {
        return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(val) ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
      }).join('') + '</select></label>';
    };
    var units = [['day', L('evUnitDay')], ['week', L('evUnitWeek')], ['month', L('evUnitMonth')], ['year', L('evUnitYear')]];
    var nums = []; for (var k = 1; k <= 30; k++) nums.push([k, String(k)]);
    var days = [['', L('evSameDay')]].concat([1, 2, 3, 4, 5, 6, 7].map(function (d) { return [d, new Date(2024, 0, d).toLocaleDateString(LOCALE[lang], { weekday: 'long' })]; }));   // 1.1.2024 war ein Montag
    // eine Zeile, von links nach rechts: Einheit | Wiederholen alle | Wochentag (nur bei «Woche»)
    return '<div class="recblock recrow" data-dep="repeat" hidden>' + sel('unit', L('evUnit'), units, 'week') + sel('every', L('evEvery'), nums, 1) +
      sel('wd', L('evWeekdays'), days, '', ' data-unit="week"') + '</div>';
  }
  // erzeugt die Startzeitpunkte einer Serie (lokale Zeit): ab «from» (Standard: Startdatum) bis «until», höchstens 400
  function genOccurrences(date, time, every, unit, wd, until, from) {
    var out = [], max = 400, p = date.split('-').map(Number), tp = time.split(':').map(Number);
    var start = new Date(p[0], p[1] - 1, p[2]), end = new Date(until + 'T23:59:59');
    var lo = from && new Date(from + 'T00:00:00') > start ? new Date(from + 'T00:00:00') : start;
    var add = function (d) { if (d >= lo && out.length < max) out.push(new Date(d.getFullYear(), d.getMonth(), d.getDate(), tp[0], tp[1]).toISOString()); };
    var k, d;
    if (unit === 'day') {
      for (d = new Date(start); d <= end && out.length < max; d.setDate(d.getDate() + every)) add(d);
    } else if (unit === 'week') {
      var days = (wd && wd.length ? wd : [((start.getDay() + 6) % 7) + 1]).slice().sort();
      var monday = new Date(start); monday.setDate(start.getDate() - ((start.getDay() + 6) % 7));
      for (var w = new Date(monday); w <= end && out.length < max; w.setDate(w.getDate() + 7 * every)) {
        days.forEach(function (n) {
          var x = new Date(w); x.setDate(w.getDate() + (n - 1));
          if (x >= start && x <= end) add(x);
        });
      }
    } else if (unit === 'month') {
      for (k = 0; out.length < max; k += every) {
        var m = start.getMonth() + k, dim = new Date(start.getFullYear(), m + 1, 0).getDate();
        d = new Date(start.getFullYear(), m, Math.min(start.getDate(), dim));
        if (d > end) break;
        add(d);
      }
    } else {
      for (k = 0; out.length < max; k += every) {
        d = new Date(start.getFullYear() + k, start.getMonth(), start.getDate());
        if (d > end) break;
        add(d);
      }
    }
    return out;
  }  function newSeriesId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
  }

  async function deleteEvent(ev) {
    if (!canManageEvents() || !ev) return;
    var inSeries = ev.series_id && S.events.filter(function (x) { return x.series_id === ev.series_id; }).length > 1;
    var scope = 'one';
    if (inSeries) {
      var sf = await askForm(L('del'), [{ name: 'scope', label: L('evDelScope'), type: 'select', value: 'future', options: [
        { v: 'future', l: L('evDelFuture') }, { v: 'one', l: L('evDelOne') }, { v: 'all', l: L('evDelAll') }] }], L('del'), L('evDeleteAsk', { name: ev.title }));
      if (!sf) return;
      scope = sf.scope;
    } else if (!(await askConfirm(L('del'), L('evDeleteAsk', { name: ev.title }), true))) return;
    return act(async function () {
      if (scope === 'future' && ev.series_open) { var u = await sb.from(T('events')).update({ series_open: false }).eq('series_id', ev.series_id); if (u.error) throw u.error; }
      var q = sb.from(T('events')).delete();
      q = scope === 'one' ? q.eq('id', ev.id) : scope === 'future' ? q.eq('series_id', ev.series_id).gte('starts_at', ev.starts_at) : q.eq('series_id', ev.series_id);
      var r = await q; if (r.error) throw r.error;
    }, L('removed'));
  }
  async function eventForm(ev) {
    // Wie in der FBRO-App: Titel, Datum und Uhrzeit getrennt (Datum | Zeit nebeneinander), Ort
    var local = ev ? toLocalInput(ev.starts_at).split('T') : ['', ''];
    var fields = [
      { name: 'title', label: L('evTitle'), value: ev && ev.title },
      { name: 'date', label: L('evDate'), type: 'date', value: local[0], half: true },
      { name: 'time', label: L('evTime'), type: 'time', value: local[1], half: true },
      { name: 'place', label: L('evPlace'), value: ev && ev.place },
      { name: 'rsvp', label: L('evRsvp'), type: 'checkbox', value: ev ? ev.rsvp !== false : false }
    ];
    // Bestehende Serie: Wiederholungsregel als Information anzeigen
    if (ev && ev.series_id) {
      var cnt = S.events.filter(function (x) { return x.series_id === ev.series_id; }).length, r0 = ev.series_rule;
      var unitKey = r0 ? { day: 'evUnitDay', week: 'evUnitWeek', month: 'evUnitMonth', year: 'evUnitYear' }[r0.unit] : '';
      var dayTxt = r0 && r0.unit === 'week' ? ', ' + new Date(2024, 0, (r0.wd && r0.wd.length ? r0.wd[0] : ((new Date(r0.start + 'T12:00:00').getDay() + 6) % 7) + 1)).toLocaleDateString(LOCALE[lang], { weekday: 'long' }) : '';
      fields.push({ type: 'note', text: r0 && unitKey
        ? L('evSeriesInfo', { n: r0.every, unit: L(unitKey), day: dayTxt, count: cnt }) + (ev.series_open ? ' · ' + L('evSeriesOpen') : '')
        : L('evSeriesPlain', { count: cnt }) });
    }
    // Wiederholung nur beim Anlegen eines neuen Events
    if (!ev) { fields.push({ name: 'repeat', label: L('evRepeat'), type: 'checkbox', value: false }); fields.push({ name: 'rec', type: 'recurrence' }); }
    var f = await askForm(ev ? L('evEdit') : L('evNew'), fields, null, null, ev ? L('del') : null);
    if (!f) return;
    if (f.__extra) return deleteEvent(ev);
    if (!f.title || !f.date) return toast(L('evMissing'));
    var hasTime = !!f.time, tm = f.time || '00:00';
    var row = { title: f.title, place: f.place || null, starts_at: new Date(f.date + 'T' + tm).toISOString(), rsvp: !!f.rsvp, time_set: hasTime };
    if (!ev && f.repeat) {
      // keine Einschränkungen: Serie läuft unbegrenzt; angelegt werden die nächsten Termine ab heute bis ein Jahr voraus
      var rule = { start: f.date, time: tm, every: Math.max(1, f.every || 1), unit: f.unit, wd: f.wd || [] };
      var occ = genOccurrences(rule.start, rule.time, rule.every, rule.unit, rule.wd, oneYear(), today());
      if (!occ.length) return toast(L('evNoOcc'));      var sid = newSeriesId();
      var rows = occ.map(function (iso) { return { title: row.title, place: row.place, rsvp: row.rsvp, time_set: hasTime, starts_at: iso, series_id: sid, series_open: true, series_rule: rule }; });
      return act(async function () { var r = await sb.from(T('events')).insert(rows); if (r.error) throw r.error; }, L('evSeriesAdded', { n: rows.length }));
    }
    return act(async function () {
      var r = ev ? await sb.from(T('events')).update(row).eq('id', ev.id) : await sb.from(T('events')).insert(row);
      if (r.error) throw r.error;
    }, L('saved'));
  }

  // Live-Formatierung der Nummer; +49… / 0041… wählt das Land automatisch (wie in der FBRO-App)
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (!t || (t.name !== 'phone' && t.name !== 'phonecc')) return;
    var row = t.closest('.phonerow');
    if (!row) return;
    var sel = row.querySelector('select'), inp = row.querySelector('input');
    var pos = inp.selectionStart, atEnd = pos === inp.value.length;
    var before = inp.value.slice(0, pos).replace(/\D/g, '').length;
    var v = inp.value;
    var m = v.replace(/\s/g, '').match(/^(?:\+|00)(\d+)/);
    if (m) {
      var hit = PHONE_CC.filter(function (x) { return m[1].indexOf(x.c) === 0; })[0];
      if (hit) { sel.value = hit.c; v = fmtNational(hit.c, m[1].slice(hit.c.length)); atEnd = true; }
      else { sel.value = ''; v = '+' + m[1]; }
    } else if (sel.value) {
      v = fmtNational(sel.value, v.replace(/\D/g, '').replace(/^0+/, ''));
    }
    var info = ccInfo(sel.value);
    inp.placeholder = info ? info.ph : '+43 …';
    if (v === inp.value) return;
    inp.value = v;
    if (atEnd) pos = v.length;
    else { var c = 0; pos = 0; while (pos < v.length && c < before) { if (/\d/.test(v.charAt(pos))) c++; pos++; } }
    try { inp.setSelectionRange(pos, pos); } catch (x) { /* ignorieren */ }
  });

  document.addEventListener('click', async function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return;
    var a = el.dataset.act, id = el.dataset.id, v = el.dataset.val;
    var member = S.members.filter(function (m) { return m.id === id; })[0];
    var ev = S.events.filter(function (x) { return x.id === id; })[0];
    var rpc = function (fn, args, msg) { return act(async function () { var r = await sb.rpc(fn, args); if (r.error) throw r.error; }, msg); };
    switch (a) {
      case 'goto': if (v === 'admin') ADMIN_KEYS.forEach(function (k) { S.sec[k] = false; }); S.tab = v; render(); return window.scrollTo(0, 0);
      case 'sec': S.sec[id] = !(S.sec[id] !== false); return render();
      case 'ev-view': S.evView = v; return render();
      case 'ev-card': S.open['evc:' + id] = !S.open['evc:' + id]; return render();
      case 'cal-day': S.calDay = v; return render();
      case 'cal-prev': case 'cal-next': {
        var cb = S.calMonth ? new Date(S.calMonth) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        S.calMonth = new Date(cb.getFullYear(), cb.getMonth() + (a === 'cal-next' ? 1 : -1), 1).getTime();
        S.calDay = '';
        return render();
      }
      case 'task-view': S.taskView = v; return render();
      case 'who': S.open['ev:' + id] = !S.open['ev:' + id]; return render();
      case 'task-new': return taskForm(null);
      case 'task-edit': return taskForm(S.tasks.filter(function (x) { return x.id === id; })[0]);
      case 'task-done': {
        var tk = S.tasks.filter(function (x) { return x.id === id; })[0]; if (!tk) return;
        return act(async function () { var r = await sb.from('tasks').update({ done: !tk.done }).eq('id', id); if (r.error) throw r.error; });
      }
      case 'task-del': {
        var td = S.tasks.filter(function (x) { return x.id === id; })[0];
        if (td && await askConfirm(L('del'), L('taskDeleteAsk', { title: td.title }), true))
          return act(async function () { var r = await sb.from('tasks').delete().eq('id', id); if (r.error) throw r.error; }, L('removed'));
        return;
      }
      case 'applang': if (isAdmin() && v !== S.defaultLang) return rpc('set_app_language', { p_lang: v }, L('langSaved')); return;
      case 'design': if (isAdmin() && v !== adminDesign) return rpc('set_app_design', { p_design: v }, L('designSaved')); return;
      case 'em': return rpc('set_event_manager', { target: id, flag: v === 'true' }, L('saved'));
      case 'guest': return rpc('set_guest', { target: id, flag: v === 'true' }, L('saved'));
      case 'mb-menu': if (isAdmin() && member) memberMenu(member); return;
      case 'logout': return logout();
      case 'install': if (installEvt) { installEvt.prompt(); installEvt = null; render(); } return;
      case 'set-design':
        if (!DESIGNS.some(function (x) { return x.id === v; })) return;
        S.me.design = v; applyDesign(v); render();
        sb.from(T('profiles')).update({ design: v }).eq('id', S.me.id).then(function () {}, function (e2) { console.error(e2); });
        return;
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
      case 'ev-more': S.open.evmore = !S.open.evmore; return render();
      case 'ev-horizon': {
        var hopts = [1, 2, 3, 4, 6, 9, 12].map(function (n) { return { v: String(n), l: n === 1 ? L('evMonthOne') : L('evMonthsN', { n: n }) }; });
        hopts.push({ v: '0', l: L('evAllMonths') });
        var hf = await askForm(L('evHorizonTitle'), [{ name: 'months', label: L('evHorizonLbl'), type: 'select', value: String(evHorizon()), options: hopts }]);
        if (!hf) return;
        try { localStorage.setItem('app-ev-horizon' + SFX, hf.months); } catch (e2) { /* ignorieren */ }
        return render();
      }
      case 'ev-new': return eventForm(null);
      case 'ev-edit': return eventForm(ev);
      case 'ev-del': return deleteEvent(ev);
      case 'admin': return rpc('set_admin', { target: id, make_admin: v === 'true' }, L('saved'));
      case 'reset-pin':
        if (await askConfirm(L('resetPin'), L('resetPinAsk', { name: member.name }))) return rpc('reset_pin', { target: id }, L('pinReset'));
        return;
      case 'remove':
        if (await askConfirm(L('remove'), L('removeAsk', { name: member.name }), true)) return rpc('remove_member', { target: id }, L('removed'));
        return;
      case 'edit-user': {
        var r = await askForm(L('edit'), [{ name: 'name', label: L('fullName'), value: member.name }, { name: 'phone', label: L('phone'), value: member.phone, type: 'phone' }], null, L('editPhoneNote'));
        if (!r) return;
        var ph = normPhone(r.phone); if (!ph) return toast(L('phoneInvalid'));
        return rpc('admin_update_member', { target: id, new_name: r.name, new_phone: ph }, L('saved'));
      }
      case 'add-user': {
        var f = await askForm(L('addUser'), [{ name: 'name', label: L('fullName') }, { name: 'phone', label: L('phone'), type: 'phone' }, { name: 'guest', label: L('guestCheck'), type: 'checkbox' }], L('addUser'), L('addUserNote'));
        if (!f) return;
        var p2 = normPhone(f.phone); if (!f.name || !p2) return toast(L('phoneInvalid'));
        return rpc('admin_create_user', { p_name: f.name, p_phone: p2, p_guest: !!f.guest }, L('userAdded'));
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
