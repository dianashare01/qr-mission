/* 박인환(마리서사) — MBTI 창작시 48편을 설정에 넣습니다.
 *
 *   node _tools/set-inje-poems.js "<엑셀 파일 경로>"
 *
 * 엑셀은 「디아나인사이트_마리서사_MBTI_박인환풍_창작시_48편.xlsx」 형식을 따릅니다.
 *   첫 시트 = No | 그룹 | 유형 | 키워드 | 편 | 용도 | 시(행 구분) | 1행 | 2행 | 3행 | 4행 | 검수 | 비고
 *   유형마다 3편이며, 1편이 「카드 기본」, 2·3편이 「랜덤·재방문」입니다.
 *
 * 시를 고치면 엑셀만 새로 받아 이 명령을 다시 돌리면 됩니다.
 * 엑셀 자체는 검수·비고 칸이 들어 있어 저장소에 올리지 않습니다.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const MBTI = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
];

/* ── 엑셀 읽기 (따로 설치하는 꾸러미 없이) ─────────── */

function unescape(s) {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(+d))
    .replace(/&amp;/g, '&');
}

function readSheetXml(xml) {
  const rows = [];
  for (const rm of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const cm of rm[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
      const ref = (cm[1].match(/r="([A-Z]+)\d+"/) || [])[1] || 'A';
      const col = ref.split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1;
      const is = cm[2].match(/<is>([\s\S]*?)<\/is>/);
      let v = '';
      if (is) {
        v = [...is[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => unescape(m[1])).join('');
      } else {
        const vm = cm[2].match(/<v>([\s\S]*?)<\/v>/);
        if (vm) v = unescape(vm[1]);
      }
      row[col] = v;
    }
    rows.push(row);
  }
  return rows;
}

function unzipEntry(buf, want) {
  // 끝쪽 목록(EOCD)을 찾아 원하는 파일의 자리를 알아냅니다
  let eo = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eo = i; break; }
  }
  if (eo < 0) throw new Error('엑셀 파일이 아닌 것 같습니다 (목록을 찾지 못했습니다)');

  const count = buf.readUInt16LE(eo + 10);
  let p = buf.readUInt32LE(eo + 16);

  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('목록이 깨져 있습니다');
    const method = buf.readUInt16LE(p + 10);
    const nLen = buf.readUInt16LE(p + 28);
    const eLen = buf.readUInt16LE(p + 30);
    const cLen = buf.readUInt16LE(p + 32);
    const size = buf.readUInt32LE(p + 20);
    const off = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nLen);

    if (name === want) {
      const ln = buf.readUInt16LE(off + 26);
      const le = buf.readUInt16LE(off + 28);
      const start = off + 30 + ln + le;
      const raw = buf.subarray(start, start + size);
      return method === 0 ? raw : require('zlib').inflateRawSync(raw);
    }
    p += 46 + nLen + eLen + cLen;
  }
  throw new Error('엑셀 안에서 ' + want + ' 을 찾지 못했습니다');
}

function firstSheet(xlsxPath) {
  const buf = fs.readFileSync(xlsxPath);
  return readSheetXml(unzipEntry(buf, 'xl/worksheets/sheet1.xml').toString('utf8'));
}

/* ── 본 작업 ───────────────────────────────────────── */

const src = process.argv[2];
if (!src) {
  console.error('엑셀 파일 경로를 적어 주세요.');
  console.error('  node _tools/set-inje-poems.js "<엑셀 파일 경로>"');
  process.exit(1);
}
if (!fs.existsSync(src)) {
  console.error('파일을 찾지 못했습니다: ' + src);
  process.exit(1);
}

const rows = firstSheet(src).slice(1).filter((r) => r && r[2]);

const byType = {};
rows.forEach((r) => {
  const type = String(r[2] || '').trim().toUpperCase();
  const keyword = String(r[3] || '').trim();
  const poem = String(r[6] || '').replace(/\r\n/g, '\n').trim();
  if (!type || !poem) return;
  if (!byType[type]) byType[type] = { keyword: keyword, lines: [] };
  if (keyword && !byType[type].keyword) byType[type].keyword = keyword;
  byType[type].lines.push(poem);
});

const missing = MBTI.filter((t) => !byType[t] || !byType[t].lines.length);
if (missing.length) {
  console.error('시가 없는 유형이 있습니다: ' + missing.join(', '));
  process.exit(1);
}

// 엑셀에 적힌 차례대로 두되, 열여섯 유형을 늘 같은 순서로 적습니다
const ordered = {};
MBTI.forEach((t) => { ordered[t] = byType[t]; });

const cfgPath = path.join(__dirname, '..', 'config', 'inje.json');
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));

cfg.result.poem = {
  label: '당신의 시',
  labelFormat: '당신의 시 · {mbti}',
  fromSpot: 's7',
  placeholder: '마지막 질문에서 MBTI 를 고르면 당신의 시가 열립니다.',
  byType: ordered,
};

fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');

const total = MBTI.reduce((n, t) => n + ordered[t].lines.length, 0);
console.log('시 ' + total + '편을 ' + MBTI.length + '개 유형에 넣었습니다.');
MBTI.forEach((t) => {
  console.log('  ' + t + '  ' + ordered[t].lines.length + '편  ' + ordered[t].keyword);
});
