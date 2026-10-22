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

    return {
      project: project || 'wianbu',
      spot: spot,
      token: token,
      reset: q.get('reset') === '1',   // 시연·점검용으로 기록을 지우고 처음부터
    };
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
  function serverBase() {
    return String((CFG.api && CFG.api.baseUrl) || '').replace(/\/+$/, '');
  }
  function hasServer() { return !!serverBase(); }

  function api(path, body) {
    var base = serverBase();
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

  /* 서버에서 읽어 오기 (GET) */
  function apiGet(path) {
    var base = serverBase();
    if (!base) return Promise.resolve(null);

    var stop = new AbortController();
    var timer = setTimeout(function () { stop.abort(); }, 8000);

    return fetch(base + path, { signal: stop.signal, cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json().catch(function () { return null; }) : null; })
      .catch(function () { return null; })
      .finally(function () { clearTimeout(timer); });
  }

  /* 이어 하기 번호로 다른 기기의 진행 상황을 가져온다 */
  function restoreByCode(code, onDone) {
    apiGet('/api/state?project=' + encodeURIComponent(S.project) + '&code=' + encodeURIComponent(code))
      .then(function (r) {
        if (!r || !r.ok) { alert(CFG.strings.restoreFail || '번호를 찾지 못했습니다.'); onDone(false); return; }

        var answers = {}, order = [];
        (r.answers || []).forEach(function (a) {
          answers[a.spot_id] = {
            k: a.k_choice, kOk: !!a.k_correct, p: a.p_choice,
            tag: a.p_tag || null, value: a.p_value, at: a.answered_at,
          };
          order.push(a.spot_id);
        });

        S.id = r.sessionId;
        S.nickname = r.nickname || S.nickname;
        S.code = r.recoveryCode || code;
        S.answers = answers;
        S.order = order;
        S.result = r.result ? { tag: r.result.type_tag, at: r.result.created_at } : null;
        S.finish = r.redeem
          ? { redeemed: true, reward: (CFG.finish && CFG.finish.rewardName), at: r.redeem.redeemed_at }
          : (r.message ? { message: r.message.message, at: r.message.created_at } : null);
        save();
        onDone(true);
      });
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
  /* 설정에 적힌 글꼴을 구글 폰트에서 불러온다.
     theme.fonts 는 구글 폰트 주소에 쓰는 형식 그대로 적습니다.
     예) ["Gowun+Batang:wght@400;700", "Gowun+Dodum"] */
  function loadFonts(t) {
    var fams = (t && t.fonts) || [];
    if (!fams.length) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=' + fams.join('&family=') + '&display=swap';
    document.head.appendChild(link);
  }

  function applyTheme(t) {
    if (!t) return;
    loadFonts(t);
    var r = document.documentElement.style;
    if (t.bg) r.setProperty('--bg', t.bg);
    if (t.surface) r.setProperty('--surface', t.surface);
    if (t.ink) r.setProperty('--ink', t.ink);
    if (t.inkSub) r.setProperty('--ink-sub', t.inkSub);
    if (t.accent) r.setProperty('--accent', t.accent);
    if (t.line) r.setProperty('--line', t.line);
    if (t.onAccent) r.setProperty('--on-accent', t.onAccent);
    if (t.paper) r.setProperty('--paper', t.paper);
    if (t.paperInk) r.setProperty('--paper-ink', t.paperInk);
    if (t.paperSub) r.setProperty('--paper-sub', t.paperSub);
    if (t.paperSoft) r.setProperty('--paper-soft', t.paperSoft);
    if (t.paperLine) r.setProperty('--paper-line', t.paperLine);
    if (t.note) r.setProperty('--note', t.note);
    if (t.radius != null) r.setProperty('--radius', t.radius + 'px');
    if (t.radiusLg != null) r.setProperty('--radius-lg', t.radiusLg + 'px');
    if (t.fontDisplay) r.setProperty('--font-display', "'" + t.fontDisplay + "', serif");
    if (t.fontBody) r.setProperty('--font-body', "'" + t.fontBody + "', sans-serif");

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta && t.bg) meta.setAttribute('content', t.bg);
  }

  function fillStrings() {
    var s = CFG.strings;
    document.title = CFG.title;
    text('brand', CFG.title);

    text('hero-note', s.heroNote || '키비주얼 영역 [디자이너]');
    text('start-title', s.startTitle);
    text('start-body', s.startBody);
    text('nick-label', s.nickLabel);
    $('nick').placeholder = s.nickPlaceholder || '';
    text('start-cta', s.startCta);
    text('privacy-note', s.privacyNote);

    // 흰 카드 위에 놓이는 쪽 제목 — 문제·해설·나의 생각 화면에 같은 글이 들어갑니다
    var headline = s.quizHeadline || '';
    Array.prototype.forEach.call(document.querySelectorAll('.quiz-head'), function (e) {
      e.textContent = headline;
    });

    text('k-hint', s.pickHint || '');
    text('p-hint', s.pickHint || '');
    text('f-cta', s.feedbackCta);
    text('b-foot', s.footerLine || '');

    text('c-note', s.collectNote);
    text('c-cta', s.collectCta);

    text('b-title', s.boardTitle);
    text('b-next-label', s.boardNextLabel);
    text('b-free', s.boardFreeOrder);
    text('b-rec-label', s.recoveryLabel);
    text('b-rec-note', s.recoveryNote);
    text('b-legend-done', s.legendDone || '참여 완료');
    text('b-legend-todo', s.legendTodo || '미참여');

    text('r-eyebrow', s.resultEyebrow);
    text('r-curation-title', s.resultCurationTitle);
    text('r-cta', s.resultCta);

    text('fin-badge', s.finishBadge);
    text('fin-title', s.finishTitle);
    text('fin-body', s.finishBody);
    text('fin-note', s.finishNote);
    text('fin-cta', s.finishCta);
  }

  /* ── 선택지 만들기 ───────────────────────────────
     보기는 A·B·C·D 동그라미와 글, 그리고 오른쪽 작은 표시로 이루어집니다. */
  var AB = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  function optionRow(i, label, tag, asDiv) {
    var b = document.createElement(asDiv ? 'div' : 'button');
    if (!asDiv) b.type = 'button';
    b.className = 'opt';

    var ab = document.createElement('span');
    ab.className = 'ab';
    ab.textContent = AB[i] || String(i + 1);

    var lb = document.createElement('span');
    lb.className = 'lb';
    lb.textContent = label;

    b.appendChild(ab);
    b.appendChild(lb);

    if (tag) {
      var t = document.createElement('span');
      t.className = 'tag';
      t.textContent = tag;
      b.appendChild(t);
    }
    return b;
  }

  function buildOptions(host, labels, onPick) {
    host.innerHTML = '';
    labels.forEach(function (label, i) {
      var b = optionRow(i, label);
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () {
        Array.prototype.forEach.call(host.children, function (c) { c.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        onPick(i);
      });
      host.appendChild(b);
    });
  }

  /* 맞고 틀림을 드러내는 프로젝트인지 — 설정에서만 갈립니다.
     위안부처럼 correctLabel 과 wrongLabel 이 같으면 드러내지 않습니다. */
  function showsCorrectness() {
    var t = CFG.tone || {};
    return !!(t.wrongLabel && t.wrongLabel !== t.correctLabel);
  }

  /* 화면 아래 여섯 칸 띠 — 지금 어디인지, 어디를 다녀왔는지 */
  function renderPills() {
    var hosts = document.querySelectorAll('.pills');
    var reveal = showsCorrectness();

    Array.prototype.forEach.call(hosts, function (host) {
      host.innerHTML = '';
      CFG.spots.forEach(function (sp) {
        var a = S.answers[sp.id];
        var d = document.createElement('div');
        var cls = 'pill';
        var label = String(sp.order);

        if (cur && sp.id === cur.id) {
          cls += ' now';
        } else if (a) {
          if (reveal) {
            cls += a.kOk ? ' ok' : ' no';
            label = a.kOk ? '✓' : '✕';
          } else {
            cls += ' ok';
          }
        }

        d.className = cls;
        d.textContent = label;
        host.appendChild(d);
      });
    });
  }

  /* 퀴즈 목록 위의 진행 막대 */
  function renderSteps(id) {
    var host = $(id || 'b-steps');
    if (!host) return;
    host.innerHTML = '';
    CFG.spots.forEach(function (sp) {
      var i = document.createElement('i');
      if (S.answers[sp.id]) i.className = 'on';
      host.appendChild(i);
    });
  }

  /* 「QUIZ · 2 / 6」 같은 머리말 */
  function countLine() {
    return String(CFG.strings.boardEyebrowFormat || CFG.strings.boardCountFormat || '')
      .replace('{total}', total())
      .replace('{done}', doneCount());
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
    // 퀴즈 목록 화면의 윗부분을 그대로 쓰고, 목록 자리에 이름을 적습니다
    text('st-eyebrow', countLine());
    text('st-foot', CFG.strings.footerLine || '');
    renderSteps('st-steps');
    show('s-start');

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

      var go = function () { if (cur) openSpot(cur); else boardScreen(); };

      if (!hasServer()) { go(); return; }

      // 서버가 있으면 세션을 먼저 만들어 번호를 받는다
      var btn = $('start-cta');
      btn.disabled = true;
      api('/api/session', { project: S.project, nickname: v, lang: 'ko' }).then(function (r) {
        btn.disabled = false;
        if (r && r.ok && r.sessionId) {
          S.id = r.sessionId;
          S.code = r.recoveryCode || S.code;
          save();
        }
        go();   // 서버가 안 되더라도 체험은 이어진다
      });
    };
  }

  /* ── 02 기록 확인 ──────────────────────────────── */
  function openSpot(spot) {
    cur = spot;
    pick.k = null; pick.p = null;

    barCount();

    // 시안대로 「4. 삶이 보여준 증언」 처럼 적습니다
    var head = spot.order + '. ' + (spot.item.label || spot.place);
    text('k-place', head);
    text('f-place', head);
    text('p-place', head);

    var qno = 'Q' + spot.order;
    text('k-label', qno);
    text('f-label', qno);
    text('p-label', CFG.tone.preferenceLabel);

    text('k-q', spot.knowledge.q);
    // 보기를 누르면 바로 해설로 넘어갑니다 (확인 단추 없음)
    buildOptions($('k-options'), spot.knowledge.options, function (i) {
      pick.k = i;
      feedbackScreen();
    });

    renderPills();
    show('s-knowledge');
  }

  /* ── 03 해설 ──────────────────────────────────────
     위안부처럼 correctLabel 과 wrongLabel 이 같으면 맞고 틀림이 드러나지 않고,
     박인환처럼 다르면 정답·오답 표현이 나옵니다. 설정으로만 갈립니다. */
  function feedbackScreen() {
    var k = cur.knowledge;
    var s = CFG.strings || {};
    var right = pick.k === k.answer;
    var reveal = showsCorrectness();

    text('f-q', k.q);
    text('f-title', right ? CFG.tone.correctLabel : (CFG.tone.wrongLabel || CFG.tone.correctLabel));
    text('f-text', k.explain || '');

    // 기록에 적힌 답을 보여 주고, 다르게 고르셨다면 고른 것도 위에 함께 둡니다
    var rows = $('f-rows');
    rows.innerHTML = '';
    if (!right) {
      var mine = optionRow(pick.k, k.options[pick.k], s.myPickTag || '내 선택', true);
      mine.className = 'opt ansrow is-mine';
      rows.appendChild(mine);
    }
    var ans = optionRow(k.answer, k.options[k.answer],
      reveal ? (s.answerTag || '정답') : (s.recordTag || '기록'), true);
    ans.className = 'opt ansrow is-answer';
    rows.appendChild(ans);

    $('f-cta').onclick = preferenceScreen;
    show('s-feedback');
  }

  /* ── 04 나의 생각 ──────────────────────────────── */
  function preferenceScreen() {
    var p = cur.preference;
    text('p-q', p.q);
    // 여기도 보기를 누르면 바로 다음으로 넘어갑니다
    buildOptions($('p-options'), p.options.map(function (o) { return o.label; }), function (i) {
      pick.p = i;
      recordSpot();
      collectScreen();
    });

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
      // 태그가 없는 문항(박인환 MBTI)은 유형 산정에 넣지 않고 값만 남긴다
      tag: opt.tag || null,
      value: opt.value || opt.label,
      at: new Date().toISOString(),
    };
    S.order.push(cur.id);
    save();

    api('/api/answer', {
      sessionId: S.id, project: S.project, spotId: cur.id, token: cur.token,
      kChoice: pick.k, kCorrect: pick.k === k.answer,
      pChoice: pick.p, pTag: opt.tag || null, pValue: opt.value || opt.label,
    });
  }

  /* ── 05 획득 ───────────────────────────────────── */
  function collectScreen() {
    var n = doneCount();
    var ord = CFG.strings.ordinals[n - 1] || n;

    // 수집품은 임시 페이지 모양 — 일러스트 확정 전까지 PAGE N 과 구역명만 보여 준다
    text('c-name', cur.item.name);
    text('c-place', cur.item.label || cur.place);
    text('c-cap', CFG.strings.itemArtNote || '');

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

    text('b-eyebrow', countLine());
    text('b-count', CFG.strings.boardBody || '');

    var proto = isPrototype();
    $('b-demo-note').classList.toggle('hidden', !proto || isDone());

    renderSteps();

    var doneLabel = CFG.strings.legendDone || '참여 완료';
    var todoLabel = CFG.strings.legendTodo || '미참여';

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
      n.className = 'cn';
      n.textContent = String(sp.order);
      var l = document.createElement('div');
      l.className = 'cl';
      l.textContent = sp.item.label;
      var st = document.createElement('div');
      st.className = 'cs';
      st.textContent = got ? doneLabel : todoLabel;

      cell.appendChild(n); cell.appendChild(l); cell.appendChild(st);
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

    // 다른 기기에서 이어 하기 — 서버가 있을 때만
    var restore = $('b-restore');
    restore.classList.toggle('hidden', !hasServer());
    restore.textContent = CFG.strings.restoreCta || '다른 기기에서 이어 하기';
    restore.onclick = function () {
      var code = window.prompt(CFG.strings.restorePrompt || '이어 하기 번호 6자리를 입력해 주세요.');
      if (code === null) return;
      code = String(code).trim();
      if (!/^\d{6}$/.test(code)) { alert('6자리 숫자를 입력해 주세요.'); return; }
      restore.disabled = true;
      restoreByCode(code, function (ok) {
        restore.disabled = false;
        if (ok) boardScreen();
      });
    };

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
      if (!a || !a.tag) return;          // 태그 없는 문항은 셈에서 뺀다
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
        if (t && tied.indexOf(t) >= 0) { best = t; break; }
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

    // AI 시 — 서버가 붙기 전에는 자리표시만 보여 준다
    var poemCfg = CFG.result.poem;
    if (poemCfg) {
      $('r-poem').classList.remove('hidden');
      text('r-poem-label', poemCfg.label || '');
      text('r-poem-text', (S.poem && S.poem.text) || poemCfg.placeholder || '');
    } else {
      $('r-poem').classList.add('hidden');
    }

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

    show('s-result');
  }

  /* ── 08 마무리 ─────────────────────────────────────
     mode 로 갈립니다.
       message — 승인 문장 택 1 (위안부)
       redeem  — 리워드 수령, 운영요원 확인 (박인환·K-컬처) */
  function finishScreen() {
    if (S.finish) { finishDone(); return; }
    if ((CFG.finish.mode || 'message') === 'redeem') { redeemScreen(); return; }

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

      // 서버가 "몇 번째 기록인지" 를 돌려줍니다
      api('/api/message', { sessionId: S.id, project: S.project, nickname: S.nickname, message: S.finish.message })
        .then(function (r) {
          if (r && r.ok && r.seq) { S.finish.seq = r.seq; save(); }
          finishDone();
        });

      finishDone();   // 서버를 기다리지 않고 먼저 보여 줍니다
    };

    show('s-finish');
  }

  /* 리워드 수령형 — 운영요원이 PIN 을 넣어야 수령 완료로 고정된다 */
  function redeemScreen() {
    text('fin-badge', CFG.strings.finishBadge);
    text('fin-title', CFG.strings.finishTitle);
    text('fin-body', CFG.strings.finishBody);
    text('fin-note', CFG.strings.finishNote);

    var host = $('fin-options');
    host.innerHTML = '';
    var box = document.createElement('div');
    box.className = 'box lg';
    var k = document.createElement('div');
    k.className = 'k';
    k.textContent = CFG.strings.rewardLabel || '받으실 것';
    var v = document.createElement('div');
    v.className = 'v-lg';
    v.textContent = CFG.finish.rewardName || '';
    box.appendChild(k); box.appendChild(v);
    host.appendChild(box);

    var cta = $('fin-cta');
    cta.disabled = false;
    cta.textContent = CFG.strings.finishCta;
    cta.onclick = function () {
      var pin = null;
      if (CFG.finish.staffPin) {
        pin = window.prompt(CFG.strings.pinPrompt || '운영요원 확인 번호를 입력해 주세요.');
        if (pin === null) return;
        pin = String(pin).trim();
      }

      var done = function () {
        S.finish = { redeemed: true, reward: CFG.finish.rewardName, at: new Date().toISOString() };
        save();
        finishDone();
      };

      // 서버가 있으면 번호 확인과 중복 수령 방지를 서버가 맡는다
      if (hasServer()) {
        cta.disabled = true;
        api('/api/redeem', { sessionId: S.id, project: S.project, pin: pin }).then(function (r) {
          cta.disabled = false;
          if (!r) { alert(CFG.strings.offlineNote || '서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.'); return; }
          if (!r.ok) { alert(r.error || CFG.strings.pinWrong || '번호가 맞지 않습니다.'); return; }
          done();
        });
        return;
      }

      // 서버가 없을 때만 설정 파일의 번호로 확인합니다 (시연용)
      if (CFG.finish.staffPin && pin !== String(CFG.finish.pin || '')) {
        alert(CFG.strings.pinWrong || '번호가 맞지 않습니다.');
        return;
      }
      done();
    };

    show('s-finish');
  }

  /** 앞서 다녀간 분들의 기록을 가져와 보여 준다 (번호는 보여 주지 않습니다) */
  function loadRecent() {
    var box = $('fin-recent');
    var n = (CFG.finish && CFG.finish.showRecent) || 0;
    if (!n || !hasServer()) { box.classList.add('hidden'); return; }

    apiGet('/api/messages/recent?project=' + encodeURIComponent(S.project) + '&limit=' + n)
      .then(function (r) {
        if (!r || !r.ok || !(r.items || []).length) { box.classList.add('hidden'); return; }

        text('fin-recent-label', CFG.strings.recentLabel || '');

        var host = $('fin-recent-list');
        host.innerHTML = '';
        r.items.forEach(function (m) {
          var row = document.createElement('div');
          row.className = 'recent-item' + (S.finish && m.seq === S.finish.seq ? ' mine' : '');

          var who = document.createElement('div');
          who.className = 'who';
          who.textContent = m.nickname;

          var what = document.createElement('div');
          what.className = 'what';
          what.textContent = m.message;

          row.appendChild(who); row.appendChild(what);
          host.appendChild(row);
        });

        box.classList.remove('hidden');
      });
  }

  function finishDone() {
    text('fin-badge', CFG.strings.finishBadge);
    text('fin-title', CFG.strings.finishDoneTitle);
    text('fin-body', CFG.strings.finishDoneBody);

    loadRecent();
    $('fin-options').innerHTML = '';

    var box = document.createElement('div');
    box.className = 'box';
    var k = document.createElement('div');
    k.className = 'k';
    k.textContent = S.finish.redeemed ? (CFG.strings.rewardLabel || '받으실 것') : S.nickname;
    var v = document.createElement('div');
    v.className = 'v';
    v.textContent = S.finish.redeemed ? S.finish.reward : S.finish.message;
    box.appendChild(k); box.appendChild(v);
    $('fin-options').appendChild(box);

    text('fin-note', '');
    var cta = $('fin-cta');
    cta.disabled = false;
    cta.textContent = CFG.strings.boardCta || CFG.strings.boardTitle;
    cta.onclick = boardScreen;

    show('s-finish');
  }

  /* ── 안내 화면 ─────────────────────────────────── */
  function notice(title, body, onOk, alt) {
    text('n-title', title);
    text('n-body', body);
    $('n-cta').onclick = onOk || boardScreen;

    // 두 번째 버튼이 필요할 때만 (예: 다시 고르기)
    var a = $('n-alt');
    if (alt) {
      a.classList.remove('hidden');
      a.textContent = alt.label;
      a.onclick = alt.onClick;
    } else {
      a.classList.add('hidden');
      a.onclick = null;
    }

    show('s-notice');
  }

  /* 고른 것을 지우고 그 스팟을 다시 풀게 한다.
     명세는 "응답 수정 불가" 이므로 설정에서 켠 경우에만 동작합니다. */
  function retake(spot) {
    delete S.answers[spot.id];
    S.order = S.order.filter(function (id) { return id !== spot.id; });

    // 응답이 바뀌면 유형도 달라지므로 결과를 지워 다시 계산되게 합니다
    S.result = null;
    S.finish = null;
    save();

    if (hasServer()) {
      api('/api/answer/delete', { sessionId: S.id, project: S.project, spotId: spot.id });
    }

    openSpot(spot);
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

    /* 주소 뒤에 &reset=1 을 붙이면 이 기기에 쌓인 기록을 지우고 처음부터 시작합니다.
       개막 뒤에는 쓰지 못하도록, 시연용(prototype: true) 일 때만 동작합니다. */
    if (url.reset && isPrototype()) {
      try { localStorage.removeItem(key(url.project)); } catch (e) { /* 저장소를 못 쓰는 경우 */ }
    }

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
      if (S.answers[cur.id]) {
        // 설정에서 허용했을 때만 "다시 고르기" 를 띄웁니다
        var alt = CFG.allowRetake
          ? { label: CFG.strings.retakeCta || '다시 고르기', onClick: function () { retake(cur); } }
          : null;
        notice(
          CFG.strings.alreadyTitle,
          CFG.allowRetake ? (CFG.strings.alreadyRetakeBody || CFG.strings.alreadyBody) : CFG.strings.alreadyBody,
          null, alt
        );
        return;
      }
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
