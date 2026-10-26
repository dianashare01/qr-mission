/* KOREA, CHECK-IN — QR 스탬프 투어
 * ─────────────────────────────────────────────────────────────
 * 한국관광공사 하이커그라운드 가이드 v0.2 의 화면 순서를 그대로 따릅니다.
 *
 *   첫 화면 → 언어 → 체크인(이름) → [스탬프 적립] ⇄ [QR 찍기]
 *            → 7/7 체크아웃 준비 → 체크아웃 완료 → 성수·신촌 안내
 *
 * QR 주소는 저장소 맨 위 index.html 로 들어온 뒤 이 쪽으로 넘어옵니다.
 *   ?p=kcheckin&s=<스팟>&t=<토큰>
 *
 * 기록은 이 휴대폰·이 브라우저에만 남습니다(회원가입 없음).
 * 문구·거점·색은 config/kcheckin.json 에만 있습니다.
 */

(function () {
  'use strict';

  var CFG = null;
  var S = null;
  var app = document.getElementById('app');
  var view = { name: 'intro' };
  var pending = null;     // 체크인 전에 찍은 QR
  var toastTimer = null;

  var KEY = 'qrm:kcheckin';

  /* ── 저장 ──────────────────────────────────────── */
  function fresh() {
    return { v: 1, lang: null, nick: '', got: {}, order: [], code: null, checkedOut: null };
  }
  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY));
      if (raw && raw.got && raw.order) return raw;
    } catch (e) { /* 저장소를 못 쓰는 경우 */ }
    return fresh();
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 사생활 보호 모드 등 */ }
  }

  /* ── 글 고르기 ─────────────────────────────────── */
  function L(x) {
    if (x == null) return '';
    if (typeof x === 'string') return x;
    return x[S.lang] || x[CFG.langs[0]] || '';
  }
  function U(k, vars) {
    var s = L(CFG.ui[k]);
    if (vars) Object.keys(vars).forEach(function (n) { s = s.split('{' + n + '}').join(vars[n]); });
    return s;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ── 거점 ──────────────────────────────────────── */
  function spotById(id) {
    for (var i = 0; i < CFG.spots.length; i++) if (CFG.spots[i].id === id) return CFG.spots[i];
    return null;
  }
  function total() { return CFG.spots.length; }
  function slotOf(sp) {
    for (var i = 0; i < CFG.spots.length; i++) if (CFG.spots[i].id === sp.id) return i;
    return 0;
  }
  function count() { return S.order.length; }
  function isDone() { return count() >= total(); }

  /* 다음으로 가야 할 거점 — 번호 순으로 아직 안 찍은 첫 곳 */
  function nextSpot() {
    for (var i = 0; i < CFG.spots.length; i++) {
      if (!S.got[CFG.spots[i].id]) return CFG.spots[i];
    }
    return null;
  }
  function spotLine(sp) { return sp ? sp.name + ' · ' + sp.floor : ''; }

  /* 체크아웃 코드 — 가이드의 A1B2 C3D4-E5F6 모양 */
  function makeCode() {
    var CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var out = '';
    for (var i = 0; i < 12; i++) out += CH[Math.floor(Math.random() * CH.length)];
    return out.slice(0, 4) + ' ' + out.slice(4, 8) + '-' + out.slice(8, 12);
  }

  /* ── 그림 조각 ─────────────────────────────────── */
  var KEYART =
    '<svg viewBox="0 0 86 132" fill="none" aria-hidden="true">'
    + '<g stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="M26 8 V122"/>'
    + '<path d="M26 54 L64 8"/>'
    + '<path d="M26 54 L52 86"/>'
    + '<path d="M26 100 H50"/>'
    + '<path d="M26 114 H44"/>'
    + '</g>'
    + '</svg>';

  var STAMPART =
    '<svg viewBox="0 0 120 120" fill="none" aria-hidden="true">'
    + '<rect x="40" y="10" width="40" height="44" rx="8" fill="#C9A24B"/>'
    + '<rect x="24" y="54" width="72" height="22" rx="7" fill="#E0BE72"/>'
    + '<rect x="18" y="76" width="84" height="16" rx="6" fill="#B8923F"/>'
    + '</svg>';

  function icon(name) {
    var p = {
      back: '<path d="M15 5 L8 12 L15 19"/>',
      next: '<path d="M9 5 L16 12 L9 19"/>',
      home: '<path d="M4 11 L12 4 L20 11 V20 H4 Z"/>',
      chev: '<path d="M6 9 L12 15 L18 9"/>',
    }[name] || '';
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" '
      + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  }

  /* ── 공통 조각 ─────────────────────────────────── */
  function ciBar() { return '<div class="ci"><i></i><i></i></div>'; }

  function stepBar() {
    var n = count(), dots = '';
    CFG.spots.forEach(function (sp) {
      dots += '<i class="' + (S.got[sp.id] ? 'on' : '') + '"></i>';
    });
    return '<div class="steps"><div class="n"><b>' + n + '</b> / ' + total() + '</div>'
      + '<div class="dots">' + dots + '</div></div>';
  }

  function nextLine() {
    var sp = nextSpot();
    if (!sp) return '';
    return '<div class="nextline"><div class="k">NEXT</div>'
      + '<div class="v">&rarr; ' + esc(spotLine(sp)) + '</div></div>';
  }

  function keyCard(gold) {
    return '<div class="key ' + (gold ? 'gold' : '') + '"><div class="top"></div>'
      + '<div class="body" style="color:' + (gold ? '#6B531C' : 'var(--gold)') + '">' + KEYART + '</div></div>';
  }

  function stampRow(popIndex) {
    var out = '';
    CFG.spots.forEach(function (sp, i) {
      var on = !!S.got[sp.id];
      var pop = (popIndex != null && i === popIndex) ? ' pop' : '';
      out += '<div class="s ' + (on ? 'on' : '') + pop + '">' + (on ? 'K' : (i + 1)) + '</div>';
    });
    return '<div class="stamps">' + out + '</div>';
  }

  function wordmark() {
    return '<div class="wm"><b>KOREA</b>CHECK-IN</div>';
  }

  function bottomBar(left, right) {
    return '<div class="bottom">'
      + (left ? '<button class="ico" data-go="' + left + '" aria-label="' + esc(U('back')) + '">' + icon('back') + '</button>' : '<span class="ico"></span>')
      + wordmark()
      + (right ? '<button class="ico on" data-go="' + right + '" aria-label="' + esc(U('next')) + '">' + icon('next') + '</button>' : '<span class="ico"></span>')
      + '</div>';
  }

  /* ── 화면 ──────────────────────────────────────── */
  var R = {};

  /* 첫 화면 */
  R.intro = function () {
    return ciBar() + stepBar()
      + '<div class="main">'
      + '<div style="letter-spacing:.2em;font-family:var(--serif);font-size:22px" class="center">KOREA<br><span style="font-size:26px">CHECK-IN</span></div>'
      + keyCard(false)
      + '<div class="center"><div class="title-sm">' + esc(U('stampTour')) + '</div>'
      + '<div class="sub" style="margin-top:6px">' + esc(U('tagline')) + '</div></div>'
      + '<div class="grow"></div>'
      + '<button class="btn" data-go="lang">' + esc(U('continueCta')) + '</button>'
      + '</div>';
  };

  /* 언어 고르기 */
  R.lang = function () {
    var btns = CFG.langs.map(function (l) {
      return '<button class="lang" data-lang="' + l + '" aria-pressed="' + (S.lang === l) + '">'
        + esc(CFG.langNames[l]) + '</button>';
    }).join('');
    return ciBar() + stepBar()
      + '<div class="main">'
      + '<div class="grow"></div>'
      + '<div class="title-sm center">' + esc(U('langTitle')) + '</div>'
      + '<div class="langs">' + btns + '</div>'
      + '<div class="grow"></div>'
      + '<button class="btn" data-go="checkin">' + esc(U('continueCta')) + '</button>'
      + '</div>' + bottomBar('intro', null);
  };

  /* 체크인 — 이름 적기 */
  R.checkin = function () {
    return ciBar() + stepBar()
      + '<div class="main">'
      + '<div class="sub center" style="font-family:var(--mono);letter-spacing:.14em">ROOM ' + esc(CFG.room) + '</div>'
      + keyCard(false)
      + '<div class="field"><label for="nick">' + esc(U('guestLabel')) + '</label>'
      + '<input id="nick" type="text" maxlength="10" autocomplete="off" autocapitalize="off" spellcheck="false" '
      + 'placeholder="' + esc(U('guestPh')) + '" value="' + esc(S.nick) + '">'
      + '<div class="err" id="err" role="alert"></div></div>'
      + '<div class="grow"></div>'
      + '<button class="btn" data-act="checkin">' + esc(U('checkinCta')) + '</button>'
      + '<div class="sub center" style="font-size:12px">' + esc(U('noSignup')) + '</div>'
      + '</div>' + bottomBar('lang', null);
  };

  /* 스탬프 적립 화면 */
  R.board = function () {
    return ciBar() + stepBar() + nextLine()
      + '<div class="main">'
      + keyCard(false)
      + '<div class="grow"></div>'
      + stampRow(view.pop)
      + '<div class="sub center" style="font-size:12.5px">' + esc(U('scanHow')) + '</div>'
      + '<div class="grow"></div>'
      + '</div>' + bottomBar(null, null);
  };

  /* 7/7 체크아웃 준비 — 뒤로가기 없음 */
  R.ready = function () {
    return ciBar() + stepBar()
      + '<div class="main">'
      + keyCard(true)
      + '<div class="center"><div class="title-sm gold">' + esc(U('readyTitle')) + '</div>'
      + '<div class="sub" style="margin-top:6px">' + esc(U('readyBody', { desk: CFG.checkout.desk })) + '</div></div>'
      + '<div class="code">' + esc(S.code) + '</div>'
      + '<div class="grow"></div>'
      + '<button class="btn" data-act="checkout">' + esc(U('readyCta')) + '</button>'
      + '</div>';
  };

  /* 체크아웃 완료 */
  R.done = function () {
    var rows = CFG.annex.map(function (a) {
      return '<button class="row" data-poster="' + a.id + '">'
        + '<span class="lb"><b>' + esc(a.label) + '</b><span>' + esc(a.title) + '</span></span>'
        + '<span class="chev">' + icon('chev') + '</span></button>';
    }).join('');
    return ciBar()
      + '<div class="main">'
      + '<div class="grow"></div>'
      + keyCard(true)
      + '<div class="center"><div class="title-sm gold">' + esc(U('doneTitle')) + '</div>'
      + '<div class="sub" style="margin-top:6px">' + esc(U('doneBody')) + '</div></div>'
      + '<div class="title-sm center" style="margin-top:10px;font-size:11px;color:var(--ink-sub)">' + esc(U('nextStay')) + '</div>'
      + '<div class="annex">' + rows + '</div>'
      + '<div class="grow"></div>'
      + '</div>'
      + '<div class="bottom"><span class="ico"></span>' + wordmark() + '<span class="ico"></span></div>';
  };

  /* 성수 · 신촌 안내 */
  R.poster = function () {
    var a = null;
    CFG.annex.forEach(function (x) { if (x.id === view.poster) a = x; });
    if (!a) return R.done();
    return ciBar()
      + '<div class="main">'
      + '<div class="center"><div class="title-sm">' + esc(a.label) + '</div>'
      + '<div class="sub">' + esc(a.sub) + '</div></div>'
      + '<div class="poster"><img src="../' + esc(a.image) + '" alt="' + esc(a.title) + '"></div>'
      + '<div class="grow"></div>'
      + '</div>' + bottomBar('done', null);
  };

  /* 기간이 끝났을 때 */
  R.closed = function () {
    return ciBar()
      + '<div class="main"><div class="grow"></div>'
      + keyCard(false)
      + '<div class="center"><div class="title-sm">' + esc(U('closedTitle')) + '</div>'
      + '<div class="sub" style="margin-top:6px">' + esc(U('closedBody')) + '</div></div>'
      + '<div class="grow"></div></div>';
  };

  /* ── 그리기 ────────────────────────────────────── */
  function render() {
    app.innerHTML = (R[view.name] || R.intro)();
    document.documentElement.lang =
      S.lang === 'zhCN' ? 'zh-CN' : S.lang === 'zhTW' ? 'zh-TW' : (S.lang || 'en');
    window.scrollTo(0, 0);
    view.pop = null;
  }
  function go(name, extra) {
    view = { name: name };
    if (extra) Object.keys(extra).forEach(function (k) { view[k] = extra[k]; });
    render();
  }
  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'toast';
    t.setAttribute('role', 'status');
    t.textContent = msg;
    app.appendChild(t);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2400);
  }

  /* ── 스탬프 주기 ───────────────────────────────── */
  function award(sp, silent) {
    if (S.got[sp.id]) { if (!silent) toast(U('already')); return false; }

    S.got[sp.id] = { at: new Date().toISOString() };
    S.order.push(sp.id);
    if (isDone() && !S.code) S.code = makeCode();
    save();
    return true;
  }

  /* 도장 찍히는 연출 0.8초 → 골드 스탬프 0.5초 */
  function pressThen(fn) {
    var p = document.createElement('div');
    p.className = 'press';
    p.innerHTML = STAMPART;
    app.appendChild(p);
    setTimeout(function () {
      if (p.parentNode) p.parentNode.removeChild(p);
      fn();
    }, 800);
  }

  function arrive(sp) {
    // 체크인 전이면 이름부터 받고, 끝난 뒤 이 거점을 준다
    if (!S.nick) { pending = sp.id; go('checkin'); return; }

    // 이미 완주했으면 체크아웃 완료 화면만 보여 준다
    if (S.checkedOut) { go('done'); return; }

    if (S.got[sp.id]) { go('board'); toast(U('already')); return; }

    var at = slotOf(sp);
    pressThen(function () {
      award(sp, true);
      if (isDone()) { go('ready'); return; }
      go('board', { pop: at });
    });
  }

  /* ── 누름 처리 ─────────────────────────────────── */
  app.addEventListener('click', function (e) {
    var b = e.target.closest('[data-go],[data-act],[data-lang],[data-poster]');
    if (!b) return;

    if (b.dataset.lang) {
      S.lang = b.dataset.lang;
      save();
      render();
      return;
    }
    if (b.dataset.poster) { go('poster', { poster: b.dataset.poster }); return; }

    if (b.dataset.go) {
      var to = b.dataset.go;
      if (to === 'checkin' && !S.lang) { S.lang = CFG.defaultLang || CFG.langs[0]; save(); }
      if (to === 'board' && S.checkedOut) { go('done'); return; }
      go(to);
      return;
    }

    if (b.dataset.act === 'checkin') {
      var el = document.getElementById('nick');
      var v = (el.value || '').trim();
      if (v.length < 2) { document.getElementById('err').textContent = U('errShort'); el.focus(); return; }
      S.nick = v;
      save();

      // 리셉션으로 들어왔으면 스탬프 1개를 자동으로 준다
      var first = pending ? spotById(pending) : CFG.spots[0];
      pending = null;
      if (first && !S.got[first.id]) {
        pressThen(function () {
          award(first, true);
          if (isDone()) { go('ready'); return; }
          go('board', { pop: slotOf(first) });
        });
      } else {
        go('board');
      }
      return;
    }

    if (b.dataset.act === 'checkout') {
      S.checkedOut = new Date().toISOString();
      save();
      go('done');
      return;
    }
  });

  app.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.id === 'nick') {
      var btn = app.querySelector('[data-act="checkin"]');
      if (btn) btn.click();
    }
  });

  /* ── 시작 ──────────────────────────────────────── */
  function periodClosed() {
    var p = CFG.period || {};
    var today = new Date().toISOString().slice(0, 10);
    if (p.open && today < p.open) return true;
    if (p.close && today > p.close) return true;
    return false;
  }

  /* 지금 진행 상태에 맞는 화면 */
  function resume() {
    if (S.checkedOut) return 'done';
    if (isDone()) return 'ready';
    if (S.nick) return 'board';
    return 'intro';
  }

  function boot() {
    S = load();
    if (!S.lang) S.lang = CFG.defaultLang || CFG.langs[0];

    var q = new URLSearchParams(location.search);

    // 점검용 — 주소 뒤에 &reset=1 (시연 모드일 때만)
    if (q.get('reset') === '1' && CFG.prototype === true) {
      try { localStorage.removeItem(KEY); } catch (e) { /* 저장소를 못 쓰는 경우 */ }
      S = fresh();
      S.lang = CFG.defaultLang || CFG.langs[0];
    }

    if (periodClosed()) { go('closed'); return; }

    var sid = q.get('s');
    var tok = q.get('t');
    var sp = sid ? spotById(sid) : null;

    // 주소를 정리해 새로고침 때 두 번 처리되지 않게 한다
    if (sid && history.replaceState) {
      history.replaceState(null, '', location.pathname);
    }

    if (sid && (!sp || (sp.token && tok !== sp.token))) {
      go(resume());
      toast(U('badQr'));
      return;
    }

    if (sp) { arrive(sp); return; }

    go(resume());
  }

  fetch('../config/kcheckin.json', { cache: 'no-store' })
    .then(function (r) {
      if (!r.ok) throw new Error('설정 파일을 찾지 못했습니다 (' + r.status + ')');
      return r.json();
    })
    .then(function (cfg) {
      CFG = cfg;

      // 설정의 색을 화면에 반영
      var t = CFG.theme || {};
      var root = document.documentElement.style;
      Object.keys(t).forEach(function (k) {
        var name = '--' + k.replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); });
        root.setProperty(name, t[k]);
      });
      document.title = CFG.title;

      boot();
    })
    .catch(function (e) {
      app.innerHTML = '<div style="padding:40px;color:#F2EDE1">'
        + '<p>설정 파일을 불러오지 못했습니다.</p>'
        + '<p style="color:#9DB2A3;font-size:14px">' + String(e.message) + '</p></div>';
    });
})();
