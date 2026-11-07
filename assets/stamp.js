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
 * 문구·거점·기간은 config/<전시>.json 에만 있습니다.
 * 한 코드로 여러 전시를 돌립니다 (K-컬처·성수). 쪽에서 window.STAMP 로 고릅니다.
 */

(function () {
  'use strict';

  var CFG = null;
  var S = null;
  var app = document.getElementById('app');
  var view = { name: 'intro' };
  var pending = null;     // 체크인 전에 찍은 QR
  var toastTimer = null;

  /* 어느 전시인지는 쪽이 정합니다 —
       <script>window.STAMP = { project: 'seongsu' };</script>
     안 적으면 K-컬처(kcheckin)로 봅니다. 설정·저장칸·서버 이름이 모두 여기서 갈립니다. */
  var SHOW = window.STAMP || {};
  var PROJECT = SHOW.project || 'kcheckin';
  var CONFIG = SHOW.config || ('../config/' + PROJECT + '.json');

  var KEY = 'qrm:' + PROJECT;
  var A = '../assets/stamp/';

  /* ── 서버에 남기기 ─────────────────────────────
     화면은 늘 휴대폰 기록으로 돕니다. 서버는 **보고용 사본**일 뿐이라
     안 가도 투어는 그대로 굴러갑니다. 못 보낸 도장은 q 에 쌓아 두었다가
     다음에 켤 때 다시 보냅니다. */
  // 내 컴퓨터에서 확인할 때는 가까이 있는 서버를 씁니다 (wrangler dev)
  var LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var API = LOCAL ? 'http://127.0.0.1:8787' : 'https://qr-mission-api.jhmonounity.workers.dev';

  // 머리글을 안 붙입니다 — 붙이면 브라우저가 미리 한 번 더 물어 느려집니다
  function tell(path, data) {
    try {
      return fetch(API + path, { method: 'POST', body: JSON.stringify(data), keepalive: true })
        .then(function (r) { return r.json(); })
        .catch(function () { return null; });
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  /* 다녀간 수 — 누가 왔는지는 안 보냅니다.
     날짜와 '이 브라우저가 오늘 처음인지' 예·아니오뿐입니다. */
  function firstToday() {
    try {
      var day = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
      if (localStorage.getItem('qrm:day') === day) return false;
      localStorage.setItem('qrm:day', day);
      return true;
    } catch (e) {
      return false;
    }
  }

  /* 못 보낸 것들을 다시 보냅니다. 서버가 받았다고 해야 지웁니다. */
  function flush() {
    if (!S.sid) return;
    (S.q || []).slice().forEach(function (id) {
      tell('/api/answer', { sessionId: S.sid, project: PROJECT, spotId: id }).then(function (r) {
        if (!r || !r.ok) return;
        var i = S.q.indexOf(id);
        if (i >= 0) { S.q.splice(i, 1); save(); }
      });
    });
    if (S.redeemed && !S.rsent) {
      tell('/api/redeem', { sessionId: S.sid, project: PROJECT }).then(function (r) {
        if (r && r.ok) { S.rsent = true; save(); }
      });
    }
  }

  function sendStamp(id) {
    if (!S.q) S.q = [];
    if (S.q.indexOf(id) < 0) { S.q.push(id); save(); }
    flush();
  }

  /* 이름을 적으면 그때 한 번 자리를 만듭니다 */
  function openSession() {
    if (S.sid || !S.nick) return;
    tell('/api/session', { project: PROJECT, nickname: S.nick, lang: S.lang || 'en' })
      .then(function (r) {
        if (!r || !r.ok || !r.sessionId) return;
        S.sid = r.sessionId;
        save();
        flush();
      });
  }

  /* ── 저장 ──────────────────────────────────────── */
  function fresh() {
    return {
      v: 1, lang: null, nick: '', got: {}, order: [], checkedOut: null, redeemed: null, hist: [],
      sid: null,      // 서버가 매긴 이 손님의 번호
      q: [],          // 아직 서버에 못 보낸 도장들 (끊겼다 이어져도 안 잃어버리게)
      rsent: false    // 선물 수령을 서버에 알렸는지
    };
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
  // 도장 칸 수. 설정에 stamps 가 있으면 그 수를, 없으면 거점 수를 씁니다.
  // 성수는 QR 이 8개(입구 + 가게 7곳)인데 칸은 7개입니다.
  function total() { return CFG.stamps || CFG.spots.length; }
  function count() { return S.order.length; }
  function isDone() { return count() >= total(); }
  /* 선물·퇴실은 5개째에 — 남은 2개는 이어서 모읍니다 */
  function atCheckout() { return count() >= (CFG.checkout.at || total()); }

  // 입구처럼 이름만 적고 지나가는 자리. 도장도 안 주고 「다음 갈 곳」에도 안 뜹니다.
  function isCheckin(sp) { return !!(sp && sp.checkin); }

  function nextSpot() {
    for (var i = 0; i < CFG.spots.length; i++) {
      var sp = CFG.spots[i];
      if (!isCheckin(sp) && !S.got[sp.id]) return sp;
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
    return '<div class="ci"><img class="head" src="' + A + 'head.png" alt="Imagine your Korea">'
      // Imagine your Korea 쪽을 세 번 누르면 관리자 확인 창이 열립니다
      + '<button class="tapzone" data-act="adm-tap" tabindex="-1" aria-hidden="true"></button>'
      + '</div>';
  }

  /* 디자인에 두 줄로 적힌 글귀는 그대로 두 줄로 보여 줍니다 */
  function lines(key, vars) {
    return esc(U(key, vars)).split('\n').join('<br>');
  }

  function journey() {
    // 첫 화면은 시안대로 1 부터 보여 주고, 그 밖에서는 실제로 모은 수를 보여 줍니다.
    // (성수는 입구에서 도장을 안 줘서 0 개인 채로 스탬프 화면에 설 수 있습니다)
    var n = (view.name === 'intro') ? Math.max(1, count()) : count();
    var bars = '';
    if (CFG.stamps) {
      /* 칸 수를 따로 정한 전시(성수)는 막대도 그 수만큼입니다.
         거점은 8곳이지만 입구는 도장을 안 줘서 막대는 7개입니다. */
      var got = count();
      for (var i = 0; i < total(); i++) {
        bars += '<i class="' + (i < got ? 'on' : '') + '"></i>';
      }
    } else {
      /* 그 밖의 전시(K-컬처)는 막대 하나가 거점 하나입니다 — 하던 대로 */
      CFG.spots.forEach(function (sp) {
        bars += '<i class="' + (S.got[sp.id] ? 'on' : '') + '"></i>';
      });
    }
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
  function card(gold, small, cap, used) {
    // used 는 퇴실 뒤 화면에서만 켭니다 — 검정 바탕에 금색 표
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

    function cell(on, isNew, label) {
      var inner = on
        ? '<img src="' + A + (isNew ? 'stamp-new.png' : 'stamp-on.png') + '" alt="">'
        // 아직 안 찍힌 자리에는 몇 번째인지 숫자를 넣습니다 (시안 04)
        : '<span class="n">' + label + '</span>';
      return '<div class="s ' + (on ? 'on' : '') + (isNew ? ' pop' : '') + '">' + inner + '</div>';
    }

    if (CFG.stamps) {
      /* 칸 수를 따로 정한 전시(성수)는 **몇 개 모았나**만 보여 줍니다.
         일곱 곳 가운데 아무 세 곳이나 되는 방식이라 칸과 가게를 묶지 않습니다. */
      var got = count();
      for (var i = 0; i < total(); i++) {
        out += cell(i < got, popIndex != null && i === got - 1, i + 1);
      }
      return '<div class="stamps">' + out + '</div>';
    }

    /* 그 밖의 전시(K-컬처)는 칸 하나가 거점 하나입니다 — 하던 대로 */
    CFG.spots.forEach(function (sp, i) {
      out += cell(!!S.got[sp.id], popIndex != null && i === popIndex, i + 1);
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

  /* 시안의 안내·지도 화면은 아래가 넓은 뒤로 단추 하나입니다 */
  function backBar() {
    return '<div class="backbar">'
      + '<button type="button" class="btn line wide" data-go="back" aria-label="'
      + esc(U('back')) + '">' + icon('back') + '</button></div>';
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
      // 제목이 두 줄로 쪼개지지 않게 — 글자를 줄여서라도 한 줄로 (.one)
      + '<div class="center"><div class="h-title one">' + esc(U('langTitle')) + '</div>'
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

  /* 스탬프 적립 화면.
     다섯 개째부터 카드가 금 열쇠로 바뀌고 아래에 단추 둘이 붙습니다 (시안 04·04-1).
     예전에는 다섯 개째에 따로 「체크아웃 준비」 화면으로 넘어갔는데,
     새 시안은 이 화면에 그대로 단추를 답니다. */
  R.board = function () {
    var gift = atCheckout();
    var canOut = gift && !S.redeemed;
    return ciBar() + journey()
      + '<div class="main">'
      // 선물을 받은 뒤로는 스탬프 화면에서도 검정 카드입니다
      + card(gift, false, gift ? 'goldenKey' : null, gift && !!S.redeemed)
      + nextPill()
      + '<div class="grow"></div>'
      + stampRow(view.pop)
      + tools()
      + (canOut
        ? '<div class="btnrow">'
          + '<button class="btn" data-act="ready">' + esc(U('readyBtn')) + '</button>'
          + '<button class="btn" data-act="keepgoing">' + esc(U('continueBtn')) + '</button>'
          + '</div>'
        : '')
      + '<div class="grow"></div>'
      + '</div>' + navBar(S.hist.length ? 'back' : null, null);
  };

  /* 스탬프 화면 아래의 거드는 단추들 — 설정에 tools 가 있을 때만 붙습니다.
     성수는 「QR 찍기 · 안내 · 지도」 셋입니다 (K-컬처에는 없습니다). */
  function tools() {
    if (!CFG.tools) return '';
    return '<div class="tools">'
      + '<button class="btn line" data-act="scan">'
      + '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" '
      + 'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2'
      + 'M8 20H6a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/></svg>'
      + esc(U('scanBtn')) + '</button>'
      + '<div class="btnrow two">'
      + '<button class="btn" data-go="guide">' + esc(U('guideBtn')) + '</button>'
      + '<button class="btn" data-go="map">' + esc(U('mapBtn')) + '</button>'
      + '</div></div>';
  }

  /* 거점 목록 — 누르면 주소가 펼쳐집니다 (시안 01 가이드) */
  R.guide = function () {
    var rows = CFG.spots.map(function (sp, i) {
      var open = (view.open === sp.id);
      var no = sp.order === 0 ? '★' : String(sp.order);
      return '<div class="stop' + (open ? ' open' : '') + '">'
        + '<button class="hd" data-act="stop" data-id="' + esc(sp.id) + '">'
        + '<span class="no">' + no + '</span>'
        + '<span class="nm">' + esc(one(sp.name)) + '</span>'
        + '<span class="ar" aria-hidden="true">' + (open ? '\u2303' : '\u2304') + '</span>'
        + '</button>'
        + (open ? '<p class="ad">' + esc(one(sp.addr)) + '</p>' : '')
        + '</div>';
    }).join('');
    return ciBar()
      + '<div class="main">'
      + '<p class="lead">' + lines('guideLead') + '</p>'
      + '<div class="stops">' + rows + '</div>'
      + '<div class="grow"></div>'
      + '</div>' + backBar();
  };

  /* 지도 — 그림 한 장과 거점 이름표 */
  R.map = function () {
    var legend = CFG.spots.map(function (sp) {
      var star = sp.order === 0;
      return '<li><span class="no' + (star ? ' star' : '') + '">'
        + (star ? '★' : String(sp.order)) + '</span>' + esc(one(sp.name)) + '</li>';
    }).join('');
    return ciBar()
      + '<div class="main">'
      + (CFG.map ? '<img class="mapimg" src="../' + esc(CFG.map) + '" alt="">' : '')
      // 세워 둔 QR 안내판 그림 — 「각 가게에서 이걸 찾으세요」
      + '<div class="qrnote">'
      + '<span class="pic"><svg viewBox="0 0 24 32" aria-hidden="true">'
      + '<rect x="7" y="3" width="10" height="10" rx="1.4" fill="none" '
      + 'stroke="currentColor" stroke-width="1.5"/>'
      + '<path d="M12 13v14M6 29h12" fill="none" stroke="currentColor" '
      + 'stroke-width="1.5" stroke-linecap="round"/></svg></span>'
      + '<p>' + lines('mapLead') + '</p>'
      + '</div>'
      + '<ul class="legend">' + legend + '</ul>'
      + '<div class="grow"></div>'
      + '</div>' + backBar();
  };

  /* 퇴실 뒤 — 다음 머무를 곳 안내. 아직 도장이 남았으면 이어 가기 단추가 붙습니다 */
  R.after = function () {
    var rows = (CFG.annex || []).map(function (a) {
      return '<button class="row" data-poster="' + a.id + '">'
        + '<span class="lb"><b>' + esc(a.label) + '</b><span>' + esc(a.title) + ' · ' + esc(a.when || a.sub) + '</span></span>'
        + '<span class="arr">' + icon('out') + '</span></button>';
    }).join('');
    var more = !isDone();
    return ciBar() + journey()
      + '<div class="main">'
      + card(true, true, more ? 'congrats' : 'goldenKey', !!S.redeemed)
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
    view = { name: name };   // 화면이 바뀌면 펼쳐 둔 주소도 닫힙니다
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
    sendStamp(sp.id);
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
    // 입구는 도장을 주지 않습니다 — 이미 이름을 적었으면 그냥 스탬프 화면으로
    if (isCheckin(sp)) { go(S.checkedOut && isDone() ? 'after' : 'board'); return; }
    if (S.got[sp.id]) { go(S.checkedOut && isDone() ? 'after' : 'board'); toast(U('already')); return; }

    var at = slotOf(sp);
    // 도장이 찍히는 동안 뒤에 지금 화면이 비쳐 보이도록 먼저 그려 둡니다
    go('board', null, true);
    pressThen(function () {
      award(sp);
      // 일곱 개를 다 모았어도 선물을 아직 안 받았으면 스탬프 화면에 머뭅니다
      if (isDone() && S.redeemed) { go('after'); return; }
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
    flush();
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
      openSession();

      // 리셉션처럼 도장을 함께 주는 곳이면 1개를 자동으로 줍니다.
      // 입구(checkin)로 들어왔으면 이름만 받고 넘어갑니다.
      var first = pending ? spotById(pending) : CFG.spots[0];
      pending = null;
      if (first && !isCheckin(first) && !S.got[first.id]) {
        pressThen(function () {
          award(first);
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

    // 거점 한 줄을 누르면 주소가 펼쳐지고, 다시 누르면 접힙니다
    if (b.dataset.act === 'stop') {
      view.open = (view.open === b.dataset.id) ? null : b.dataset.id;
      render();
      return;
    }
    // 앱 안에 카메라를 두지 않습니다 — 휴대폰 기본 카메라로 찍으시면 됩니다
    if (b.dataset.act === 'scan') { toast(U('scanHow')); return; }

    // 시안 04 — 「READY TO CHECK-OUT」 을 누르면 직원 확인 창이 열립니다
    if (b.dataset.act === 'ready') { admOpen(); return; }
    // 「이어 가시겠어요?」 — 다음 QR 을 찍으시라고만 알려 줍니다
    if (b.dataset.act === 'keepgoing') { toast(U('scanHow')); return; }

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
    if (S.checkedOut) return 'board';
    if (S.nick) return 'board';
    return 'intro';
  }

  function boot() {
    S = load();
    if (!S.lang) S.lang = CFG.defaultLang || CFG.langs[0];
    if (!S.q) S.q = [];

    tell('/api/hit', { site: PROJECT, page: 'stamp', first: firstToday() });
    flush();

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

  fetch(CONFIG, { cache: 'no-store' })
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
