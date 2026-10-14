/*
 * test-server.js — 서버가 실제로 동작하는지 끝까지 확인한다.
 *
 *   node _tools/test-server.js <서버주소> <ADMIN_KEY> [STAFF_PIN]
 *
 * 관람객 한 명이 하는 일을 그대로 따라 하고, 마지막에 시험 자료를 지웁니다.
 */

const https = require('https');

const BASE = (process.argv[2] || '').replace(/\/+$/, '');
const KEY = process.argv[3] || '';
const PIN = process.argv[4] || '';

if (!BASE || !KEY) {
  console.error('사용법: node _tools/test-server.js <서버주소> <ADMIN_KEY> [STAFF_PIN]');
  process.exit(1);
}

function call(method, path, body) {
  return new Promise((resolve) => {
    const data = body == null ? null : JSON.stringify(body);
    const u = new URL(BASE + path);
    const req = https.request({
      method,
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {},
      timeout: 15000,
    }, (res) => {
      let t = '';
      res.on('data', (c) => { t += c; });
      res.on('end', () => {
        let j = null;
        try { j = JSON.parse(t); } catch (e) {}
        resolve({ status: res.statusCode, json: j, text: t });
      });
    });
    req.on('error', (e) => resolve({ status: 0, text: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, text: '시간 초과' }); });
    if (data) req.write(data);
    req.end();
  });
}

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (detail ? '  → ' + detail : '')); }
}

(async () => {
  console.log('\n서버: ' + BASE + '\n');

  // 1. 세션
  let r = await call('POST', '/api/session', { project: 'wianbu', nickname: '시험', lang: 'ko' });
  check('세션 만들기', r.status === 200 && r.json && r.json.sessionId, r.text.slice(0, 100));
  if (!r.json || !r.json.sessionId) { console.log('\n세션을 못 만들어 더 진행하지 못합니다.\n'); process.exit(1); }
  const sid = r.json.sessionId;
  const code = r.json.recoveryCode;
  check('이어 하기 번호 6자리', /^\d{6}$/.test(code || ''), code);

  // 2. 닉네임 검사
  r = await call('POST', '/api/session', { project: 'wianbu', nickname: 'ㄱ' });
  check('짧은 닉네임 거부', r.status === 400);

  // 3. 응답 6개
  const tags = ['L', 'L', 'L', 'R', 'T', 'Q'];
  let allOk = true;
  for (let i = 1; i <= 6; i++) {
    r = await call('POST', '/api/answer', {
      sessionId: sid, spotId: 's' + i, kChoice: 1, kCorrect: true,
      pChoice: 0, pTag: tags[i - 1], pValue: 'v' + i,
    });
    if (r.status !== 200) allOk = false;
  }
  check('응답 6개 저장', allOk);

  // 4. 중복 저장 막기
  r = await call('POST', '/api/answer', { sessionId: sid, spotId: 's1', kChoice: 2, pTag: 'Q' });
  check('같은 스팟 중복 저장 차단', r.json && r.json.already === true);

  // 5. 결과
  r = await call('POST', '/api/complete', { sessionId: sid, typeTag: 'L' });
  check('결과 저장', r.status === 200 && r.json && r.json.result && r.json.result.type_tag === 'L');

  r = await call('POST', '/api/complete', { sessionId: sid, typeTag: 'Q' });
  check('결과 재계산 차단 (L 유지)', r.json && r.json.result && r.json.result.type_tag === 'L');

  // 6. 메시지
  r = await call('POST', '/api/message', { sessionId: sid, message: '기억하겠습니다.' });
  check('메시지 저장', r.json && r.json.added === true);

  r = await call('POST', '/api/message', { sessionId: sid, message: '다른 문장' });
  check('메시지 중복 차단', r.json && r.json.already === true);

  // 7. 이어 하기 번호로 복구
  r = await call('GET', '/api/state?project=wianbu&code=' + code);
  check('번호로 복구', r.json && r.json.ok && (r.json.answers || []).length === 6);

  r = await call('GET', '/api/state?project=wianbu&code=000000');
  check('없는 번호 거부', r.status === 404);

  // 8. 리워드 (PIN 을 준 경우만)
  if (PIN) {
    r = await call('POST', '/api/redeem', { sessionId: sid, pin: 'wrong' });
    check('틀린 PIN 거부', r.status === 403);

    r = await call('POST', '/api/redeem', { sessionId: sid, pin: PIN });
    check('맞는 PIN 수령', r.json && r.json.ok === true && r.json.already === false);

    r = await call('POST', '/api/redeem', { sessionId: sid, pin: PIN });
    check('중복 수령 차단', r.json && r.json.already === true);
  }

  // 9. 관리자
  r = await call('GET', '/api/admin/stats?key=' + encodeURIComponent(KEY) + '&project=wianbu');
  check('통계 열람', r.status === 200 && r.json && r.json.ok);

  r = await call('GET', '/api/admin/stats?key=wrong');
  check('잘못된 키 거부', r.status === 401);

  r = await call('GET', '/api/admin/messages?key=' + encodeURIComponent(KEY) + '&project=wianbu');
  check('남겨진 기록 열람', r.status === 200 && r.json && r.json.ok && r.json.total >= 1);

  console.log('\n' + pass + ' 통과 / ' + fail + ' 실패');
  console.log('\n※ 시험으로 만든 자료가 남아 있습니다. 지우려면:');
  console.log('   npx wrangler d1 execute qr-mission --remote --command "DELETE FROM sessions WHERE nickname=\'시험\'"');
  console.log('   (answers·results·messages 도 같이 지우려면 아래 README 참고)\n');

  process.exit(fail ? 1 : 0);
})();
