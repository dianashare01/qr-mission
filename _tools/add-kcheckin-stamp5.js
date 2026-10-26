/*
 * add-kcheckin-stamp5.js — K-체크인을 기획자 수정본(스탬프 7개)에 맞춘다.
 *
 *   node _tools/add-kcheckin-stamp5.js
 *
 * ⚠️ 이미 만들어 둔 QR 6장의 토큰은 절대 건드리지 않습니다.
 *    빠져 있던 5번(BONUS STAMP · 3F)만 새로 만들고 토큰을 붙입니다.
 *
 * 번호는 기획자님이 보내주신 파일 이름 순서를 따릅니다.
 *   01 리셉션(k1) · 02 미니바(k3) · 03 지역홍보데스크(k2) · 04 푸드트레일러(k4)
 *   05 보너스(새로) · 06 프론트데스크(k5) · 07 K-CLASS(k6)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = path.resolve(__dirname, '..', 'config', 'kcheckin.json');
const cfg = JSON.parse(fs.readFileSync(FILE, 'utf8').replace(/^﻿/, ''));

/* 새 번호 → 기존 스팟 id, 그리고 새 이름 */
const PLAN = [
  { order: 1, id: 'k1', place: '1F 리셉션',          en: 'THE RECEPTION',      label: '리셉션' },
  { order: 2, id: 'k3', place: '1F 미니바',          en: 'THE MINIBAR',        label: '미니바' },
  { order: 3, id: 'k2', place: '1F 지역홍보데스크',     en: 'THE LOCAL CONCIERGE', label: '지역홍보데스크' },
  { order: 4, id: 'k4', place: '1F 푸드트레일러 데스크', en: 'THE FOOD TRAILER',   label: '푸드트레일러' },
  { order: 5, id: 'k7', place: '3F 보너스 스탬프',     en: 'BONUS STAMP',        label: '보너스 스탬프', isNew: true },
  { order: 6, id: 'k5', place: '5F 프론트데스크',      en: 'THE FRONT DESK',     label: '프론트데스크' },
  { order: 7, id: 'k6', place: '5F K-CLASS',       en: 'THE K-CLASS',        label: 'K-CLASS' },
];

const byId = {};
cfg.spots.forEach((s) => { byId[s.id] = s; });

const next = [];
PLAN.forEach((p) => {
  let s = byId[p.id];

  if (!s) {
    // 새로 만드는 자리 — 문항은 아직 없어 자리표시만 둡니다
    s = {
      id: p.id,
      token: crypto.randomBytes(4).toString('base64url').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6),
      item: { name: 'STAMP ' + p.order, label: p.label },
      knowledge: {
        q: '[' + p.en + ' 문항 — 발주처 확정]',
        options: ['[보기 1]', '[보기 2]', '[보기 3]'],
        answer: 0,
        explain: '[해설 — 발주처 확정]',
      },
      preference: {
        q: '[' + p.en + ' 취향 문항 — 발주처 확정]',
        options: [
          { label: '[보기 1]', tag: 'F' },
          { label: '[보기 2]', tag: 'B' },
          { label: '[보기 3]', tag: 'P' },
          { label: '[보기 4]', tag: 'L' },
        ],
      },
    };
    console.log('  + 새로 만듦  ' + p.id + '  t=' + s.token);
  }

  s.order = p.order;
  s.place = p.place;
  s.hint = p.en;
  s.item.name = 'STAMP ' + p.order;
  s.item.label = p.label;
  next.push(s);
});

cfg.spots = next;
fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2) + '\n', 'utf8');

console.log('\n✅ 스탬프 7개로 맞췄습니다.\n');
cfg.spots.forEach((s) => {
  console.log('  ' + String(s.order).padStart(2, '0') + '. ' + s.place.padEnd(18) + ' ' + s.id.padEnd(3) + ' t=' + s.token);
});
