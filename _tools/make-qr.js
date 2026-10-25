/*
 * make-qr.js — 시연용 시작 QR 이미지를 만든다.
 *
 *   node _tools/make-qr.js
 *   node _tools/make-qr.js https://다른주소/qr-mission
 *
 * 결과: _tools/qr/ 폴더에 PNG
 *
 * 프로젝트별로 1번 스팟 주소의 QR 을 만듭니다. 이 QR 하나로 시작해서
 * 화면의 "다음 QR 찍기 (시연용)" 버튼으로 끝까지 볼 수 있습니다.
 * (시연용 모드가 꺼지면 스팟마다 QR 을 따로 만들어야 합니다 — 아래 ALL 참고)
 */

const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const args = process.argv.slice(2);
const BASE = (args.find((a) => a.startsWith('http')) || 'https://dianashare01.github.io/qr-mission').replace(/\/+$/, '');
const ALL = args.includes('--all');                      // 전 스팟 QR 을 만들려면 붙이세요

// --project=wianbu 처럼 한 전시만 만들 수 있습니다
const only = (args.find((a) => a.startsWith('--project=')) || '').split('=')[1];

const OUT = path.join(__dirname, 'qr');
fs.mkdirSync(OUT, { recursive: true });

const ALL_PROJECTS = [
  { key: 'wianbu', name: '위안부' },
  { key: 'inje', name: '박인환' },
  { key: 'kcheckin', name: 'K-체크인' },
];

/** 파일명에 못 쓰는 글자를 걸러낸다 */
function safeName(s) {
  return String(s).replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();
}
const PROJECTS = only ? ALL_PROJECTS.filter((p) => p.key === only) : ALL_PROJECTS;

(async () => {
  const made = [];

  for (const p of PROJECTS) {
    const cfgPath = path.join(__dirname, '..', 'config', p.key + '.json');
    if (!fs.existsSync(cfgPath)) { console.log(`  건너뜀: ${p.key} 설정 없음`); continue; }

    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8').replace(/^﻿/, ''));
    const spots = ALL ? cfg.spots : cfg.spots.slice(0, 1);

    for (const s of spots) {
      const url = `${BASE}/?p=${p.key}&s=${s.id}&t=${encodeURIComponent(s.token)}`;
      // 붙일 위치를 바로 알 수 있게 "전시-순번-위치" 로 짓습니다
      const file = path.join(OUT, `${p.name}-${String(s.order).padStart(2, '0')}-${safeName(s.place)}.png`);

      await QRCode.toFile(file, url, {
        width: 1200,
        margin: 2,
        errorCorrectionLevel: 'H',   // 일부 가려져도 읽히도록 최고 등급
        color: { dark: '#000000ff', light: '#ffffffff' },
      });

      made.push({ file: path.basename(file), url, place: s.place });
    }
  }

  console.log(`\n✅ QR ${made.length}개 생성 → ${OUT}\n`);
  made.forEach((m) => {
    console.log(`  ${m.file}`);
    console.log(`     ${m.place}`);
    console.log(`     ${m.url}\n`);
  });

  if (!ALL) console.log('전 스팟 QR 이 필요하면:  node _tools/make-qr.js --all\n');
})();
