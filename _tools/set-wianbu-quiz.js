/*
 * set-wianbu-quiz.js — 여섯 문항의 질문·보기·정답·해설을 발주처 원고로 바꾼다.
 *
 *   node _tools/set-wianbu-quiz.js
 *
 * 「나의 생각」(취향) 문항과 색·문구는 건드리지 않습니다.
 * 원고가 또 바뀌면 아래 QUIZ 표만 고치고 다시 돌리면 됩니다.
 */

const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', 'config', 'wianbu.json');

/* answer 는 0 부터 셉니다. 0=A, 1=B, 2=C, 3=D */
const QUIZ = [
  {
    q: '김학순 님이 피해 사실을 공개 증언한 해는 언제일까요?',
    options: ['1965년', '1991년', '1992년', '2015년'],
    answer: 1,
    explain:
      '1991년 8월 14일, 김학순 님이 피해 사실을 처음으로 공개 증언했습니다. '
      + '이 증언이 다른 피해자들의 증언과 이듬해 수요시위로 이어졌습니다. '
      + '이후 2017년, 이 날을 기념하자는 취지에서 일본군 ‘위안부’ 피해자 기림의 날이 제정되었습니다.',
  },
  {
    q: '2016년 국제연대위원회가 유네스코 세계기록유산에 공동 등재를 신청한 ‘일본군 위안부의 목소리’ 기록은 모두 몇 건일까요?',
    options: ['1,499건', '2,744건', '2,745건', '563건'],
    answer: 1,
    explain:
      '역사적 흐름을 보여주는 공문서 563건, 피해자가 직접 남긴 기록 1,449건, '
      + '시민사회단체의 운동 기록 732건. 이 세 가지를 합한 2,744건이 ‘일본군 위안부의 목소리’를 이룹니다.',
  },
  {
    q: '일본 정부를 상대로 사죄와 배상을 요구하는 소송을 제기하고, 그 투쟁 기록을 담은 다큐멘터리 영화 〈나의 마음은 지지 않았다〉의 주인공이기도 한 인물은 누구일까요?',
    options: ['김복동', '강일출', '이옥선', '송신도'],
    answer: 3,
    explain:
      '송신도 님은 1993년부터 일본 정부를 상대로 사죄를 요구하는 소송을 제기하였습니다. '
      + '10년간의 긴 재판 끝에 얻은 결과는 ‘패소’였지만, 송신도 님은 ‘지금이 가장 행복하다’는 말을 남기는 등 '
      + '재판을 준비하고 맞서는 과정에서 긴 세월 동안 몸과 마음에 남았던 상흔을 치유하였습니다.',
  },
  {
    q: '‘만삭의 위안부’로도 유명한 이 사진의 인물은 누구일까요?',
    options: ['박영심', '김학순', '이옥선', '김복동'],
    answer: 0,
    explain:
      '2차 세계대전 당시 미·중 연합군이 촬영한 ‘만삭의 위안부’ 사진 속 인물은 박영심 님입니다. '
      + '박영심 님은 일본 도쿄에서 열린 2000년 일본군 성노예 전범 여성국제법정에 북한측 증인으로 참석하여 '
      + '사진 속 인물이 본인임을 증언하였습니다.',
  },
  {
    q: '수요시위가 처음 열린 해는 언제일까요?',
    options: ['1988년', '1990년', '1992년', '2007년'],
    answer: 2,
    explain:
      '1992년입니다. 1992년 1월 8일 첫 수요시위가 열린 뒤 2026년 지금까지도 매주 수요일에 이어지고 있습니다.',
  },
  {
    q: '2,744개의 기록 다음, 2,745번째 기록을 쓰는 것은 누구의 몫일까요?',
    options: ['연구자', '정부', '오늘 이곳에 온 나', 'A·B·C를 포함한 우리 모두'],
    answer: 3,
    explain:
      '일본군 ‘위안부’ 문제는 어떤 개인, 나라의 문제가 아닌 우리 모두가 해결해야 할 문제입니다.',
  },
];

const cfg = JSON.parse(fs.readFileSync(FILE, 'utf8').replace(/^﻿/, ''));

if (cfg.spots.length !== QUIZ.length) {
  console.error('전시 지점이 ' + cfg.spots.length + '곳인데 문항은 ' + QUIZ.length + '개입니다. 수를 맞춰 주세요.');
  process.exit(1);
}

cfg.spots.forEach(function (sp, i) {
  const n = QUIZ[i];
  sp.knowledge.q = n.q;
  sp.knowledge.options = n.options.slice();
  sp.knowledge.answer = n.answer;
  sp.knowledge.explain = n.explain;

  // 해설 아래 덧붙이던 한 줄은 시안에 없어 쓰지 않습니다
  delete sp.knowledge.explainTitle;
  delete sp.knowledge.explainValue;
});

fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2) + '\n', 'utf8');

console.log('✅ 여섯 문항을 원고대로 넣었습니다.\n');
cfg.spots.forEach(function (sp, i) {
  const ab = ['A', 'B', 'C', 'D'][sp.knowledge.answer];
  console.log('  ' + sp.order + '. ' + sp.item.label);
  console.log('     Q. ' + sp.knowledge.q);
  console.log('     보기 ' + sp.knowledge.options.length + '개 · 정답 ' + ab + ' ' + sp.knowledge.options[sp.knowledge.answer] + '\n');
});
