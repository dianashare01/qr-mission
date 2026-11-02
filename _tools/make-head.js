/* 머리말 그림(assets/stamp/head.png) 을 다시 만듭니다.
 *
 *   node _tools/make-head.js
 *
 * 디자인의 머리말은 v0.3 의 Logo.png (327x20) 입니다. 가로로 꽉 차서
 * KOREA CHECK-IN 은 왼쪽 끝, Imagine your Korea 는 오른쪽 끝에 붙습니다.
 * 한때 01_Logo.png 를 썼는데 그건 다른 짜임(오른쪽 표가 작고 모아 쓴 모양)이라
 * Imagine your Korea 가 화면 한가운데로 왔습니다.
 *
 * Logo.png 는 1배짜리라 휴대폰에서 흐립니다. 그래서 2배(654x40)로 짜되
 *   · 왼쪽 KOREA CHECK-IN 은 01_Logo.png 의 큰 그림(129px)을 줄여 씁니다 — 또렷합니다
 *   · 오른쪽 Imagine your Korea 는 Logo.png 것(86px)을 늘려 씁니다 — 이것뿐이라서
 * 디자이너에게 더 큰 그림이나 SVG 를 받으면 오른쪽도 또렷해집니다.
 */

var fs = require('fs');
var path = require('path');
var PNG = require('pngjs').PNG;

var TC = 'C:/Users/Kasiu/Downloads/Untitled (1)/v0.3/TC/';
var OUT = path.join(__dirname, '..', 'assets', 'stamp', 'head.png');

var W = 654, H = 40;   // 디자인 327x20 의 두 배

/* 보낼 곳: [x, y, 너비, 높이] — 디자인 자리를 두 배 한 값입니다 */
var PARTS = [
  { file: '01_Logo.png', from: [0, 8, 129, 45], to: [0, 0, 116, 40] },     // KOREA CHECK-IN
  { file: 'Logo.png', from: [241, 1, 86, 18], to: [482, 2, 172, 36] }      // Imagine your Korea
];

/* 알파를 미리 곱해 두고 섞습니다. 안 그러면 투명한 가장자리에서
   보이지 않는 검은색이 배어 나와 글자에 때가 낍니다. */
function draw(dst, src, from, to) {
  var sx = from[0], sy = from[1], sw = from[2], sh = from[3];
  var dx = to[0], dy = to[1], dw = to[2], dh = to[3];

  for (var j = 0; j < dh; j++) {
    for (var i = 0; i < dw; i++) {
      // 보낼 칸 한가운데가 원본 어디에 떨어지는지
      var fx = (i + 0.5) * sw / dw - 0.5;
      var fy = (j + 0.5) * sh / dh - 0.5;
      var x0 = Math.floor(fx), y0 = Math.floor(fy);
      var tx = fx - x0, ty = fy - y0;

      var r = 0, g = 0, b = 0, a = 0;
      for (var n = 0; n < 4; n++) {
        var px = x0 + (n & 1), py = y0 + (n >> 1);
        var w = (n & 1 ? tx : 1 - tx) * (n >> 1 ? ty : 1 - ty);
        if (w === 0) continue;
        px = Math.min(sw - 1, Math.max(0, px));
        py = Math.min(sh - 1, Math.max(0, py));
        var s = ((sy + py) * src.width + (sx + px)) * 4;
        var sa = src.data[s + 3] / 255;
        r += src.data[s] * sa * w;
        g += src.data[s + 1] * sa * w;
        b += src.data[s + 2] * sa * w;
        a += sa * w;
      }

      var d = ((dy + j) * W + (dx + i)) * 4;
      dst.data[d] = a > 0 ? Math.round(r / a) : 0;
      dst.data[d + 1] = a > 0 ? Math.round(g / a) : 0;
      dst.data[d + 2] = a > 0 ? Math.round(b / a) : 0;
      dst.data[d + 3] = Math.round(a * 255);
    }
  }
}

var out = new PNG({ width: W, height: H });
out.data.fill(0);

PARTS.forEach(function (p) {
  var f = TC + p.file;
  if (!fs.existsSync(f)) {
    console.error('디자인 파일을 못 찾았습니다: ' + f);
    process.exit(1);
  }
  draw(out, PNG.sync.read(fs.readFileSync(f)), p.from, p.to);
  console.log(p.file + ' ' + p.from.join(',') + ' -> ' + p.to.join(','));
});

fs.writeFileSync(OUT, PNG.sync.write(out));
console.log('head.png ' + W + 'x' + H + ' 를 새로 썼습니다');
