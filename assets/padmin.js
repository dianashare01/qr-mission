/* 영수증 관리자 화면
 *
 * 손님이 올린 사진을 보고, 내려받고, 지웁니다.
 * 사진 자체는 Supabase Storage 창고에 있고 여기서는 주소만 다룹니다.
 * 서버가 하루 한 번 깨어나 한 달 지난 것을 치웁니다.
 */

(function () {
  'use strict';

  // 내 컴퓨터에서 확인할 때는 가까이 있는 서버를 씁니다 (wrangler dev)
  var LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var API = LOCAL ? 'http://127.0.0.1:8787' : 'https://qr-mission-api.jhmonounity.workers.dev';

  var PROJECT = 'photo';
  var TITLE = '영수증 모으기';
  var STORE = 'qrm-admin-code';     // 코드는 이 브라우저에만 남습니다

  var $ = function (id) { return document.getElementById(id); };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* UTC 를 한국 시간으로 */
  function kst(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false });
  }

  function mb(b) {
    if (b < 1024 * 1024) return Math.round(b / 1024) + ' KB';
    return (b / 1024 / 1024).toFixed(1) + ' MB';
  }

  /* 한 장을 가리키는 주소 — 코드를 주소에 담습니다 */
  function one(k, code, download) {
    return API + '/api/admin/photo?key=' + encodeURIComponent(code)
      + '&k=' + encodeURIComponent(k) + (download ? '&download=1' : '');
  }

  function fail(msg) {
    $('err').textContent = msg;
    $('err').classList.remove('hidden');
  }

  function load(code) {
    $('go').disabled = true;
    $('err').classList.add('hidden');

    fetch(API + '/api/admin/photos?key=' + encodeURIComponent(code)
          + '&project=' + encodeURIComponent(PROJECT))
      .then(function (r) { return r.json().catch(function () { return null; }); })
      .then(function (d) {
        $('go').disabled = false;

        if (!d || !d.ok) {
          fail(d && d.error ? d.error : '코드가 맞지 않습니다.');
          try { localStorage.removeItem(STORE); } catch (e) { /* 저장소를 못 쓰는 경우 */ }
          return;
        }
        try { localStorage.setItem(STORE, code); } catch (e) { /* 저장소를 못 쓰는 경우 */ }

        $('login').classList.add('hidden');
        $('panel').classList.remove('hidden');
        $('updated').textContent = '마지막 갱신 ' + new Date().toLocaleTimeString('ko-KR');

        var list = d.photos || [];

        $('stats').innerHTML = [
          ['올라온 장수', d.total],
          ['모두 더한 크기', mb(d.bytes || 0)]
        ].map(function (s) {
          return '<div class="stat"><div class="k">' + s[0] + '</div><div class="v">' + s[1] + '</div></div>';
        }).join('');

        /* 남은 용량 — 창고(무료 1GB)를 모든 행사가 같이 씁니다 */
        var quota = d.quotaBytes || 0;
        var used = d.usedBytes || 0;
        if (quota) {
          var pct = Math.min(100, Math.round(used / quota * 1000) / 10);
          $('gauge-left').textContent = '쓴 용량 ' + mb(used) + ' / ' + mb(quota);
          $('gauge-right').textContent = '남음 ' + mb(Math.max(0, quota - used));
          $('gauge-fill').style.width = Math.max(pct, used > 0 ? 1.5 : 0) + '%';
          var bar = $('gauge-fill').parentNode;
          bar.className = 'bar' + (pct >= 90 ? ' full' : pct >= 70 ? ' warn' : '');
          // 지금 속도라면 몇 장쯤 더 들어가는지 — 눈대중이 있어야 판단이 섭니다
          var avg = d.total ? (used / d.total) : 0;
          $('gauge-note').textContent = pct >= 90
            ? '창고가 거의 찼습니다. 받아 두고 지워 주세요.'
            : (avg ? ('지금 크기라면 ' + Math.floor((quota - used) / avg).toLocaleString('ko-KR')
                     + '장쯤 더 들어갑니다 (한 장 평균 ' + mb(avg) + ')')
                   : '아직 올라온 것이 없습니다.');
        } else {
          $('gauge').style.display = 'none';
        }
        if (d.keepDays) $('keep').textContent = d.keepDays + '일';

        $('sum').textContent = list.length
          ? ('모두 ' + d.total + '장 · 최근 올린 것부터')
          : '';
        $('empty').classList.toggle('hidden', !!list.length);

        $('shots').innerHTML = list.map(function (r) {
          return '<div class="shot" data-k="' + esc(r.k) + '">'
            + '<a class="pic" href="' + esc(one(r.k, code, false)) + '" target="_blank" rel="noopener">'
            + '<img loading="lazy" src="' + esc(one(r.k, code, false)) + '" alt=""></a>'
            + '<div class="meta">' + esc(kst(r.created_at)) + '<br>'
            + esc(mb(r.bytes)) + (r.spot ? ' · ' + esc(r.spot) : '') + '</div>'
            + '<div class="row2">'
            + '<a href="' + esc(one(r.k, code, true)) + '">받기</a>'
            + '<button class="del" data-k="' + esc(r.k) + '">지우기</button>'
            + '</div></div>';
        }).join('');

        /* 지우기 — 손이 스쳐 지우지 않도록 두 번 묻습니다 */
        Array.prototype.forEach.call($('shots').querySelectorAll('.del'), function (b) {
          b.onclick = function () {
            if (b.dataset.sure !== '1') {
              b.dataset.sure = '1';
              b.textContent = '정말 지울까요?';
              return;
            }
            b.disabled = true;
            fetch(API + '/api/admin/photo?key=' + encodeURIComponent(code)
                  + '&k=' + encodeURIComponent(b.dataset.k), { method: 'DELETE' })
              .then(function (r) { return r.json(); })
              .then(function (x) {
                if (x && x.ok) load(code);
                else { b.disabled = false; b.textContent = '못 지웠습니다'; }
              })
              .catch(function () { b.disabled = false; b.textContent = '못 지웠습니다'; });
          };
        });

        /* 보이는 것 모두 받기 — 브라우저가 막지 않도록 하나씩 사이를 둡니다 */
        $('all').onclick = function () {
          if (!list.length) return;
          $('all').disabled = true;
          $('all').textContent = '받는 중… (0/' + list.length + ')';
          list.forEach(function (r, i) {
            setTimeout(function () {
              var a = document.createElement('a');
              a.href = one(r.k, code, true);
              a.download = '';
              document.body.appendChild(a);
              a.click();
              a.remove();
              $('all').textContent = '받는 중… (' + (i + 1) + '/' + list.length + ')';
              if (i === list.length - 1) {
                $('all').disabled = false;
                $('all').textContent = '보이는 것 모두 받기';
              }
            }, i * 400);
          });
        };

        $('csv').onclick = function () {
          location.href = API + '/api/admin/photos?format=csv&key=' + encodeURIComponent(code)
            + '&project=' + encodeURIComponent(PROJECT);
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

  var saved = null;
  try { saved = localStorage.getItem(STORE); } catch (e) { /* 저장소를 못 쓰는 경우 */ }
  if (saved) load(saved); else $('code').focus();
})();
