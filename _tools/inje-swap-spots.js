/* 박인환 QR 이 거꾸로 붙은 것을 설정에서 맞춰 줍니다.
 *
 *   node _tools/inje-swap-spots.js            (무엇이 바뀌는지만 보여 줍니다)
 *   node _tools/inje-swap-spots.js --쓰기      (실제로 고칩니다)
 *
 * 2026-11-03 현장에서 1↔7, 2↔6, 3↔5 자리가 뒤바뀌어 붙었습니다. 4번만 제자리.
 *
 * **인쇄한 QR 은 못 바꿉니다.** QR 안에는 `s=<id>&t=<token>` 이 들어 있어서
 * id 와 token 은 손대면 안 됩니다. 대신 **각 id 에 매달린 방 내용을 맞바꿉니다.**
 * 예를 들어 s1 QR 이 바테이블 방에 붙어 있으니, s1 칸에 바테이블 방 내용을 넣습니다.
 *
 * 방 내용은 id·token 을 뺀 나머지 전부입니다 (order·place·hint·item·knowledge…).
 * 바꾼 뒤 order 차례로 다시 줄 세웁니다 — 엔진이 '다음에 갈 곳'을 배열 차례로
 * 고르기 때문입니다.
 */

var fs = require('fs');
var path = require('path');

var FILE = path.join(__dirname, '..', 'config', 'inje.json');
var WRITE = process.argv.indexOf('--쓰기') >= 0 || process.argv.indexOf('--write') >= 0;

/* 맞바꿀 짝 — 나머지(4번)는 그대로 둡니다 */
var PAIRS = [['s1', 's7'], ['s2', 's6'], ['s3', 's5']];

/* QR 에 찍혀 있어 건드리면 안 되는 칸 */
var KEEP = ['id', 'token'];

var raw = fs.readFileSync(FILE, 'utf8');
var cfg = JSON.parse(raw.replace(/^﻿/, ''));

function byId(id) {
  for (var i = 0; i < cfg.spots.length; i++) if (cfg.spots[i].id === id) return cfg.spots[i];
  throw new Error(id + ' 를 찾지 못했습니다');
}

function table(title) {
  console.log('\n' + title);
  cfg.spots.forEach(function (s) {
    console.log('  ' + s.order + '번  ' + s.id + ' (' + s.token + ')   ' + s.place);
  });
}

table('■ 지금');

PAIRS.forEach(function (p) {
  var a = byId(p[0]), b = byId(p[1]);
  // 두 쪽 칸 이름을 합치되 **겹치는 것은 한 번만** 셉니다.
  // 두 번 돌면 맞바꾼 것을 도로 되돌려 아무 일도 안 일어납니다.
  var keys = Object.keys(a);
  Object.keys(b).forEach(function (k) { if (keys.indexOf(k) < 0) keys.push(k); });
  keys.forEach(function (k) {
    if (KEEP.indexOf(k) >= 0) return;
    var t = a[k];
    if (k in b) a[k] = b[k]; else delete a[k];
    if (t === undefined) delete b[k]; else b[k] = t;
  });
  console.log('\n  ' + p[0] + ' ↔ ' + p[1] + ' 내용을 맞바꿨습니다 (id·token 은 그대로)');
});

/* 엔진은 '다음에 갈 곳' 을 배열 차례로 고릅니다 — order 대로 다시 줄 세웁니다 */
cfg.spots.sort(function (x, y) { return x.order - y.order; });

/* 마지막 방(바테이블)에 MBTI 질문이 있습니다. 그 방을 가리키는 id 도 따라갑니다. */
if (cfg.result && cfg.result.poem && cfg.result.poem.fromSpot) {
  var last = cfg.spots[cfg.spots.length - 1];
  var was = cfg.result.poem.fromSpot;
  cfg.result.poem.fromSpot = last.id;
  console.log('\n  시 꺼내 오는 곳 fromSpot: ' + was + ' → ' + last.id + '  (' + last.place + ')');
}

table('■ 바꾼 뒤');

/* 확인 — id 와 token 짝이 그대로인지 */
var ORIG = JSON.parse(raw.replace(/^﻿/, ''));
var bad = [];
ORIG.spots.forEach(function (o) {
  var n = byId(o.id);
  if (n.token !== o.token) bad.push(o.id);
});
if (bad.length) { console.error('\n✗ id·token 짝이 틀어졌습니다: ' + bad.join(', ')); process.exit(1); }
console.log('\n✔ id·token 짝 7개 모두 그대로입니다 — 인쇄한 QR 그대로 쓰시면 됩니다');

if (!WRITE) {
  console.log('\n(아직 고치지 않았습니다. 실제로 바꾸려면 뒤에 --쓰기 를 붙이세요)');
  process.exit(0);
}
fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
console.log('\nconfig/inje.json 을 고쳤습니다');
