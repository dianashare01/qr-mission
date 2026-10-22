/*
 * set-wianbu-copy.js — 퀴즈 시안에 적힌 문구·구역명을 설정 파일에 넣는다.
 *
 *   node _tools/set-wianbu-copy.js
 *
 * 시안(퀴즈 목록 / Q1 문제 / Q1 정답 해설 / Q2 오답 해설 / 전체 완료)에
 * 적혀 있는 글만 옮겨 적습니다. 문항과 해설 본문은 건드리지 않습니다.
 */

const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', 'config', 'wianbu.json');
const cfg = JSON.parse(fs.readFileSync(FILE, 'utf8').replace(/^﻿/, ''));

/* 시안의 퀴즈 목록 카드에 적힌 구역 이름 */
const LABELS = [
  '서문 연표의 길',
  '2,744개의 기록',
  '증언의 목소리',
  '삶이 보여준 증언',
  '기억이 된 기록',
  '서고의 숲',
];

cfg.spots.forEach(function (sp, i) {
  if (LABELS[i]) sp.item.label = LABELS[i];
});

const s = cfg.strings;

// 흰 카드 위에 놓이는 쪽 제목 (문제·해설 화면 공통)
s.quizHeadline = '전시를 읽고,\n기억을 확인합니다';

// 보기 아래 안내 — 누르면 바로 넘어갑니다
s.pickHint = '보기를 눌러 답을 고르세요';

// 퀴즈 목록 화면
s.boardEyebrowFormat = 'QUIZ · {done} / {total}';
s.boardTitle = '전시를 읽고,\n기억을 확인합니다';
s.boardBody = '퀴즈는 전시장 곳곳의 QR을 찍을 때마다 한 문제씩 열립니다.\n아직 참여하지 않은 전시장의 QR을 찾아보세요!';
s.boardCta = '퀴즈 목록으로';

// 이름 적는 첫 화면 — 목록 화면의 윗부분을 그대로 씁니다
s.startTitle = s.boardTitle;
s.startBody = s.boardBody;

// 맨 아래 주최 표기
s.footerLine = "한국여성인권진흥원 일본군 '위안부' 문제연구소 주관\n증언 : 다음페이지 - 2,745번째 기록";

fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
console.log('✅ 퀴즈 시안 문구를 config/wianbu.json 에 넣었습니다.');
LABELS.forEach(function (l, i) { console.log('   ' + (i + 1) + '. ' + l); });
