/* 룸키 카드의 K 열쇠 표를 그림에서 떠내 선 그림(SVG 길)으로 바꿉니다.
 *
 *   node _tools/trace-key.js
 *
 * 왜 하느냐 — 디자이너가 준 카드 그림은 160x242 짜리 한 배입니다.
 * 휴대폰은 한 점을 두세 점으로 그리므로 늘어나 뭉개집니다.
 * 표가 전부 곧은 선으로만 돼 있어서 선 그림으로 바꾸면 아무리 키워도 또렷합니다.
 *
 * 떠낸 길은 _tools/key-path.txt 에 남고, stamp/index.html 의 카드에 들어갑니다.
 *
 * 눈금 되찾기 — 그림의 흐린 가장자리(안티에일리어싱)에는 '몇 할이 표인지'가
 * 들어 있습니다. 그 값을 사이사이 메워 네 배 격자에서 반을 넘는 칸만 표로 치면,
 * 한 배 그림에서도 비스듬한 선을 한 점보다 가늘게 되찾을 수 있습니다.
 * 그냥 네 배로 늘리기만 하면 계단이 그대로라 아무 소용이 없습니다.
 */

var fs = require('fs');
var path = require('path');
var PNG = require('pngjs').PNG;

var SRC = path.join(__dirname, '..', 'assets', 'stamp', 'card-green.png');
var p = PNG.sync.read(fs.readFileSync(SRC));
var W = p.width, H = p.height;

var Y0 = 35, Y1 = 160;   // 160 아래는 KOREA CHECK-IN 글자줄입니다
var BGX = 12;            // 표에서 멀리 떨어진 칸 — 그 줄의 바탕색을 여기서 봅니다

function lum(x, y) {
  var i = (y * W + x) * 4;
  return (p.data[i] * 0.299 + p.data[i + 1] * 0.587 + p.data[i + 2] * 0.114);
}
/* 그 자리가 몇 할이나 표인지 (0~1) */
function cov(x, y) {
  if (x < 0 || y < 0 || x >= W || y >= H) return 0;
  var bg = lum(BGX, y), fg = 255;
  var v = (lum(x, y) - bg) / (fg - bg);
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/* 표 자리 찾기 */
var minx = 1e9, maxx = -1, miny = 1e9, maxy = -1;
for (var y = Y0; y < Y1; y++) for (var x = 0; x < W; x++) {
  if (cov(x, y) > 0.5) {
    if (x < minx) minx = x; if (x > maxx) maxx = x;
    if (y < miny) miny = y; if (y > maxy) maxy = y;
  }
}
var gw = maxx - minx + 1, gh = maxy - miny + 1;
console.log('표 자리  x ' + minx + '~' + maxx + '  y ' + miny + '~' + maxy + '  (' + gw + 'x' + gh + ')');

/* 사이를 메워 네 배 격자를 만듭니다 */
var S = 4;
var MW = gw * S, MH = gh * S;
var m = new Uint8Array(MW * MH);
function covAt(fx, fy) {
  var x0 = Math.floor(fx), y0 = Math.floor(fy);
  var tx = fx - x0, ty = fy - y0;
  return cov(x0, y0) * (1 - tx) * (1 - ty)
    + cov(x0 + 1, y0) * tx * (1 - ty)
    + cov(x0, y0 + 1) * (1 - tx) * ty
    + cov(x0 + 1, y0 + 1) * tx * ty;
}
for (var j = 0; j < MH; j++) for (var i2 = 0; i2 < MW; i2++) {
  var fx = minx + (i2 + 0.5) / S - 0.5;
  var fy = miny + (j + 0.5) / S - 0.5;
  m[j * MW + i2] = covAt(fx, fy) > 0.5 ? 1 : 0;
}
function at(x, y) { return (x < 0 || y < 0 || x >= MW || y >= MH) ? 0 : m[y * MW + x]; }

/* 테두리를 칸과 칸 사이 선으로 모읍니다.
   칸 한가운데를 따라 걸으면 테두리가 반 칸 안쪽으로 들어와 넓이가 깎입니다
   (겹침이 0.96 에서 더 안 올라갔던 까닭입니다). 칸 모서리를 따라야 꼭 맞습니다. */
var edges = new Map();
function add(x1, y1, x2, y2) { edges.set(x1 + "," + y1, [x2, y2]); }
for (var cy2 = 0; cy2 < MH; cy2++) for (var cx2 = 0; cx2 < MW; cx2++) {
  if (!at(cx2, cy2)) continue;
  // 칠한 칸이 늘 오른쪽에 오도록 시계 방향으로 돕니다
  if (!at(cx2, cy2 - 1)) add(cx2, cy2, cx2 + 1, cy2);
  if (!at(cx2 + 1, cy2)) add(cx2 + 1, cy2, cx2 + 1, cy2 + 1);
  if (!at(cx2, cy2 + 1)) add(cx2 + 1, cy2 + 1, cx2, cy2 + 1);
  if (!at(cx2 - 1, cy2)) add(cx2, cy2 + 1, cx2, cy2);
}
var start = edges.keys().next().value.split(",").map(Number);
var pts = [], cur = start, guard = edges.size + 4;
while (guard-- > 0) {
  pts.push(cur);
  var nx2 = edges.get(cur[0] + "," + cur[1]);
  if (!nx2) break;
  if (nx2[0] === start[0] && nx2[1] === start[1]) break;
  cur = nx2;
}
console.log('테두리 점 ' + pts.length + '개 (칸 사이 선 ' + edges.size + '개)');

/* 곧은 선만 남깁니다 (Douglas–Peucker).
   닫힌 테두리를 통째로 넣으면 시작점과 끝점이 같아 거리가 0 이 되고
   한 줄로 뭉개지므로 반 바퀴씩 나눠 줄인 뒤 다시 잇습니다. */
function rdp(a, eps) {
  if (a.length < 3) return a;
  var dmax = 0, idx = 0;
  var p0 = a[0], p1 = a[a.length - 1];
  var dx = p1[0] - p0[0], dy = p1[1] - p0[1];
  var len = Math.hypot(dx, dy) || 1;
  for (var i = 1; i < a.length - 1; i++) {
    var dd = Math.abs(dy * (a[i][0] - p0[0]) - dx * (a[i][1] - p0[1])) / len;
    if (dd > dmax) { dmax = dd; idx = i; }
  }
  if (dmax <= eps) return [p0, p1];
  return rdp(a.slice(0, idx + 1), eps).slice(0, -1).concat(rdp(a.slice(idx), eps));
}
function reduce(eps) {
  var half = pts.length >> 1;
  return rdp(pts.slice(0, half + 1), eps).slice(0, -1)
    .concat(rdp(pts.slice(half).concat([pts[0]]), eps).slice(0, -1));
}

/* 다시 칠해 보고 원본과 얼마나 겹치는지 셉니다 */
function inside(poly, x, y) {
  var c = false;
  for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c = !c;
  }
  return c;
}
/* 원본 그림과 얼마나 닮았는지 — 네 배 격자(계단)가 아니라
   **원래 한 배 그림의 흐린 가장자리**와 견줍니다. 계단과 견주면
   곧게 펴는 일 자체를 깎아내리게 되어 거꾸로 됩니다. */
function fit(poly) {
  var sum = 0, n = 0;
  for (var y = -1; y <= gh; y++) {
    for (var x = -1; x <= gw; x++) {
      var c = 0;
      for (var sy2 = 0; sy2 < 4; sy2++) for (var sx2 = 0; sx2 < 4; sx2++) {
        var px2 = (x + (sx2 + 0.5) / 4) * S, py2 = (y + (sy2 + 0.5) / 4) * S;
        if (inside(poly, px2, py2)) c++;
      }
      sum += Math.abs(c / 16 - cov(minx + x, miny + y));
      n++;
    }
  }
  return sum / n;
}

/* 적은 점으로 가장 닮은 쪽을 고릅니다 */
var best = null;
[0.15, 0.3, 0.5, 0.8, 1.2, 1.8].forEach(function (e) {
  var poly = reduce(S * e);
  var f = fit(poly);
  console.log('  눈금 ' + e + ' → 점 ' + poly.length + '개, 어긋남 ' + f.toFixed(4));
  if (f <= 0.035 && (!best || poly.length < best.poly.length)) best = { poly: poly, f: f, e: e };
});
if (!best) { console.error('어긋남 0.035 아래로 못 맞췄습니다 — 손으로 확인하세요'); process.exit(1); }
console.log('고른 눈금 ' + best.e + ' (점 ' + best.poly.length + '개, 어긋남 ' + best.f.toFixed(4) + ')');
/* 100 x (높이비율) 상자에 맞춰 길을 적습니다 */
var VH = Math.round(1000 * gh / gw) / 10;
var dstr = best.poly.map(function (q, i) {
  var X = Math.round(q[0] / S / gw * 1000) / 10;
  var Y = Math.round(q[1] / S / gh * VH * 10) / 10;
  return (i ? 'L' : 'M') + X + ' ' + Y;
}).join(' ') + ' Z';

console.log('\nviewBox="0 0 100 ' + VH + '"');
console.log('d="' + dstr + '"');
fs.writeFileSync(path.join(__dirname, 'key-path.txt'),
  'viewBox="0 0 100 ' + VH + '"\nd="' + dstr + '"\n', 'utf8');
