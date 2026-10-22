/*
 * set-wianbu-theme.js — 위안부 설정 파일의 색·글꼴을 새 퀴즈 시안으로 맞춘다.
 *
 *   node _tools/set-wianbu-theme.js
 *
 * 문항이나 문구는 건드리지 않고 theme 와 몇 가지 표시용 낱말만 바꿉니다.
 * 한 번 돌리고 나면 다시 돌릴 일은 없습니다.
 */

const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', 'config', 'wianbu.json');
const cfg = JSON.parse(fs.readFileSync(FILE, 'utf8').replace(/^﻿/, ''));

cfg.theme = {
  bg: '#0B0A17',          // 바탕
  surface: '#15122A',     // 어두운 상자
  ink: '#F6EFE9',
  inkSub: '#9C92A5',
  accent: '#F2B29A',      // 살구색 — 참여 완료
  line: '#36323B',
  onAccent: '#1A1520',

  paper: '#FFFFFF',       // 문제·해설 흰 카드
  paperInk: '#111018',
  paperSub: '#6A6670',
  paperSoft: '#F2EFF4',   // 보기 바탕
  paperLine: '#D6D1DD',
  note: '#C25B3E',        // 해설 머리말

  fontDisplay: 'Noto Sans KR',
  fontBody: 'Noto Sans KR',
  fonts: ['Noto+Sans+KR:wght@400;500;700'],
  radius: 12,
  radiusLg: 20,
};

// 퀴즈 목록 칸과 해설 줄에 붙는 짧은 낱말
cfg.strings.legendDone = cfg.strings.legendDone || '참여 완료';
cfg.strings.legendTodo = cfg.strings.legendTodo || '미참여';
cfg.strings.myPickTag = cfg.strings.myPickTag || '내 선택';
// 맞고 틀림을 드러내지 않는 전시이므로 '정답' 대신 '기록' 이라고 적습니다
cfg.strings.recordTag = cfg.strings.recordTag || '기록';

fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
console.log('✅ config/wianbu.json 의 theme 와 표시용 낱말을 새 시안에 맞췄습니다.');
