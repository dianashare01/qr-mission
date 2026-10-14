/* 관리자 화면 공통 로직
 *
 * 각 페이지가 아래 두 값을 먼저 정해 둡니다.
 *   window.ADMIN_PROJECT  'wianbu' 또는 'inje'
 *   window.ADMIN_TITLE    화면에 보일 전시 이름
 *
 * 서버 주소는 여기에 적혀 있어 현장에서는 코드만 치면 됩니다.
 */

(function () {
  'use strict';

  var API = 'https://qr-mission-api.jhmonounity.workers.dev';

  var PROJECT = window.ADMIN_PROJECT || 'wianbu';
  var TITLE = window.ADMIN_TITLE || '';
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

  function get(path, code) {
    var sep = path.indexOf('?') >= 0 ? '&' : '?';
    return fetch(API + path + sep + 'key=' + encodeURIComponent(code) + '&project=' + encodeURIComponent(PROJECT))
      .then(function (r) { return r.json().catch(function () { return null; }); });
  }

  function fail(msg) {
    $('err').textContent = msg;
    $('err').classList.remove('hidden');
  }

  function load(code) {
    $('go').disabled = true;
    $('err').classList.add('hidden');

    Promise.all([get('/api/admin/stats', code), get('/api/admin/messages', code)])
      .then(function (res) {
        $('go').disabled = false;
        var st = res[0], ms = res[1];

        if (!st || !st.ok) {
          fail(st && st.error ? st.error : '코드가 맞지 않습니다.');
          try { localStorage.removeItem(STORE); } catch (e) {}
          return;
        }

        try { localStorage.setItem(STORE, code); } catch (e) {}

        $('login').classList.add('hidden');
        $('panel').classList.remove('hidden');
        $('updated').textContent = '마지막 갱신 ' + new Date().toLocaleTimeString('ko-KR');

        $('stats').innerHTML = [
          ['시작', st.started], ['완주', st.finished], ['완주율', st.completionRate + '%'],
          ['리워드 수령', st.redeemed], ['남긴 기록', st.messaged],
        ].map(function (s) {
          return '<div class="stat"><div class="k">' + s[0] + '</div><div class="v">' + s[1] + '</div></div>';
        }).join('');

        table($('spot-table'), ['스팟', '스캔 수'], (st.bySpot || []).map(function (r) { return [r.spot_id, r.n]; }));
        $('spot-card').classList.toggle('hidden', !(st.bySpot || []).length);

        table($('type-table'), ['유형', '인원'], (st.byType || []).map(function (r) { return [r.type_tag, r.n]; }));
        $('type-card').classList.toggle('hidden', !(st.byType || []).length);

        if (ms && ms.ok) {
          $('msg-sum').textContent = '모두 ' + ms.total + '건' + (ms.total ? ' · 최근 것부터' : '');
          table($('msg-choice'), ['고른 문장', '인원'],
            (ms.byMessage || []).map(function (r) { return [r.message, r.n]; }));
          table($('msg-table'), ['번호', '이름', '남긴 문장', '시각'],
            (ms.messages || []).map(function (r, i) { return [ms.total - i, r.nickname, r.message, kst(r.created_at)]; }));
          $('msg-card').classList.remove('hidden');
        } else {
          $('msg-card').classList.add('hidden');
        }

        // CSV 는 코드를 주소에 담아 내려받습니다
        $('csv-stats').onclick = function () {
          location.href = API + '/api/admin/stats?format=csv&project=' + PROJECT + '&key=' + encodeURIComponent(code);
        };
        $('csv-msg').onclick = function () {
          location.href = API + '/api/admin/messages?format=csv&project=' + PROJECT + '&key=' + encodeURIComponent(code);
        };
        $('refresh').onclick = function () { load(code); };
        $('logout').onclick = function () {
          try { localStorage.removeItem(STORE); } catch (e) {}
          location.reload();
        };
      })
      .catch(function (e) {
        $('go').disabled = false;
        fail('서버에 연결하지 못했습니다. (' + e.message + ')');
      });
  }

  /* 시작 */
  document.title = TITLE + ' 관리자';
  $('title').textContent = TITLE;
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
  try { saved = localStorage.getItem(STORE); } catch (e) {}
  if (saved) load(saved); else $('code').focus();
})();
