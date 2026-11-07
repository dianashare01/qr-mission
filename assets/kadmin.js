/* KOREA, CHECK-IN 관리자 화면
 *
 * 위안부·박인환 쪽(assets/admin.js)과 보는 것이 달라 따로 두었습니다.
 * 그쪽은 「퀴즈 답·남긴 문장」을, 이쪽은 「다녀간 수·이름 목록·도장」을 봅니다.
 *
 * 쪽에서 먼저 정해 두는 값
 *   window.ADMIN_PROJECT  'kcheckin'   — 사람·도장을 가를 이름
 *   window.ADMIN_SITE     'kcheckin'   — 다녀간 수를 가를 이름
 *   window.ADMIN_TITLE                 — 화면에 보일 전시 이름
 */

(function () {
  'use strict';

  // 내 컴퓨터에서 확인할 때는 가까이 있는 서버를 씁니다 (wrangler dev)
  var LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var API = LOCAL ? 'http://127.0.0.1:8787' : 'https://qr-mission-api.jhmonounity.workers.dev';

  /* 전시가 여럿이면 위에 고르는 단추가 생깁니다.
     쪽에서 window.ADMIN_SHOWS = [{ key, site, title }, …] 로 넘깁니다. */
  var SHOWS = window.ADMIN_SHOWS || [{
    key: window.ADMIN_PROJECT || 'kcheckin',
    site: window.ADMIN_SITE || 'kcheckin',
    title: window.ADMIN_TITLE || ''
  }];
  var cur = 0;
  // 맨 위·창 이름에 쓰는 이름은 전시와 따로입니다
  var HEAD = window.ADMIN_TITLE || SHOWS[0].title;
  var PROJECT = SHOWS[0].key;
  var SITE = SHOWS[0].site;
  var TITLE = SHOWS[0].title;
  var STORE = 'qrm-admin-code';     // 코드는 이 브라우저에만 남습니다

  var $ = function (id) { return document.getElementById(id); };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function table(el, head, rows) {
    el.innerHTML = '<tr>' + head.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr>'
      + rows.map(function (r) {
        return '<tr>' + r.map(function (c) {
          return '<td' + (typeof c === 'number' ? ' class="n"' : '') + '>' + esc(c) + '</td>';
        }).join('') + '</tr>';
      }).join('');
  }

  /* UTC 를 한국 시간으로 */
  function kst(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false });
  }

  var LANGS = { en: '영문', zhCN: '중문 간체', zhTW: '중문 번체', ko: '한국어', ja: '일본어' };

  function get(path, code, extra) {
    return fetch(API + path + '?key=' + encodeURIComponent(code) + (extra || ''))
      .then(function (r) { return r.json().catch(function () { return null; }); });
  }

  function fail(msg) {
    $('err').textContent = msg;
    $('err').classList.remove('hidden');
  }

  /* 내려받는 주소 — 코드를 주소에 담습니다 */
  function csvUrl(path, code, extra) {
    return API + path + '?format=csv&key=' + encodeURIComponent(code) + (extra || '');
  }

  /* 고르는 단추 줄 */
  function shows(code) {
    var box = $('shows');
    if (!box || SHOWS.length < 2) return;
    box.innerHTML = SHOWS.map(function (s, i) {
      return '<button class="ghost' + (i === cur ? ' on' : '') + '" data-i="' + i + '">'
        + esc(s.title) + '</button>';
    }).join('');
    Array.prototype.forEach.call(box.querySelectorAll('button'), function (b) {
      b.onclick = function () {
        cur = +b.dataset.i;
        PROJECT = SHOWS[cur].key;
        SITE = SHOWS[cur].site;
        TITLE = SHOWS[cur].title;
        $('title2').textContent = TITLE;
        load(code);
      };
    });
  }

  function load(code) {
    $('go').disabled = true;
    $('err').classList.add('hidden');

    Promise.all([
      get('/api/admin/sessions', code, '&project=' + encodeURIComponent(PROJECT)),
      get('/api/admin/visits', code, '&site=' + encodeURIComponent(SITE) + '&days=60'),
      get('/api/admin/stats', code, '&project=' + encodeURIComponent(PROJECT))
    ])
      .then(function (res) {
        $('go').disabled = false;
        var ss = res[0], vs = res[1], st = res[2];

        if (!ss || !ss.ok) {
          fail(ss && ss.error ? ss.error : '코드가 맞지 않습니다.');
          try { localStorage.removeItem(STORE); } catch (e) { /* 저장소를 못 쓰는 경우 */ }
          return;
        }

        try { localStorage.setItem(STORE, code); } catch (e) { /* 저장소를 못 쓰는 경우 */ }

        $('login').classList.add('hidden');
        $('panel').classList.remove('hidden');
        $('updated').textContent = '마지막 갱신 ' + new Date().toLocaleTimeString('ko-KR');
        shows(code);

        /* ── 한눈에 ───────────────────────────── */
        var views = 0, uniq = 0;
        (vs && vs.byPage ? vs.byPage : []).forEach(function (r) { views += r.views; uniq += r.uniq; });

        var done = (ss.sessions || []).filter(function (r) { return r.redeemedAt; }).length;

        $('stats').innerHTML = [
          ['다녀간 수', views],
          ['사람 수', uniq],
          ['이름 적은 분', ss.total],
          ['선물 받은 분', done]
        ].map(function (s) {
          return '<div class="stat"><div class="k">' + s[0] + '</div><div class="v">' + s[1] + '</div></div>';
        }).join('');

        $('since').textContent = (vs && vs.since)
          ? ('센 날짜 ' + vs.since + ' 부터')
          : '아직 다녀간 기록이 없습니다. (화면을 열어야 쌓이기 시작합니다)';

        /* ── 들어온 분들 ──────────────────────── */
        var list = ss.sessions || [];
        $('who-sum').textContent = '모두 ' + ss.total + '명' + (ss.total ? ' · 최근 분부터' : '');
        table($('who-table'),
          ['번호', '이름', '언어', '도장', '선물', '들어온 때'],
          list.map(function (r, i) {
            return [
              ss.total - i,
              r.nickname,
              LANGS[r.lang] || r.lang || '',
              r.stamps,
              r.redeemedAt ? '받음' : '',
              kst(r.createdAt)
            ];
          }));
        $('who-card').classList.toggle('hidden', !list.length);

        /* ── 정류장별 ─────────────────────────── */
        var bySpot = (st && st.bySpot) || [];
        table($('spot-table'), ['정류장', '도장 수'],
          bySpot.map(function (r) { return [r.spot_id, r.n]; }));
        $('spot-card').classList.toggle('hidden', !bySpot.length);

        /* ── 날짜별 ───────────────────────────── */
        var rows = (vs && vs.rows) || [];
        table($('day-table'), ['날짜', '화면', '다녀간 수', '사람 수'],
          rows.map(function (r) { return [r.day, r.page, r.views, r.uniq]; }));
        $('day-card').classList.toggle('hidden', !rows.length);

        /* ── 내려받기 ─────────────────────────── */
        $('csv-sessions').onclick = function () {
          location.href = csvUrl('/api/admin/sessions', code, '&project=' + encodeURIComponent(PROJECT));
        };
        $('csv-visits').onclick = function () {
          location.href = csvUrl('/api/admin/visits', code, '&site=' + encodeURIComponent(SITE) + '&days=365');
        };
        $('csv-stats').onclick = function () {
          location.href = csvUrl('/api/admin/stats', code, '&project=' + encodeURIComponent(PROJECT));
        };
        $('refresh').onclick = function () { load(code); };
        $('logout').onclick = function () {
          try { localStorage.removeItem(STORE); } catch (e) { /* 저장소를 못 쓰는 경우 */ }
          location.reload();
        };
      })
      .catch(function (e) {
        $('go').disabled = false;
        fail('서버에 연결하지 못했습니다. (' + e.message + ')');
      });
  }

  /* 시작 */
  document.title = HEAD + ' 관리자';
  $('title').textContent = HEAD;
  $('title2').textContent = TITLE;

  $('go').addEventListener('click', function () {
    var c = $('code').value.trim();
    if (!c) { fail('코드를 넣어 주세요.'); return; }
    load(c);
  });
  $('code').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') $('go').click();
  });

  // 전에 들어온 적이 있으면 바로 열어 줍니다
  var saved = null;
  try { saved = localStorage.getItem(STORE); } catch (e) { /* 저장소를 못 쓰는 경우 */ }
  if (saved) load(saved); else $('code').focus();
})();
