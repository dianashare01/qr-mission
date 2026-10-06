/* QR 미션 공통 엔진
 * ─────────────────────────────────────────────────────────────
 * 코드베이스 1개 + 프로젝트별 설정 파일 1개 구조입니다.
 * 문항·문구·색은 config/<프로젝트>.json 에만 있고, 이 파일은 모든 프로젝트가 공유합니다.
 *
 * QR 주소
 *   ?p=wianbu&s=s2&t=토큰     (정적 호스팅용)
 *   /wianbu/s/s2?t=토큰        (서버가 있을 때. 둘 다 인식합니다)
 *
 * 서버 없이도 전 과정이 동작합니다(이 기기에만 저장).
 * config 의 api.baseUrl 을 채우면 서버에도 같이 보냅니다.
 */

(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var CFG = null;
  var S = null;             // 진행 상태
  var cur = null;           // 지금 진행 중인 스팟
  var pick = { k: null, p: null, fin: null };

  /* ── 주소 읽기 ─────────────────────────────────── */
  function readUrl() {
    var q = new URLSearchParams(location.search);
    var project = q.get('p');
    var spot = q.get('s');
    var token = q.get('t');

    // /wianbu/s/s2 형태도 인식
    var m = location.pathname.match(/\/([A-Za-z0-9_-]+)\/s\/([A-Za-z0-9_-]+)/);
    if (m) { project = project || m[1]; spot = spot || m[2]; }

    return { project: project || 'wianbu', spot: spot, token: token };
  }

  /* ── 저장 ──────────────────────────────────────── */
  function key(p) { return 'qrm:' + p; }

  function load(p) {
    try {
      var raw = localStorage.getItem(key(p));
      if (raw) return JSON.parse(raw);
    } catch (e) { /* 저장소를 못 쓰는 경우 */ }
    return null;
  }

  function save() {
    try { localStorage.setItem(key(S.project), JSON.stringify(S)); }
    catch (e) { /* 사생활 보호 모드 등 */ }
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'x-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function makeCode() {
    var n = '';
    for (var i = 0; i < 6; i++) n += Math.floor(Math.random() * 10);
    return n;
  }

  /* ── 서버 (설정에 주소가 있을 때만) ─────────────── */
  function api(path, body) {
    var base = (CFG.api && CFG.api.baseUrl || '').replace(/\/+$/, '');
    if (!base) return Promise.resolve(null);

    var stop = new AbortController();
    var timer = setTimeout(function () { stop.abort(); }, 5000);

    return fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: stop.signal,
    }).then(function (r) { return r.ok ? r.json().catch(function () { return null; }) : null; })
      .catch(function () { return null; })
      .finally(function () { clearTimeout(timer); });
  }

  /* ── 화면 전환 ─────────────────────────────────── */
  var SCREENS = ['s-start', 's-knowledge', 's-feedback', 's-preference',
                 's-collect', 's-board', 's-result', 's-finish', 's-notice'];

  function show(id) {
    SCREENS.forEach(function (x) { $(x).classList.toggle('on', x === id); });
    window.scrollTo(0, 0);
  }

  function text(id, v) { var e = $(id); if (e) e.textContent = v == null ? '' : v; }

  /* ── 설정 적용 ─────────────────────────────────── */
  function applyTheme(t) {
    if (!t) return;
    var r = document.documentElement.style;
    if (t.bg) r.setProperty('--bg', t.bg);
    if (t.surface) r.setProperty('--surface', t.surface);
    if (t.ink) r.setProperty('--ink', t.ink);
    if (t.inkSub) r.setProperty('--ink-sub', t.inkSub);
    if (t.accent) r.setProperty('--accent', t.accent);
    if (t.line) r.setProperty('--line', t.line);
    if (t.radius != null) r.setProperty('--radius', t.radius + 'px');
    if (t.fontDisplay) r.setProperty('--font-display', "'" + t.fontDisplay + "', serif");
    if (t.fontBody) r.setProperty('--font-body', "'" + t.fontBody + "', sans-serif");

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta && t.bg) meta.setAttribute('content', t.bg);
  }

  function fillStrings() {
    var s = CFG.strings;
    document.title = CFG.title;
    text('brand', CFG.title);

    text('start-title', s.startTitle);
    text('start-body', s.startBody);
    text('nick-label', s.nickLabel);
    $('nick').placeholder = s.nickPlaceholder || '';
    text('start-cta', s.startCta);
    text('privacy-note', s.privacyNote);

    text('k-label', CFG.tone.knowledgeLabel);
    text('k-cta', s.knowledgeCta);
    text('f-label', CFG.tone.knowledgeLabel);
    text('f-cta', s.feedbackCta);
    text('p-label', CFG.tone.preferenceLabel);
    text('p-cta', s.preferenceCta);

    text('c-note', s.collectNote);
    text('c-cta', s.collectCta);

    text('b-title', s.boardTitle);
    text('b-next-label', s.boardNextLabel);
    text('b-free', s.boardFreeOrder);
    text('b-rec-label', s.recoveryLabel);
    text('b-rec-note', s.recoveryNote);

    text('r-eyebrow', s.resultEyebrow);
    text('r-curation-title', s.resultCurationTitle);
    text('r-cta', s.resultCta);
    text('r-save', s.resultSaveCta);

    text('fin-badge', s.finishBadge);
    text('fin-title', s.finishTitle);
    text('fin-body', s.finishBody);
    text('fin-note', s.finishNote);
    text('fin-cta', s.finishCta);
  }

  /* ── 선택지 만들기 ─────────────────────────────── */
  var TICK = '<span class="tick"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" '
           + 'stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" '
           + 'aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg></span>';

  function buildOptions(host, labels, onPick) {
    host.innerHTML = '';
    labels.forEach(function (label, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'opt';
      b.setAttribute('aria-pressed', 'false');
      var span = document.createElement('span');
      span.textContent = label;
      b.appendChild(span);
      b.insertAdjacentHTML('beforeend', TICK);
      b.addEventListener('click', function () {
        Array.prototype.forEach.call(host.children, function (c) { c.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        onPick(i);
      });
      host.appendChild(b);
    });
  }

  /* ── 스팟 찾기 ─────────────────────────────────── */
  function spotById(id) {
    for (var i = 0; i < CFG.spots.length; i++) if (CFG.spots[i].id === id) return CFG.spots[i];
    return null;
  }
  function doneCount() { return Object.keys(S.answers).length; }
  function total() { return CFG.spots.length; }
  function isDone() { return doneCount() >= total(); }

  function nextSpot() {
    for (var i = 0; i < CFG.spots.length; i++) {
      if (!S.answers[CFG.spots[i].id]) return CFG.spots[i];
    }
    return null;
  }

  /* 그 스팟의 QR 이 가리키는 주소 (시연용으로도 씁니다) */
  function spotUrl(spot) {
    return location.pathname + '?p=' + encodeURIComponent(S.project)
         + '&s=' + encodeURIComponent(spot.id)
         + (spot.token ? '&t=' + encodeURIComponent(spot.token) : '');
  }

  function isPrototype() { return CFG.prototype === true; }

  function barCount() {
    text('bar-count', doneCount() + ' / ' + total());
  }

  /* ── 01 시작 ───────────────────────────────────── */
  function startScreen() {
    show('s-start');
    text('bar-count', '');

    $('start-cta').onclick = function () {
      var v = $('nick').value.trim();
      if (v.length < 2 || v.length > 10) {
        text('nick-err', '2자에서 10자 사이로 적어 주세요.');
        $('nick').focus();
        return;
      }
      text('nick-err', '');

      S.nickname = v;
      save();
      api('/api/session', { project: S.project, nickname: v, lang: 'ko' });

      if (cur) openSpot(cur); else boardScreen();
    };
  }

  /* ── 02 기록 확인 ──────────────────────────────── */
  function openSpot(spot) {
    cur = spot;
    pick.k = null; pick.p = null;

    barCount();
    var head = spot.order + ' / ' + total() + ' · ' + spot.place;
    text('k-place', head);
    text('f-place', head);
    text('p-place', head);

    text('k-q', spot.knowledge.q);
    buildOptions($('k-options'), spot.knowledge.options, function (i) {
      pick.k = i;
      $('k-cta').disabled = false;
    });
    $('k-cta').disabled = true;

    $('k-cta').onclick = function () { if (pick.k !== null) feedbackScreen(); };

    show('s-knowledge');
  }

  /* ── 03 해설 — 정답·오답 표현 없이 기준 답을 보여 준다 ── */
  function feedbackScreen() {
    var k = cur.knowledge;
    text('f-title', CFG.tone.correctLabel);
    text('f-k', k.explainTitle || '');
    text('f-v', k.explainValue || k.options[k.answer]);
    text('f-text', k.explain || '');

    $('f-cta').onclick = preferenceScreen;
    show('s-feedback');
  }

  /* ── 04 나의 생각 ──────────────────────────────── */
  function preferenceScreen() {
    var p = cur.preference;
    text('p-q', p.q);
    buildOptions($('p-options'), p.options.map(function (o) { return o.label; }), function (i) {
      pick.p = i;
      $('p-cta').disabled = false;
    });
    $('p-cta').disabled = true;

    $('p-cta').onclick = function () {
      if (pick.p === null) return;
      recordSpot();
      collectScreen();
    };

    show('s-preference');
  }

  /* 응답 저장 — 취향 문항까지 마쳐야 수집으로 인정 */
  function recordSpot() {
    var k = cur.knowledge;
    var opt = cur.preference.options[pick.p];

    S.answers[cur.id] = {
      k: pick.k,
      kOk: pick.k === k.answer,
      p: pick.p,
      tag: opt.tag,
      at: new Date().toISOString(),
    };
    S.order.push(cur.id);
    save();

    api('/api/answer', {
      sessionId: S.id, project: S.project, spotId: cur.id, token: cur.token,
      kChoice: pick.k, kCorrect: pick.k === k.answer, pChoice: pick.p, pTag: opt.tag,
    });
  }

  /* ── 05 획득 ───────────────────────────────────── */
  function collectScreen() {
    var n = doneCount();
    var ord = CFG.strings.ordinals[n - 1] || n;

    // 수집품은 임시 페이지 모양 — 일러스트 확정 전까지 PAGE N 과 구역명만 보여 준다
    text('c-name', cur.item.name);
    text('c-place', cur.item.label || cur.place);
    text('c-cap', '페이지 일러스트 [디자이너]');

    text('c-title', (CFG.strings.collectTitleFormat || '{ord} 번째').replace('{ord}', ord));
    $('c-cta').onclick = boardScreen;

    // 시연용: QR 없이 다음 스팟으로 바로 이어 가기
    var demo = $('c-demo');
    var nx = nextSpot();
    if (isPrototype() && nx) {
      demo.classList.remove('hidden');
      demo.textContent = '다음 QR 찍기 — ' + nx.place + ' (시연용)';
      demo.onclick = function () { location.href = spotUrl(nx); };
    } else {
      demo.classList.add('hidden');
      demo.onclick = null;
    }

    barCount();
    show('s-collect');
  }

  /* ── 06 수집 보드 ──────────────────────────────── */
  function boardScreen() {
    barCount();

    var done = doneCount();
    text('b-count', CFG.strings.boardCountFormat
      .replace('{total}', total()).replace('{done}', done));

    var proto = isPrototype();
    $('b-demo-note').classList.toggle('hidden', !proto || isDone());

    var grid = $('b-grid');
    grid.innerHTML = '';
    CFG.spots.forEach(function (sp) {
      var got = !!S.answers[sp.id];

      // 시연용일 때만 아직 안 연 칸을 누를 수 있게 한다
      var tappable = proto && !got;
      var cell = document.createElement(tappable ? 'button' : 'div');
      if (tappable) {
        cell.type = 'button';
        cell.onclick = function () { location.href = spotUrl(sp); };
      }
      cell.className = 'cell' + (got ? ' got' : '') + (tappable ? ' tappable' : '');

      var n = document.createElement('div');
      n.className = 'n';
      n.textContent = got ? sp.item.name : String(sp.order);
      var l = document.createElement('div');
      l.className = 'l';
      l.textContent = sp.item.label;
      cell.appendChild(n); cell.appendChild(l);
      grid.appendChild(cell);
    });

    // placeNote 는 시공용 메모이므로 관람객에게 보이지 않는다. hint 만 쓴다.
    var nx = nextSpot();
    if (nx) {
      $('b-next').classList.remove('hidden');
      text('b-next-value', nx.place + (nx.hint ? ' · ' + nx.hint : ''));
    } else {
      $('b-next').classList.add('hidden');
    }

    text('b-rec-code', S.code);

    var cta = $('b-cta');
    if (isDone()) {
      cta.disabled = false;
      cta.textContent = CFG.strings.boardOpenCta;
      cta.onclick = resultScreen;
    } else {
      cta.disabled = true;
      cta.textContent = CFG.strings.boardLockedCta.replace('{total}', total());
      cta.onclick = null;
    }

    show('s-board');
  }

  /* ── 07 결과 — 한 번 만들면 다시 계산하지 않는다 ── */
  function computeResult() {
    var score = {};
    S.order.forEach(function (id) {
      var a = S.answers[id];
      if (!a) return;
      score[a.tag] = (score[a.tag] || 0) + 1;
    });

    var best = null, bestN = -1;
    Object.keys(score).forEach(function (t) {
      if (score[t] > bestN) { bestN = score[t]; best = t; }
    });

    // 동점이면 마지막 응답의 태그
    var tied = Object.keys(score).filter(function (t) { return score[t] === bestN; });
    if (tied.length > 1) {
      for (var i = S.order.length - 1; i >= 0; i--) {
        var t = S.answers[S.order[i]].tag;
        if (tied.indexOf(t) >= 0) { best = t; break; }
      }
    }
    return best;
  }

  function resultScreen() {
    if (!isDone()) { boardScreen(); return; }

    if (!S.result) {
      S.result = { tag: computeResult(), at: new Date().toISOString() };
      save();
      api('/api/complete', { sessionId: S.id, project: S.project, typeTag: S.result.tag });
    }

    var type = CFG.result.types[S.result.tag];
    if (!type) { boardScreen(); return; }

    text('r-name', type.name);
    text('r-desc', type.desc);

    var host = $('r-curation');
    host.innerHTML = '';
    (type.curation || []).forEach(function (c) {
      var box = document.createElement('div');
      box.className = 'box';
      var k = document.createElement('div');
      k.className = 'k';
      k.textContent = c.label;
      var v;
      if (c.url) {
        v = document.createElement('a');
        v.className = 'v';
        v.href = c.url;
        v.target = '_blank';
        v.rel = 'noopener';
      } else {
        v = document.createElement('div');
        v.className = 'v';
      }
      v.textContent = c.value;
      box.appendChild(k); box.appendChild(v);
      host.appendChild(box);
    });

    $('r-cta').onclick = finishScreen;
    $('r-save').onclick = function () {
      alert('결과 카드 이미지는 디자인 확정 후 연결됩니다.');
    };

    show('s-result');
  }

  /* ── 08 마무리 ─────────────────────────────────── */
  function finishScreen() {
    if (S.finish) { finishDone(); return; }

    pick.fin = null;
    buildOptions($('fin-options'), CFG.finish.messages, function (i) {
      pick.fin = i;
      $('fin-cta').disabled = false;
    });
    $('fin-cta').disabled = true;

    $('fin-cta').onclick = function () {
      if (pick.fin === null) return;
      S.finish = { message: CFG.finish.messages[pick.fin], at: new Date().toISOString() };
      save();
      api('/api/message', { sessionId: S.id, project: S.project, nickname: S.nickname, message: S.finish.message });
      finishDone();
    };

    show('s-finish');
  }

  function finishDone() {
    text('fin-badge', CFG.strings.finishBadge);
    text('fin-title', CFG.strings.finishDoneTitle);
    text('fin-body', CFG.strings.finishDoneBody);
    $('fin-options').innerHTML = '';

    var box = document.createElement('div');
    box.className = 'box';
    var k = document.createElement('div');
    k.className = 'k';
    k.textContent = S.nickname;
    var v = document.createElement('div');
    v.className = 'v';
    v.textContent = S.finish.message;
    box.appendChild(k); box.appendChild(v);
    $('fin-options').appendChild(box);

    text('fin-note', '');
    var cta = $('fin-cta');
    cta.disabled = false;
    cta.textContent = CFG.strings.boardTitle;
    cta.onclick = boardScreen;

    show('s-finish');
  }

  /* ── 안내 화면 ─────────────────────────────────── */
  function notice(title, body, onOk) {
    text('n-title', title);
    text('n-body', body);
    $('n-cta').onclick = onOk || boardScreen;
    show('s-notice');
  }

  /* ── 시작 ──────────────────────────────────────── */
  function periodClosed() {
    var p = CFG.period || {};
    if (!p.open && !p.close) return false;
    var today = new Date().toISOString().slice(0, 10);
    if (p.open && today < p.open) return true;
    if (p.close && today > p.close) return true;
    return false;
  }

  function boot(url) {
    applyTheme(CFG.theme);
    fillStrings();

    S = load(url.project);
    if (!S) {
      S = {
        v: 1, project: url.project, id: uuid(), nickname: '',
        code: makeCode(), answers: {}, order: [], result: null, finish: null,
      };
      save();
    }

    if (periodClosed()) {
      notice(CFG.strings.closedTitle, CFG.strings.closedBody, function () { /* 머무름 */ });
      $('n-cta').classList.add('hidden');
      return;
    }

    // QR 로 들어온 경우 스팟을 찾는다
    cur = url.spot ? spotById(url.spot) : null;

    if (url.spot && !cur) {
      notice(CFG.strings.badTokenTitle, CFG.strings.badTokenBody);
      return;
    }
    if (cur && cur.token && url.token && url.token !== cur.token) {
      notice(CFG.strings.badTokenTitle, CFG.strings.badTokenBody);
      return;
    }

    // 주소를 정리해 새로고침 시 다시 처리되지 않게 한다
    if (url.spot && history.replaceState) {
      history.replaceState(null, '', location.pathname + (url.project ? '?p=' + url.project : ''));
    }

    if (!S.nickname) { startScreen(); return; }

    if (cur) {
      if (S.answers[cur.id]) { notice(CFG.strings.alreadyTitle, CFG.strings.alreadyBody); return; }
      openSpot(cur);
      return;
    }

    if (S.finish) { finishDone(); return; }
    boardScreen();
  }

  /* 설정 파일 불러오기 */
  var url = readUrl();
  fetch('config/' + url.project + '.json', { cache: 'no-store' })
    .then(function (r) {
      if (!r.ok) throw new Error('설정 파일을 찾지 못했습니다 (' + r.status + ')');
      return r.json();
    })
    .then(function (cfg) { CFG = cfg; boot(url); })
    .catch(function (e) {
      document.body.innerHTML =
        '<div style="padding:40px;font-family:sans-serif;color:#F1EEE6">'
        + '<p>설정 파일을 불러오지 못했습니다.</p><p style="color:#B5BDCB;font-size:14px">'
        + String(e.message) + '</p></div>';
    });
})();
