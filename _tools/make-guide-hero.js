/*
 * make-guide-hero.js — 안내 페이지 상단에 깔 배경 그림을 시안에서 뽑아 만든다.
 *
 *   node _tools/make-guide-hero.js
 *
 * 시안(ENG · PC · 전시 안내)의 상단 띠에는 글자가 얹혀 있어서 그대로 쓸 수 없다.
 * 그래서 글자가 없는 오른쪽 "빛나는 문" 부분만 잘라 오고,
 * 왼쪽은 시안의 색을 아주 작게 줄여 뽑은 뒤 다시 키워 부드러운 바탕으로 만든다.
 * 둘을 이어 붙일 때 경계가 보이지 않도록 왼쪽 가장자리를 서서히 비친다.
 *
 * 결과: assets/guide/hero.jpg (1440 x 600)
 */

const path = require('path');
const sharp = require(path.join('C:', 'Users', 'Kasiu', 'Documents', 'ai-table', '_tools', 'node_modules', 'sharp'));

const SRC = 'C:\\Users\\Kasiu\\Downloads\\디자인\\ENG · PC · 전시 안내 · 01·07 펼침.png';
const OUT = path.resolve(__dirname, '..', 'assets', 'guide', 'hero.jpg');

const TOP = 70;      // 상단 띠가 시작하는 높이
const W = 1440;
const H = 600;
const CUT = 1200;    // 이 지점부터 오른쪽은 글자가 없다
const FEATHER = 90;  // 이어 붙인 자리를 숨기는 폭

(async () => {
  // 1) 왼쪽 바탕 — 색만 남을 만큼 줄였다가 다시 키운다
  //    (줄이기와 키우기는 한 번에 못 하므로 두 걸음으로 나눈다)
  const tiny = await sharp(SRC)
    .extract({ left: 0, top: TOP, width: CUT, height: H })
    .flatten({ background: '#000000' })
    .resize(12, 4, { fit: 'fill' })
    .png()
    .toBuffer();

  const base = await sharp(tiny)
    .resize(W, H, { fit: 'fill' })
    .toBuffer();

  // 2) 오른쪽 그림 — 글자 없는 부분
  const rightW = W - CUT;
  const right = await sharp(SRC)
    .extract({ left: CUT, top: TOP, width: rightW, height: H })
    .flatten({ background: '#000000' })
    .removeAlpha()
    .raw()
    .toBuffer();

  // 3) 왼쪽 가장자리를 서서히 비치게 하는 가리개
  const mask = Buffer.alloc(rightW * H);
  for (let x = 0; x < rightW; x++) {
    const a = x < FEATHER ? Math.round((x / FEATHER) * 255) : 255;
    for (let y = 0; y < H; y++) mask[y * rightW + x] = a;
  }

  const rightSoft = await sharp(right, { raw: { width: rightW, height: H, channels: 3 } })
    .joinChannel(mask, { raw: { width: rightW, height: H, channels: 1 } })
    .png()
    .toBuffer();

  await sharp(base)
    .composite([{ input: rightSoft, left: CUT, top: 0 }])
    .jpeg({ quality: 86, chromaSubsampling: '4:4:4' })
    .toFile(OUT);

  const st = require('fs').statSync(OUT);
  console.log('✅ ' + OUT + '  (' + Math.round(st.size / 1024) + 'KB)');
})();
