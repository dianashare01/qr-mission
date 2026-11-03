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
    return { v: 1, lang: null, nick: '', got: {}, order: [], checkedOut: null, redeemed: null, hist: [] };
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
  /* 선물·퇴실은 5개째에 — 남은 2개는 이어서 모읍니다 */
  function atCheckout() { return count() >= (CFG.checkout.at || total()); }

  function nextSpot() {
    for (var i = 0; i < CFG.spots.length; i++) {
      if (!S.got[CFG.spots[i].id]) return CFG.spots[i];
    }
    return null;
  }
  /* 정류장 이름과 층 — 둘 다 언어별로 적혀 있습니다 */
  function one(v) {
    return (v && typeof v === 'object') ? (v[S.lang] || v[CFG.langs[0]] || '') : (v || '');
  }
  function spotLine(sp) {
    if (!sp) return '';
    var nm = one(sp.name), fl = one(sp.floor);
    if (!fl) return nm;
    // 중국어는 전각 괄호를 씁니다 — 디자인대로
    return S.lang === 'en' ? (nm + ' (' + fl + ')') : (nm + '（' + fl + '）');
  }

  /* 확인코드를 흩뜨려 견줍니다.
     설정 파일은 홈페이지에 그대로 올라가므로 숫자를 적어 두지 않습니다.
     여섯 자리는 백만 가지뿐이라 작정하면 맞혀 볼 수 있습니다 — 자물쇠가 아니라
     눈에 안 띄게 하는 정도입니다. 선물은 직원이 직접 건네므로 그 정도면 됩니다.
     코드를 바꿀 때는 node _tools/admin-code.js <새 코드> */
  function dg1(str, salt) {
    var h = 2166136261;
    str = salt + str;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 15; h = Math.imul(h, 2246822507);
    h ^= h >>> 13; h = Math.imul(h, 3266489909);
    h ^= h >>> 16;
    return ('0000000' + (h >>> 0).toString(16)).slice(-8);
  }
  function digest(str) { return dg1(str, 'kchk1:') + dg1(str, 'kchk2:'); }

  /* ── 작은 그림 ─────────────────────────────────── */
  function icon(name) {
    var p = {
      back: '<path d="M15 5 L8 12 L15 19"/>',
      next: '<path d="M9 5 L16 12 L9 19"/>',
      home: '<path d="M4 11 L12 4 L20 11 V20 H4 Z"/>',
      out: '<path d="M8 16 L16 8 M9 8 H16 V15"/>',
      close: '<path d="M6 6 L18 18 M18 6 L6 18"/>',
    }[name] || '';
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
      + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  }

  /* ── 공통 조각 ─────────────────────────────────── */
  /* 위쪽 표기 — KOREA CHECK-IN 과 Imagine your Korea 가 한 장에 들어 있습니다 */
  function ciBar() {
    return '<div class="ci"><img class="head" src="' + A + 'head.png" alt="KOREA CHECK-IN">'
      // Imagine your Korea 쪽을 세 번 누르면 관리자 확인 창이 열립니다
      + '<button class="tapzone" data-act="adm-tap" tabindex="-1" aria-hidden="true"></button>'
      + '</div>';
  }

  /* 디자인에 두 줄로 적힌 글귀는 그대로 두 줄로 보여 줍니다 */
  function lines(key, vars) {
    return esc(U(key, vars)).split('\n').join('<br>');
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

  /* 룸키 카드 — 그림을 붙이지 않고 그려서 냅니다.
     디자이너가 준 카드 그림은 160x242 짜리 한 배뿐이라, 휴대폰이 한 점을
     두세 점으로 늘려 그리면서 뭉갰습니다. 결·모서리·글자는 CSS 로,
     K 열쇠 표는 선 그림으로 그리면 아무리 키워도 또렷합니다.
     표의 길은 _tools/trace-key.js 가 그림에서 떠낸 것입니다. */
  var KEY_PATH = 'M1 0 L20.8 0.5 L21.4 50 L69.8 0 L97.9 0.5 L44.3 58.3 L100 119.3 '
    + 'L72.9 119.3 L53.1 99.5 L20.8 67.2 L20.8 157.8 L49 158.8 L49.5 174.5 L35.9 176 '
    + 'L34.9 189.6 L21.4 190.1 L19.8 207.8 L0.5 206.2 Z';

  /* cap 을 주면 카드 위에 작은 글귀가 얹힙니다 (Congratulation! 같은 것) */
  function card(gold, small, cap) {
    // 확인코드를 넣은 뒤로 선물 카드는 투명해지고 완료 표가 얹힙니다
    var used = gold && !!S.redeemed;
    var c = CFG.card || {};
    return '<div class="rk' + (gold ? ' gold' : '') + (small ? ' sm' : '')
      + (used ? ' used' : '') + '" role="img" aria-label="' + esc(c.title || '') + '">'
      + (cap ? '<span class="cap">' + esc(U(cap)) + '</span>' : '')
      + '<svg class="key" viewBox="0 0 100 208.3" aria-hidden="true">'
      // 검정 카드의 표는 비스듬히 빛이 스친 금색입니다 (시안 keycard 아랫줄).
      // 왼위·오아래가 환하고 오위·왼아래가 어둡습니다 — 135도 결.
      + '<defs><linearGradient id="rkgold" x1="0" y1="0" x2="1" y2="1">'
      + '<stop offset="0" stop-color="#F3DCA2"/>'
      + '<stop offset=".48" stop-color="#CCA253"/>'
      + '<stop offset="1" stop-color="#F5D489"/></linearGradient></defs>'
      + '<path d="' + KEY_PATH + '"/></svg>'
      + '<b class="t1">' + esc(c.title || '') + '</b>'
      + '<i class="t2">' + esc(c.sub || '') + '</i>'
      + '</div>';
  }

  function nextPill() {
    var sp = nextSpot();
    if (!sp) return '';
    var lb = U('nextLabel');
    // 영문은 NEXT → 이름, 중국어는 下一站：이름
    return '<div class="nextpill"><b>' + esc(lb) + (S.lang === 'en' ? ' &rarr;' : '') + '</b>'
      + (S.lang === 'en' ? ' ' : '') + esc(spotLine(sp)) + '</div>';
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
    return ciBar() + journey()
      + '<div class="main">'
      + '<div class="grow"></div>'
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
    return ciBar() + journey()
      + '<div class="main">'
      + '<div class="grow"></div>'
      + '<div class="center"><div class="h-title">' + esc(U('langTitle')) + '</div>'
      + '<div class="sub" style="margin-top:4px">' + esc(U('langSub')) + '</div></div>'
      + '<div class="langs col">' + btns + '</div>'
      + '<div class="grow"></div>'
      + '<button class="btn" data-go="checkin">' + esc(U('continueCta')) + '</button>'
      + '</div>' + navBar('back', null);
  };

  /* 체크인 — 이름 적기 */
  R.checkin = function () {
    return ciBar() + journey()
      + '<div class="main">'
      + card(false, true)
      + '<div class="field"><label for="nick">' + esc(U('guestLabel')) + '</label>'
      + '<input id="nick" type="text" maxlength="10" autocomplete="off" autocapitalize="off" spellcheck="false" '
      + 'placeholder="' + esc(U('guestPh')) + '" value="' + esc(S.nick) + '">'
      + '<div class="err" id="err" role="alert"></div></div>'
      + '<div class="grow"></div>'
      + '<button class="btn" data-act="checkin">' + esc(U('checkinCta')) + '</button>'
      + '<div class="sub center" style="font-size:12px">' + lines('noSignup') + '</div>'
      + '</div>' + navBar('back', null);
  };

  /* 스탬프 적립 화면 */
  R.board = function () {
    return ciBar() + journey()
      + '<div class="main">'
      + card(false)
      + nextPill()
      + '<div class="grow"></div>'
      + stampRow(view.pop)
      + '<div class="grow"></div>'
      + '</div>' + navBar(S.hist.length ? 'back' : null, null);
  };

  /* 7/7 체크아웃 준비 — 뒤로가기 없음 */
  R.ready = function () {
    return ciBar() + journey()
      + '<div class="main">'
      + card(true, false, 'congrats')
      + '<div class="center"><div class="h-title">' + esc(U('readyTitle')) + '</div>'
      + '<div class="sub" style="margin-top:6px">' + lines('readyBody', { desk: CFG.checkout.desk }) + '</div></div>'
      + '<div class="grow"></div>'
      // 시안대로 「아직 누르지 마세요」 — 끝내는 것은 직원의 확인코드입니다
      + '<button class="btn" data-act="wait">' + esc(U('readyCta')) + '</button>'
      + '</div>' + markOnly();
  };

  /* 퇴실 뒤 — 다음 머무를 곳 안내. 아직 도장이 남았으면 이어 가기 단추가 붙습니다 */
  R.after = function () {
    var rows = CFG.annex.map(function (a) {
      return '<button class="row" data-poster="' + a.id + '">'
        + '<span class="lb"><b>' + esc(a.label) + '</b><span>' + esc(a.title) + ' · ' + esc(a.when || a.sub) + '</span></span>'
        + '<span class="arr">' + icon('out') + '</span></button>';
    }).join('');
    var more = !isDone();
    return ciBar() + journey()
      + '<div class="main">'
      + card(true, true, more ? 'congrats' : 'goldenKey')
      + '<div class="pill">' + esc(U('thanks')) + '</div>'
      + (S.redeemed ? '<div class="once">' + esc(U('onceOnly')) + '</div>' : '')
      + '<div class="sectitle">' + esc(U('nextStay')) + '</div>'
      + '<div class="annex">' + rows + '</div>'
      + '<div class="btnrow">'
      + '<button class="btn" data-act="notice">' + esc(U('noticeBtn')) + '</button>'
      + (more ? '<button class="btn soft" data-go="board">' + esc(U('continueBtn')) + '</button>' : '')
      + '</div>'
      + '<div class="grow"></div>'
      + '</div>' + markOnly() + noticeBox();
  };

  /* 안내 쪽지 */
  function noticeBox() {
    return '<div class="notice" id="notice" role="dialog" aria-modal="true" hidden>'
      + '<div class="box"><div class="hd"><b>' + esc(U('noticeBtn')) + '</b>'
      + '<button class="x" data-act="notice-close" aria-label="close">' + icon('close') + '</button></div>'
      + '<p>' + lines('noticeBody') + '</p>'
      + '<button class="btn" data-act="notice-close">&#10003;</button>'
      + '</div></div>';
  }

  /* 관리자 확인 창 — 직원이 보는 것이라 글귀는 한국어입니다 (시안 popup) */
  function admBox() {
    var a = CFG.admin || {};
    return '<div class="adm" id="adm" role="dialog" aria-modal="true" hidden>'
      + '<div class="box">'
      + '<div class="hd"><b>' + esc(a.title) + '</b>'
      + '<button class="x" data-act="adm-close" aria-label="close">' + icon('close') + '</button></div>'
      + '<label for="admcode">' + esc(a.label) + '</label>'
      + '<input id="admcode" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="6" '
      + 'autocomplete="off" placeholder="' + esc(a.ph) + '">'
      + '<div class="err" id="admerr" role="alert"></div>'
      + '<button class="btn" data-act="adm-ok">&#10003;</button>'
      + '<div class="admfoot" id="admfoot" hidden>'
      + '<button class="lnk" data-act="adm-reset">' + esc(a.reset) + '</button></div>'
      + '</div></div>';
  }

  /* 체크아웃 완료 */
  /* 7개를 다 모은 마지막 화면 — 금 열쇠 */
  R.done = function () { return R.after(); };

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
    app.innerHTML = (R[view.name] || R.intro)() + admBox();
    document.documentElement.lang =
      S.lang === 'zhCN' ? 'zh-CN' : S.lang === 'zhTW' ? 'zh-TW' : (S.lang || 'en');
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
    save();
    return true;
  }

  /* 도장 찍히는 연출 — 0.8초 */
  function pressThen(fn) {
    var p = document.createElement('div');
    p.className = 'press';
    p.innerHTML = '<div class="anim" aria-hidden="true"></div>';
    app.appendChild(p);

    setTimeout(function () {
      if (p.parentNode) p.parentNode.removeChild(p);
      fn();
    }, 820);
  }

  function arrive(sp) {
    if (!S.nick) { pending = sp.id; go(S.langPicked ? 'checkin' : 'lang'); return; }
    if (S.got[sp.id]) { go(S.checkedOut && isDone() ? 'after' : 'board'); toast(U('already')); return; }

    var at = slotOf(sp);
    // 도장이 찍히는 동안 뒤에 지금 화면이 비쳐 보이도록 먼저 그려 둡니다
    go('board', null, true);
    pressThen(function () {
      award(sp);
      if (!S.checkedOut && atCheckout()) { go('ready'); return; }
      if (isDone()) { go('after'); return; }
      go('board', { pop: at });
    });
  }

  /* ── 관리자 확인 ───────────────────────────────── */
  /* 머리말의 Imagine your Korea 쪽을 세 번 누르면 창이 열립니다.
     손님 눈에 띄는 단추는 두지 않았습니다 — 직원만 아는 길입니다. */
  var taps = 0;
  var tapTimer = null;

  function admTap() {
    taps++;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(function () { taps = 0; }, 1500);
    if (taps >= ((CFG.admin || {}).taps || 3)) { taps = 0; admOpen(); }
  }

  function admOpen() {
    var box = document.getElementById('adm');
    if (!box) return;
    box.hidden = false;
    var err = document.getElementById('admerr');
    if (err) err.textContent = '';
    var foot = document.getElementById('admfoot');
    if (foot) foot.hidden = true;     // 시험용 지우기는 코드가 맞아야 보입니다
    var el = document.getElementById('admcode');
    if (el) { el.value = ''; el.focus(); }
  }

  function admClose() {
    var box = document.getElementById('adm');
    if (box) box.hidden = true;
    taps = 0;
  }

  function admOk() {
    var a = CFG.admin || {};
    var el = document.getElementById('admcode');
    var err = document.getElementById('admerr');
    if (!el) return;
    var v = (el.value || '').trim();

    if (digest(v) !== a.codeKey) {
      if (err) err.textContent = a.bad;
      el.select();
      return;
    }

    // 코드가 맞고 아직 안 건넸으면 바로 완료 처리합니다 (직원 손이 한 번 덜 갑니다)
    if (atCheckout() && !S.redeemed) { redeem(); return; }

    // 이미 끝났거나 아직 차례가 아니면 까닭을 적고 시험용 지우기를 내어 줍니다
    if (err) err.textContent = S.redeemed ? a.doneAlready : a.notReady;
    var foot = document.getElementById('admfoot');
    if (foot) foot.hidden = false;
  }

  /* 선물을 건넸다는 표 — 이 뒤로 카드는 투명해지고 두 번은 안 됩니다 */
  function redeem() {
    S.redeemed = new Date().toISOString();
    if (!S.checkedOut) S.checkedOut = S.redeemed;
    save();
    admClose();
    go('after');
  }

  /* 시험용 — 이 휴대폰 기록만 지워 처음부터 다시 해 봅니다.
     손이 스쳐 손님 기록을 날리지 않도록 두 번 눌러야 지워집니다. */
  function admReset(btn) {
    if (btn.dataset.sure !== '1') {
      btn.dataset.sure = '1';
      btn.textContent = (CFG.admin || {}).resetAgain || '';
      return;
    }
    try { localStorage.removeItem(KEY); } catch (e) { /* 저장소를 못 쓰는 경우 */ }
    S = fresh();
    S.lang = CFG.defaultLang || CFG.langs[0];
    pending = null;
    admClose();
    go('intro', null, true);
  }

  /* ── 누름 처리 ─────────────────────────────────── */
  app.addEventListener('click', function (e) {
    var b = e.target.closest('[data-go],[data-act],[data-lang],[data-poster]');
    if (!b) return;

    if (b.dataset.lang) { S.lang = b.dataset.lang; S.langPicked = true; save(); render(); return; }
    if (b.dataset.poster) { go('poster', { poster: b.dataset.poster }); return; }

    if (b.dataset.go) {
      var to = b.dataset.go;
      if (to === 'back') {
        var prev = S.hist.pop();
        save();
        go(prev && prev !== view.name ? prev : 'intro', null, true);
        return;
      }
      if (to === 'checkin') { if (!S.lang) S.lang = CFG.defaultLang || CFG.langs[0]; S.langPicked = true; save(); }
      if (to === 'board' && S.checkedOut && isDone()) { go('after'); return; }
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
          if (!S.checkedOut && atCheckout()) { go('ready'); return; }
          go('board', { pop: slotOf(first) });
        });
      } else {
        go('board');
      }
      return;
    }

    if (b.dataset.act === 'notice' || b.dataset.act === 'notice-close') {
      var box = document.getElementById('notice');
      if (box) box.hidden = (b.dataset.act === 'notice-close');
      return;
    }

    // 시안의 「아직 누르지 마세요」 — 눌러도 끝나지 않고 직원을 부르라고만 합니다
    if (b.dataset.act === 'wait') { toast(U('waitStaff')); return; }

    if (b.dataset.act === 'adm-tap') { admTap(); return; }
    if (b.dataset.act === 'adm-close') { admClose(); return; }
    if (b.dataset.act === 'adm-ok') { admOk(); return; }
    if (b.dataset.act === 'adm-reset') { admReset(b); return; }
  });

  app.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.id === 'nick') {
      var btn = app.querySelector('[data-act="checkin"]');
      if (btn) btn.click();
    }
    if (e.key === 'Enter' && e.target.id === 'admcode') {
      var ok = app.querySelector('[data-act="adm-ok"]');
      if (ok) ok.click();
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
    if (S.checkedOut && isDone()) return 'after';
    if (!S.checkedOut && atCheckout()) return 'ready';
    if (S.checkedOut) return 'board';
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
