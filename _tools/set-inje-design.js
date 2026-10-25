/*
 * set-inje-design.js — 박인환「마리서사」를 위안부와 같은 새 퀴즈 디자인으로 맞춘다.
 *
 *   node _tools/set-inje-design.js
 *
 * 문항·해설·시어·결과 유형은 건드리지 않습니다.
 * 새 디자인이 쓰는 색 몇 가지와 화면에 새로 생긴 자리의 문구만 채웁니다.
 * 문구는 되도록 이미 승인된 글(startTitle·startBody 등)을 줄만 바꿔 다시 씁니다.
 */

const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', 'config', 'inje.json');
const cfg = JSON.parse(fs.readFileSync(FILE, 'utf8').replace(/^﻿/, ''));
const t = cfg.theme;
const s = cfg.strings;

/* ── 색 ──────────────────────────────────────────
   바탕은 지금 쓰던 미색 그대로 두고, 새로 생긴 흰 카드용 색만 더합니다. */
t.paper = '#FFFFFF';        // 문제·해설 흰 카드
t.paperInk = '#2B211C';     // 카드 위 글자 (지금 쓰던 ink 와 같은 색)
t.paperSub = '#8A7B6C';     // 카드 위 옅은 글자
t.paperSoft = '#F3EDE2';    // 보기 바탕
t.paperLine = '#D9CBB4';
t.note = t.accent;          // 「정답입니다 / 아쉬워요」 머리말은 이 전시의 빨강으로
t.radius = 12;
t.radiusLg = 20;

/* ── 새로 생긴 자리의 문구 ───────────────────────── */

// 흰 카드 위 쪽 제목 — startTitle 을 두 줄로 나눠 씁니다
s.quizHeadline = '일곱 개의 시어를\n모아 주세요.';

// 보기 아래 안내 — 누르면 바로 넘어갑니다
s.pickHint = '보기를 눌러 답을 고르세요';

// 시어 목록(수집 보드) 화면
s.boardEyebrowFormat = 'QUIZ · {done} / {total}';
// boardTitle 「나의 시어」는 그대로 둡니다
s.boardBody = '전시장 일곱 곳의 QR을 찍으면 시어가 하나씩 열립니다.\n모두 모으면 당신만의 시가 완성됩니다.';
s.boardCta = s.collectCta || '시어 모아 보기';

// 맨 아래 주최 표기 — 승인된 문구가 없어 비워 둡니다(비면 아예 안 보입니다)
if (s.footerLine === undefined) s.footerLine = '';

fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2) + '\n', 'utf8');

console.log('✅ 박인환을 새 퀴즈 디자인에 맞췄습니다.\n');
console.log('   쪽 제목   : ' + JSON.stringify(s.quizHeadline));
console.log('   목록 제목 : ' + JSON.stringify(s.boardTitle));
console.log('   목록 설명 : ' + JSON.stringify(s.boardBody));
console.log('   목록 단추 : ' + JSON.stringify(s.boardCta));
console.log('   주최 표기 : ' + (s.footerLine ? JSON.stringify(s.footerLine) : '(비어 있음 — 원고 주시면 넣겠습니다)'));
console.log('   맞고 틀림 : ' + (cfg.tone.wrongLabel !== cfg.tone.correctLabel ? '드러냄 (' + cfg.tone.correctLabel + ' / ' + cfg.tone.wrongLabel + ')' : '드러내지 않음'));
