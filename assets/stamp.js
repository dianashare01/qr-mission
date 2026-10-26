/* KOREA, CHECK-IN — QR 스탬프 투어
 * ─────────────────────────────────────────────────────────────
 * 디자인 시안(01 첫 화면 · 02 단계별 화면 · 03 카메라 스캔 · 07 성수·신촌)을 따릅니다.
 *
 *   첫 화면 → 언어 → 체크인(이름) → 스탬프 적립 … → 7/7 체크아웃 → 완료 → 성수·신촌
 *
 * 인쇄한 QR 은 저장소 맨 위 index.html 로 들어온 뒤 이 쪽으로 넘어옵니다.
 *   ?p=kcheckin&s=<스팟>&t=<토큰>
 *
 * 기록은 이 휴대폰·이 브라우저에만 남습니다(회원가입 없음).
 * 문구·거점·기간은 config/kcheckin.json 에만 있습니다.
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
  var A = '../assets/stamp/';

  /* ── 저장 ──────────────────────────────────────── */
  function fresh() {
    return { v: 1, lang: null, nick: '', got: {}, order: [], code: null, checkedOut: null, hist: [] };
  }
  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY));
      if (raw && raw.got && raw.order) { if (!raw.hist) raw.hist = []; return raw; }
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
  function slotOf(sp) {
    for (var i = 0; i < CFG.spots.length; i++) if (CFG.spots[i].id === sp.id) return i;
    return 0;
  }
  function total() { return CFG.spots.length; }
  function count() { return S.order.length; }
  function isDone() { return count() >= total(); }

  function nextSpot() {
    for (var i = 0; i < CFG.spots.length; i++) {
      if (!S.got[CFG.spots[i].id]) return CFG.spots[i];
    }
    return null;
  }
  function spotLine(sp) { return sp ? sp.name + ' · ' + sp.floor : ''; }

  /* 체크아웃 코드 — 시안의 A1B2 C3D4-E5F6 모양 */
  function makeCode() {
    var CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var out = '';
    for (var i = 0; i < 12; i++) out += CH[Math.floor(Math.random() * CH.length)];
    return out.slice(0, 4) + ' ' + out.slice(4, 8) + '-' + out.slice(8, 12);
  }

  /* ── 작은 그림 ─────────────────────────────────── */
  function icon(name) {
    var p = {
      back: '<path d="M15 5 L8 12 L15 19"/>',
      next: '<path d="M9 5 L16 12 L9 19"/>',
      home: '<path d="M4 11 L12 4 L20 11 V20 H4 Z"/>',
      out: '<path d="M8 16 L16 8 M9 8 H16 V15"/>',
    }[name] || '';
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
      + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  }

  /* ── 공통 조각 ─────────────────────────────────── */
  function ciBar() {
    return '<div class="ci">'
      + '<img src="' + A + 'ci-mcst.png" alt="문화체육관광부">'
      + '<img src="' + A + 'ci-kto.png" alt="한국관광공사">'
      + '</div>';
  }

  function journey() {
    var n = Math.max(1, count());
    var bars = '';
    CFG.spots.forEach(function (sp) {
      bars += '<i class="' + (S.got[sp.id] ? 'on' : '') + '"></i>';
    });
    return '<div class="journey">'
      + '<span class="lb">' + esc(U('journey')) + '</span>'
      + '<span class="ct"><b>' + n + '</b> / ' + total() + '</span>'
      + '</div><div class="bars">' + bars + '</div>';
  }

  function card(gold, small) {
    return '<img class="card' + (small ? ' sm' : '') + '" src="' + A
      + (gold ? 'card-gold.png' : 'card-green.png') + '" alt="KOREA CHECK-IN">';
  }

  function nextPill() {
    var sp = nextSpot();
    if (!sp) return '';
    return '<div class="nextpill"><b>NEXT &rarr;</b> ' + esc(spotLine(sp)) + '</div>';
  }

  function stampRow(popIndex) {
    var out = '';
    CFG.spots.forEach(function (sp, i) {
      var on = !!S.got[sp.id];
      var isNew = (popIndex != null && i === popIndex);
      var img = on
        ? '<img src="' + A + (isNew ? 'stamp-new.png' : 'stamp-on.png') + '" alt="">'
        : '';
      out += '<div class="s ' + (on ? 'on' : '') + (isNew ? ' pop' : '') + '">' + img + '</div>';
    });
    return '<div class="stamps">' + out + '</div>';
  }

  function navBar(left, right) {
    var side = function (which, go) {
      if (!go) return '<span class="ico off"></span>';
      return '<button class="ico" data-go="' + go + '" aria-label="' + esc(U(which)) + '">'
        + icon(which === 'back' ? 'back' : 'next') + '</button>';
    };
    return '<div class="nav">'
      + side('back', left)
      + '<img class="mark" src="' + A + 'logo.png" alt="KOREA CHECK-IN">'
      + side('next', right)
      + '</div>';
  }

  function markOnly() {
    return '<div class="nav"><span class="ico off"></span>'
      + '<img class="mark" src="' + A + 'logo.png" alt="KOREA CHECK-IN">'
      + '<span class="ico off"></span></div>';
  }

  /* ── 화면 ──────────────────────────────────────── */
  var R = {};

  /* 첫 화면 */
  R.intro = function () {
    return journey() + ciBar()
      + '<div class="main">'
      + '<img class="bigmark" src="' + A + 'logo.png" alt="KOREA CHECK-IN">'
      + card(false)
      + '<div class="center"><div class="h-title">' + esc(U('stampTour')) + '</div>'
      + '<div class="sub" style="margin-top:4px">' + esc(U('tagline')) + '</div></div>'
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
    return journey() + ciBar()
      + '<div class="main">'
      + '<div class="grow"></div>'
      + '<img class="bigmark" src="' + A + 'logo.png" alt="KOREA CHECK-IN">'
      + '<div class="sub center">' + esc(U('langTitle')) + '</div>'
      + '<div class="langs">' + btns + '</div>'
      + '<div class="grow"></div>'
      + '<button class="btn" data-go="checkin">' + esc(U('continueCta')) + '</button>'
      + '</div>' + navBar('back', null);
  };

  /* 체크인 — 이름 적기 */
  R.checkin = function () {
    return journey() + ciBar()
      + '<div class="main">'
      + card(false, true)
      + '<div class="field"><label for="nick">' + esc(U('guestLabel')) + '</label>'
      + '<input id="nick" type="text" maxlength="10" autocomplete="off" autocapitalize="off" spellcheck="false" '
      + 'placeholder="' + esc(U('guestPh')) + '" value="' + esc(S.nick) + '">'
      + '<div class="err" id="err" role="alert"></div></div>'
      + '<div class="grow"></div>'
      + '<button class="btn" data-act="checkin">' + esc(U('checkinCta')) + '</button>'
      + '<div class="sub center" style="font-size:12px">' + esc(U('noSignup')) + '</div>'
      + '</div>' + navBar('back', null);
  };

  /* 스탬프 적립 화면 */
  R.board = function () {
    return journey() + ciBar()
      + '<div class="main">'
      + card(false)
      + nextPill()
      + '<div class="grow"></div>'
      + stampRow(view.pop)
      + '<div class="sub center" style="font-size:12.5px">' + esc(U('scanHow')) + '</div>'
      + '<div class="grow"></div>'
      + '</div>' + navBar(S.hist.length ? 'back' : null, null);
  };

  /* 7/7 체크아웃 준비 — 뒤로가기 없음 */
  R.ready = function () {
    // 어떤 경로로 들어와도 코드가 비어 있지 않게 합니다
    if (!S.code) { S.code = makeCode(); save(); }
    return journey() + ciBar()
      + '<div class="main">'
      + card(true)
      + '<div class="center"><div class="h-title">' + esc(U('readyTitle')) + '</div>'
      + '<div class="sub" style="margin-top:4px">' + esc(U('readyBody', { desk: CFG.checkout.desk })) + '</div></div>'
      + '<div class="code">' + esc(S.code) + '</div>'
      + '<div class="grow"></div>'
      + '<button class="btn" data-act="checkout">' + esc(U('readyCta')) + '</button>'
      + '</div>' + markOnly();
  };

  /* 체크아웃 완료 */
  R.done = function () {
    var rows = CFG.annex.map(function (a) {
      return '<button class="row" data-poster="' + a.id + '">'
        + '<span class="lb"><b>' + esc(a.label) + '</b><span>' + esc(a.title) + ' · ' + esc(a.when || a.sub) + '</span></span>'
        + '<span class="arr">' + icon('out') + '</span></button>';
    }).join('');
    return ciBar()
      + '<div class="main">'
      + '<div class="grow"></div>'
      + card(true, true)
      + '<div class="thanks">' + esc(U('doneBody')) + '</div>'
      + '<div class="sectitle" style="margin-top:12px">' + esc(U('nextStay')) + '</div>'
      + '<div class="annex">' + rows + '</div>'
      + '<div class="grow"></div>'
      + '</div>' + markOnly();
  };

  /* 성수 · 신촌 안내 */
  R.poster = function () {
    var a = null;
    CFG.annex.forEach(function (x) { if (x.id === view.poster) a = x; });
    if (!a) return R.done();
    return ciBar()
      + '<div class="main">'
      + '<div class="poster"><img src="../' + esc(a.image) + '" alt="' + esc(a.title) + '"></div>'
      + '<div class="grow"></div>'
      + '</div>' + navBar('back', null);
  };

  /* 기간이 끝났을 때 */
  R.closed = function () {
    return ciBar()
      + '<div class="main"><div class="grow"></div>'
      + card(false, true)
      + '<div class="center"><div class="h-title" style="font-size:20px">' + esc(U('closedTitle')) + '</div>'
      + '<div class="sub" style="margin-top:6px">' + esc(U('closedBody')) + '</div></div>'
      + '<div class="grow"></div></div>' + markOnly();
  };

  /* ── 그리기 ────────────────────────────────────── */
  function render() {
    app.innerHTML = (R[view.name] || R.intro)();
    document.documentElement.lang =
      S.lang === 'zhCN' ? 'zh-CN' : S.lang === 'zhTW' ? 'zh-TW' : (S.lang || 'ko');
    window.scrollTo(0, 0);
    view.pop = null;
  }
  function go(name, extra, back) {
    if (!back && view.name && view.name !== name) {
      S.hist.push(view.name);
      if (S.hist.length > 20) S.hist.shift();
      save();
    }
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
  function award(sp) {
    if (S.got[sp.id]) return false;
    S.got[sp.id] = { at: new Date().toISOString() };
    S.order.push(sp.id);
    if (isDone() && !S.code) S.code = makeCode();
    save();
    return true;
  }

  /* 도장 찍히는 연출 — 디자이너가 준 0.8초 영상 */
  function pressThen(fn) {
    var p = document.createElement('div');
    p.className = 'press';
    p.innerHTML = '<video src="' + A + 'press.webm" autoplay muted playsinline></video>';
    app.appendChild(p);

    var done = false;
    var finish = function () {
      if (done) return;
      done = true;
      if (p.parentNode) p.parentNode.removeChild(p);
      fn();
    };
    var v = p.querySelector('video');
    if (v) {
      v.addEventListener('ended', finish);
      v.play().catch(function () { /* 자동 재생을 막는 기기 */ });
    }
    setTimeout(finish, 1000);   // 영상이 안 돌아도 넘어갑니다
  }

  function arrive(sp) {
    if (!S.nick) { pending = sp.id; go('checkin'); return; }
    if (S.checkedOut) { go('done'); return; }
    if (S.got[sp.id]) { go('board'); toast(U('already')); return; }

    var at = slotOf(sp);
    // 도장이 찍히는 동안 뒤에 지금 화면이 비쳐 보이도록 먼저 그려 둡니다
    go('board', null, true);
    pressThen(function () {
      award(sp);
      if (isDone()) { go('ready'); return; }
      go('board', { pop: at });
    });
  }

  /* ── 누름 처리 ─────────────────────────────────── */
  app.addEventListener('click', function (e) {
    var b = e.target.closest('[data-go],[data-act],[data-lang],[data-poster]');
    if (!b) return;

    if (b.dataset.lang) { S.lang = b.dataset.lang; save(); render(); return; }
    if (b.dataset.poster) { go('poster', { poster: b.dataset.poster }); return; }

    if (b.dataset.go) {
      var to = b.dataset.go;
      if (to === 'back') {
        var prev = S.hist.pop();
        save();
        go(prev && prev !== view.name ? prev : 'intro', null, true);
        return;
      }
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

      // 리셉션으로 들어왔으면 스탬프 1개를 자동으로 줍니다
      var first = pending ? spotById(pending) : CFG.spots[0];
      pending = null;
      if (first && !S.got[first.id]) {
        pressThen(function () {
          award(first);
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

    // 주소를 정리해 새로고침 때 두 번 처리되지 않게 합니다
    if (sid && history.replaceState) history.replaceState(null, '', location.pathname);

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
      app.innerHTML = '<div style="padding:40px;color:#F2F0E9">'
        + '<p>설정 파일을 불러오지 못했습니다.</p>'
        + '<p style="color:#9FB3A6;font-size:14px">' + String(e.message) + '</p></div>';
    });
})();
