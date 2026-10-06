/*
 * serve.js — 내 컴퓨터에서 미리보기용 서버
 *
 *   node _tools/serve.js
 *   → http://localhost:8780/?p=wianbu
 *
 * QR 로 들어온 상황을 흉내 내려면 스팟과 토큰을 붙입니다.
 *   http://localhost:8780/?p=wianbu&s=s1&t=CHANGE-ME-1
 *
 * /{project}/s/{spotId} 형태의 주소도 index.html 로 넘겨, 실제 서버와 같은 동작을 확인할 수 있습니다.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8780;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

http.createServer((req, res) => {
  const pathname = decodeURIComponent(req.url.split('?')[0]);

  // /wianbu/s/s2 같은 주소는 index.html 이 받아 처리한다
  const spotPath = /^\/[A-Za-z0-9_-]+\/s\/[A-Za-z0-9_-]+\/?$/.test(pathname);

  const rel = spotPath ? '/index.html' : (pathname.endsWith('/') ? pathname + 'index.html' : pathname);
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }

  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': TYPES['.html'] }).end('404'); return; }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log('');
  console.log(`  http://localhost:${PORT}/?p=wianbu`);
  console.log(`  QR 흉내 : http://localhost:${PORT}/?p=wianbu&s=s1&t=CHANGE-ME-1`);
  console.log('');
});
