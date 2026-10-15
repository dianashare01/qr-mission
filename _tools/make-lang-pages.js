/*
 * make-lang-pages.js — 언어별 페이지(영어·일본어·중국어)를 만든다.
 *
 *   node _tools/make-lang-pages.js
 *
 * 지금은 "영어 페이지" 처럼 한글 안내만 들어 있는 바탕입니다.
 * 내용이 확정되면 각 폴더의 index.html 안쪽만 고치면 되고, QR 주소는 바뀌지 않습니다.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const LANGS = [
  { dir: 'en', code: 'EN', htmlLang: 'en', title: '영어 페이지', note: 'English page' },
  { dir: 'ja', code: 'JA', htmlLang: 'ja', title: '일본어 페이지', note: '日本語ページ' },
  { dir: 'zh', code: 'ZH', htmlLang: 'zh', title: '중국어 페이지', note: '中文页面' },
];

const BRAND = '증언: 다음 페이지';

function page(me) {
  const links = LANGS.map((l) => {
    const cur = l.dir === me.dir ? ' aria-current="page"' : '';
    return `    <a href="../${l.dir}/"${cur}>${l.code}</a>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="${me.htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#141A26">
<meta name="robots" content="noindex">
<title>${me.title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;700&family=Noto+Sans+KR:wght@400;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../assets/lang.css">
</head>
<body>

<div class="app">
  <div class="bar">
    <div class="brand">${BRAND}</div>
    <div class="lang">${me.code}</div>
  </div>

  <main>
    <div class="badge">${me.note}</div>
    <h1>${me.title}</h1>
    <p class="sub">내용은 준비 중입니다.<br>이 주소는 바뀌지 않으니 QR을 그대로 쓰시면 됩니다.</p>

    <div class="links">
${links}
    </div>
  </main>
</div>

</body>
</html>
`;
}

LANGS.forEach((l) => {
  const dir = path.join(ROOT, l.dir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), page(l), 'utf8');
  console.log(`  /${l.dir}/  ${l.title}`);
});

console.log(`\n✅ 언어 페이지 ${LANGS.length}개 생성`);
