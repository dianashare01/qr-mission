/* 영어·중국어·일본어 쪽이 testimony-nextpage.com 으로 옮겨 갔습니다.
 * 여기(qr-mission/en, /zh, /ja)에는 새 주소로 넘겨 주는 쪽만 남깁니다.
 *
 *   node _tools/make-lang-redirects.js --쓰기
 *
 * 예전 주소를 아는 사람이나 어딘가 적힌 링크도 그대로 열리게 하려는 것입니다.
 */

var fs = require('fs');
var path = require('path');

var WRITE = process.argv.indexOf('--쓰기') >= 0 || process.argv.indexOf('--write') >= 0;
var BASE = 'https://www.testimony-nextpage.com/';

var PAGES = {
  en: { code: 'en', title: 'Moved', body: 'This page has moved.', go: 'Open the new page' },
  zh: { code: 'zh', title: '已搬迁', body: '本页面已迁移。', go: '打开新页面' },
  ja: { code: 'ja', title: '移転しました', body: 'このページは移転しました。', go: '新しいページを開く' }
};

Object.keys(PAGES).forEach(function (lang) {
  var p = PAGES[lang];
  var url = BASE + lang + '/';
  var html = [
    '<!DOCTYPE html>',
    '<html lang="' + p.code + '">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="robots" content="noindex">',
    '<meta http-equiv="refresh" content="0; url=' + url + '">',
    '<link rel="canonical" href="' + url + '">',
    '<title>' + p.title + ' — ' + url + '</title>',
    '<style>',
    '  body {',
    '    margin: 0; min-height: 100vh;',
    '    display: flex; flex-direction: column;',
    '    align-items: center; justify-content: center; gap: 14px;',
    '    background: #1b1526; color: #f1eee6;',
    '    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;',
    '    font-size: 15px; line-height: 1.7; text-align: center; padding: 24px;',
    '  }',
    '  a { color: #f1eee6; }',
    '</style>',
    '</head>',
    '<body>',
    '<p>' + p.body + '</p>',
    '<p><a href="' + url + '">' + p.go + ' &rarr;</a></p>',
    '<script>location.replace(' + JSON.stringify(url) + ');</script>',
    '</body>',
    '</html>',
    ''
  ].join('\n');

  var out = path.join(__dirname, '..', lang, 'index.html');
  console.log(lang + '/index.html  →  ' + url);
  if (WRITE) fs.writeFileSync(out, html, 'utf8');
});

if (!WRITE) console.log('\n(아직 쓰지 않았습니다. 실제로 바꾸려면 뒤에 --쓰기 를 붙이세요)');
