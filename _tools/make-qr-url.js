/*
 * make-qr-url.js — 주소를 직접 주고 QR 을 만든다.
 *
 *   node _tools/make-qr-url.js "<파일이름>" "<주소>"  ["<이름2>" "<주소2>" ...]
 *
 * 예)
 *   node _tools/make-qr-url.js "공식사이트" "https://www.testimony-nextpage.com"
 *
 * 결과: _tools/qr/<파일이름>.png
 */

const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const args = process.argv.slice(2);
if (args.length < 2 || args.length % 2 !== 0) {
  console.error('사용법: node _tools/make-qr-url.js "<이름>" "<주소>" ["<이름2>" "<주소2>" ...]');
  process.exit(1);
}

const OUT = path.join(__dirname, 'qr');
fs.mkdirSync(OUT, { recursive: true });

function safeName(s) {
  return String(s).replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();
}

(async () => {
  const made = [];

  for (let i = 0; i < args.length; i += 2) {
    const name = safeName(args[i]);
    const url = args[i + 1];
    const file = path.join(OUT, name + '.png');

    await QRCode.toFile(file, url, {
      width: 1200,
      margin: 2,
      errorCorrectionLevel: 'H',   // 일부 가려져도 읽히도록 최고 등급
      color: { dark: '#000000ff', light: '#ffffffff' },
    });

    made.push({ file: path.basename(file), url });
  }

  console.log(`\n✅ QR ${made.length}개 생성 → ${OUT}\n`);
  made.forEach((m) => console.log(`  ${m.file}\n     ${m.url}\n`));
})();
