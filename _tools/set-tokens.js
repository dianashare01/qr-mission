/*
 * set-tokens.js — 스팟 토큰을 추측하기 어려운 값으로 바꾼다.
 *
 *   node _tools/set-tokens.js wianbu
 *   node _tools/set-tokens.js wianbu --force     (이미 바꾼 것도 다시 바꿉니다)
 *
 * ⚠️ QR 을 인쇄한 뒤에 다시 돌리면 인쇄한 QR 이 전부 죽습니다.
 *    그래서 CHANGE-ME 가 아닌 값이 하나라도 있으면 --force 없이는 멈춥니다.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const project = process.argv[2];
const force = process.argv.includes('--force');

if (!project) {
  console.error('사용법: node _tools/set-tokens.js <프로젝트>   예) wianbu');
  process.exit(1);
}

const file = path.join(__dirname, '..', 'config', project + '.json');
if (!fs.existsSync(file)) { console.error('설정 파일이 없습니다: ' + file); process.exit(1); }

const raw = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
const cfg = JSON.parse(raw);

// 헷갈리는 글자(0 O 1 l I)를 뺀 소문자·숫자
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

function token(len = 6) {
  const bytes = crypto.randomBytes(len);
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return s;
}

const already = cfg.spots.filter((s) => s.token && !/^CHANGE-ME/i.test(s.token));
if (already.length && !force) {
  console.error('\n⚠️  이미 바뀐 토큰이 ' + already.length + '개 있습니다.');
  already.forEach((s) => console.error('    ' + s.id + '  ' + s.token));
  console.error('\n  QR 을 이미 인쇄했다면 다시 바꾸면 안 됩니다.');
  console.error('  그래도 바꾸려면 뒤에 --force 를 붙이세요.\n');
  process.exit(1);
}

// 같은 값이 겹치지 않게
const used = new Set();
let text = raw;

cfg.spots.forEach((s) => {
  let t;
  do { t = token(); } while (used.has(t));
  used.add(t);

  const before = s.token;
  // 설정 파일의 서식과 줄 순서를 그대로 두기 위해 문자열 치환으로 바꾼다
  const needle = '"token": "' + before + '"';
  if (!text.includes(needle)) { console.error('못 찾음: ' + needle); process.exit(1); }
  text = text.replace(needle, '"token": "' + t + '"');
  s.token = t;
});

fs.writeFileSync(file, text, 'utf8');

// 저장한 파일이 올바른 JSON 인지 다시 확인
const check = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
if (check.spots.length !== cfg.spots.length) { console.error('저장 결과가 이상합니다'); process.exit(1); }

console.log('\n✅ ' + project + ' 토큰 ' + cfg.spots.length + '개를 바꿨습니다\n');
check.spots.forEach((s) => {
  console.log('  ' + String(s.order).padStart(2) + '. ' + s.place.padEnd(22) + '  t=' + s.token);
});
console.log('\n이제 QR 을 다시 만드세요:');
console.log('  node _tools/make-qr.js --all --project=' + project + '\n');
