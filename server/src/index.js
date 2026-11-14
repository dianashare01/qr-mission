/*
 * QR 미션 공통 엔진 — 서버 (Cloudflare Workers + D1)
 * ─────────────────────────────────────────────────────────────
 * 전시 3건이 이 서버 하나를 같이 씁니다. 요청의 project 값으로 구분합니다.
 *
 * 엔드포인트
 *   POST /api/session    세션 만들기        {project, nickname, lang}
 *   GET  /api/state      진행 상황 가져오기  ?sessionId= 또는 ?project=&code=
 *   POST /api/answer     스팟 응답 저장
 *   POST /api/complete   결과 저장 (1회)
 *   POST /api/redeem     리워드 수령 (1회, PIN 확인)
 *   POST /api/message    메시지 남기기 (1회)
 *   POST /api/hit        다녀감 세기 (누구인지는 안 받음)
 *   GET  /api/content    홈페이지 문구 불러오기
 *   GET  /api/admin/stats 통계 (관리자 키 필요)  &format=csv 가능
 *   GET  /api/admin/visits  접속자 수 (관리자 키 필요)
 *   POST /api/admin/content 홈페이지 문구 저장 (관리자 키 필요)
 *
 * 설정 (wrangler secret put)
 *   ADMIN_KEY   관리자 통계 열람 키
 *   STAFF_PIN   운영요원 확인 번호 (프로젝트 공통)
 *   ALLOWED_ORIGINS  쉼표로 구분. 비우면 모두 허용
 */

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

function cors(env, req) {
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.get('Origin') || '';
  const ok = allowed.length === 0 || allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? (origin || '*') : 'null',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data, env, req, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...cors(env, req) },
  });
}

function bad(msg, env, req, status = 400) {
  return json({ ok: false, error: msg }, env, req, status);
}

const now = () => new Date().toISOString();

function uuid() {
  return crypto.randomUUID();
}

/** 6자리 이어 하기 번호. 프로젝트 안에서 겹치지 않을 때까지 다시 뽑습니다. */
async function makeCode(db, project) {
  for (let i = 0; i < 12; i++) {
    const code = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
    const hit = await db.prepare('SELECT 1 FROM sessions WHERE project = ? AND recovery_code = ?')
      .bind(project, code).first();
    if (!hit) return code;
  }
  return null;
}

async function body(req) {
  try { return await req.json(); } catch (e) { return null; }
}

/* 닉네임: 2~10자, 공백·제어문자 정리 */
function cleanNick(v) {
  const s = String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F]/g, '').trim();
  return s.length >= 2 && s.length <= 10 ? s : null;
}

/**
 * 관리자인지 확인한다.
 * 두 가지를 받습니다.
 *   ADMIN_KEY   긴 키. 컴퓨터에서 쓸 때
 *   ADMIN_CODE  짧은 코드. 현장에서 휴대폰으로 칠 때
 * 둘 다 서버에만 있고 설정 파일에는 들어가지 않습니다.
 *
 * 글자 수가 달라도 비교 시간이 같도록 해, 한 글자씩 맞춰 보는 공격을 막습니다.
 */
function sameSecret(a, b) {
  const x = String(a || '').trim();
  const y = String(b || '').trim();
  if (!y) return false;                 // 서버에 값이 없으면 통과시키지 않는다
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

function isAdmin(req, env, url) {
  const given = url.searchParams.get('key') || req.headers.get('X-Admin-Key') || '';
  return sameSecret(given, env.ADMIN_KEY) || sameSecret(given, env.ADMIN_CODE);
}

/* ── 세션 만들기 ─────────────────────────────────── */
async function createSession(req, env) {
  const b = await body(req);
  if (!b) return bad('본문을 읽지 못했습니다', env, req);

  const project = String(b.project || '').slice(0, 32);
  const nickname = cleanNick(b.nickname);
  if (!project) return bad('project 가 필요합니다', env, req);
  if (!nickname) return bad('닉네임은 2~10자여야 합니다', env, req);

  const code = await makeCode(env.DB, project);
  if (!code) return bad('번호를 만들지 못했습니다. 다시 시도해 주세요', env, req, 503);

  const id = uuid();
  await env.DB.prepare(
    'INSERT INTO sessions (id, project, nickname, lang, recovery_code, created_at) VALUES (?,?,?,?,?,?)'
  ).bind(id, project, nickname, String(b.lang || 'ko').slice(0, 8), code, now()).run();

  return json({ ok: true, sessionId: id, recoveryCode: code, nickname }, env, req);
}

/* ── 진행 상황 ───────────────────────────────────── */
async function getState(req, env, url) {
  const sessionId = url.searchParams.get('sessionId');
  const project = url.searchParams.get('project');
  const code = url.searchParams.get('code');

  let s = null;
  if (sessionId) {
    s = await env.DB.prepare('SELECT * FROM sessions WHERE id = ?').bind(sessionId).first();
  } else if (project && code) {
    s = await env.DB.prepare('SELECT * FROM sessions WHERE project = ? AND recovery_code = ?')
      .bind(project, code).first();
  } else {
    return bad('sessionId 또는 project+code 가 필요합니다', env, req);
  }
  if (!s) return bad('세션을 찾지 못했습니다', env, req, 404);

  const ans = await env.DB.prepare(
    'SELECT spot_id, k_choice, k_correct, p_choice, p_tag, p_value, answered_at FROM answers WHERE session_id = ? ORDER BY answered_at'
  ).bind(s.id).all();

  const result = await env.DB.prepare('SELECT type_tag, payload, created_at FROM results WHERE session_id = ?')
    .bind(s.id).first();
  const redeem = await env.DB.prepare('SELECT redeemed_at FROM redeems WHERE session_id = ?')
    .bind(s.id).first();
  const message = await env.DB.prepare('SELECT message, created_at FROM messages WHERE session_id = ?')
    .bind(s.id).first();

  return json({
    ok: true,
    sessionId: s.id,
    project: s.project,
    nickname: s.nickname,
    recoveryCode: s.recovery_code,
    answers: ans.results || [],
    result: result || null,
    redeem: redeem || null,
    message: message || null,
  }, env, req);
}

/* ── 응답 저장 ───────────────────────────────────── */
async function saveAnswer(req, env) {
  const b = await body(req);
  if (!b) return bad('본문을 읽지 못했습니다', env, req);
  if (!b.sessionId || !b.spotId) return bad('sessionId 와 spotId 가 필요합니다', env, req);

  const s = await env.DB.prepare('SELECT id FROM sessions WHERE id = ?').bind(b.sessionId).first();
  if (!s) return bad('세션을 찾지 못했습니다', env, req, 404);

  // 같은 스팟을 두 번 보내도 처음 것만 남습니다 (명세: 응답 수정 불가)
  const r = await env.DB.prepare(
    'INSERT OR IGNORE INTO answers (session_id, spot_id, k_choice, k_correct, p_choice, p_tag, p_value, answered_at) VALUES (?,?,?,?,?,?,?,?)'
  ).bind(
    b.sessionId, String(b.spotId).slice(0, 32),
    b.kChoice == null ? null : Number(b.kChoice),
    b.kCorrect ? 1 : 0,
    b.pChoice == null ? null : Number(b.pChoice),
    b.pTag == null ? null : String(b.pTag).slice(0, 8),
    b.pValue == null ? null : String(b.pValue).slice(0, 64),
    now()
  ).run();

  const added = (r.meta && r.meta.changes) > 0;
  return json({ ok: true, added, already: !added }, env, req);
}

/* ── 결과 저장 (1회) ─────────────────────────────── */
async function complete(req, env) {
  const b = await body(req);
  if (!b) return bad('본문을 읽지 못했습니다', env, req);
  if (!b.sessionId || !b.typeTag) return bad('sessionId 와 typeTag 가 필요합니다', env, req);

  const s = await env.DB.prepare('SELECT id, project FROM sessions WHERE id = ?').bind(b.sessionId).first();
  if (!s) return bad('세션을 찾지 못했습니다', env, req, 404);

  await env.DB.prepare(
    'INSERT OR IGNORE INTO results (session_id, project, type_tag, payload, created_at) VALUES (?,?,?,?,?)'
  ).bind(b.sessionId, s.project, String(b.typeTag).slice(0, 8),
         b.payload ? JSON.stringify(b.payload).slice(0, 4000) : null, now()).run();

  // 이미 있으면 처음 것을 그대로 돌려줍니다 (재계산 없음)
  const saved = await env.DB.prepare('SELECT type_tag, payload, created_at FROM results WHERE session_id = ?')
    .bind(b.sessionId).first();

  return json({ ok: true, result: saved }, env, req);
}

/* ── 리워드 수령 (1회, PIN 확인) ─────────────────── */
async function redeem(req, env) {
  const b = await body(req);
  if (!b) return bad('본문을 읽지 못했습니다', env, req);
  if (!b.sessionId) return bad('sessionId 가 필요합니다', env, req);

  // 비밀값을 넣을 때 줄바꿈이 섞여 들어가는 일이 잦아 앞뒤 공백은 무시한다
  // K-컬처는 직원이 앱 화면에서 확인코드를 넣어 끝내므로 서버 번호를 따로 묻지 않습니다.
  // (여기 남는 줄은 보고용 숫자일 뿐, 선물을 내주는 문은 앱 쪽에 있습니다.)
  // 앱 화면에서 확인코드로 끝내는 전시들 — 서버 번호를 따로 묻지 않습니다
  const noPin = ['kcheckin', 'seongsu', 'sinchon'].indexOf(String(b.project || '')) >= 0;
  const expected = String(env.STAFF_PIN || '').trim();
  if (!noPin && expected && String(b.pin || '').trim() !== expected) {
    return bad('번호가 맞지 않습니다', env, req, 403);
  }

  const s = await env.DB.prepare('SELECT id, project FROM sessions WHERE id = ?').bind(b.sessionId).first();
  if (!s) return bad('세션을 찾지 못했습니다', env, req, 404);

  const done = await env.DB.prepare('SELECT redeemed_at FROM redeems WHERE session_id = ?')
    .bind(b.sessionId).first();
  if (done) return json({ ok: true, already: true, redeemedAt: done.redeemed_at }, env, req);

  await env.DB.prepare(
    'INSERT OR IGNORE INTO redeems (session_id, project, staff_id, redeemed_at) VALUES (?,?,?,?)'
  ).bind(b.sessionId, s.project, b.staffId ? String(b.staffId).slice(0, 32) : null, now()).run();

  return json({ ok: true, already: false }, env, req);
}

/* ── 메시지 (1회) ────────────────────────────────── */
async function message(req, env) {
  const b = await body(req);
  if (!b) return bad('본문을 읽지 못했습니다', env, req);
  if (!b.sessionId || !b.message) return bad('sessionId 와 message 가 필요합니다', env, req);

  const s = await env.DB.prepare('SELECT id, project, nickname FROM sessions WHERE id = ?')
    .bind(b.sessionId).first();
  if (!s) return bad('세션을 찾지 못했습니다', env, req, 404);

  // 번호는 한 문장 안에서 매겨 동시에 들어와도 겹치지 않게 합니다
  const r = await env.DB.prepare(
    'INSERT OR IGNORE INTO messages (session_id, project, nickname, message, seq, created_at) '
    + 'SELECT ?, ?, ?, ?, COALESCE((SELECT MAX(seq) FROM messages WHERE project = ?), 0) + 1, ?'
  ).bind(b.sessionId, s.project, s.nickname, String(b.message).slice(0, 200), s.project, now()).run();

  const added = (r.meta && r.meta.changes) > 0;

  // 이미 남긴 경우에도 처음 받은 번호를 그대로 돌려줍니다
  const mine = await env.DB.prepare('SELECT seq FROM messages WHERE session_id = ?')
    .bind(b.sessionId).first();

  return json({ ok: true, added, already: !added, seq: mine ? mine.seq : null }, env, req);
}

/* ── 최근 기록 (관람객이 보는 것, 키 없이 열림) ───────
   닉네임과 "승인된 문장" 만 돌려줍니다. 시각이나 그 밖의 정보는 주지 않습니다. */
async function recentMessages(req, env, url) {
  const project = url.searchParams.get('project');
  if (!project) return bad('project 가 필요합니다', env, req);

  const limit = Math.min(20, Math.max(1, Number(url.searchParams.get('limit') || 5)));

  const rows = await env.DB.prepare(
    'SELECT nickname, message, seq FROM messages WHERE project = ? ORDER BY seq DESC LIMIT ?'
  ).bind(project, limit).all();

  const total = await env.DB.prepare('SELECT COUNT(*) AS n FROM messages WHERE project = ?')
    .bind(project).first();

  return json({ ok: true, total: total.n, items: rows.results || [] }, env, req);
}

/* ── 관리자 통계 ─────────────────────────────────── */
async function stats(req, env, url) {
  if (!isAdmin(req, env, url)) return bad('권한이 없습니다', env, req, 401);

  const project = url.searchParams.get('project');
  const where = project ? ' WHERE project = ?' : '';
  const bindP = project ? [project] : [];

  const started = await env.DB.prepare('SELECT COUNT(*) AS n FROM sessions' + where).bind(...bindP).first();
  const finished = await env.DB.prepare('SELECT COUNT(*) AS n FROM results' + where).bind(...bindP).first();
  const redeemed = await env.DB.prepare('SELECT COUNT(*) AS n FROM redeems' + where).bind(...bindP).first();
  const messaged = await env.DB.prepare('SELECT COUNT(*) AS n FROM messages' + where).bind(...bindP).first();

  const bySpot = await env.DB.prepare(
    'SELECT a.spot_id, COUNT(*) AS n FROM answers a JOIN sessions s ON s.id = a.session_id'
    + (project ? ' WHERE s.project = ?' : '') + ' GROUP BY a.spot_id ORDER BY a.spot_id'
  ).bind(...bindP).all();

  const byType = await env.DB.prepare(
    'SELECT type_tag, COUNT(*) AS n FROM results' + where + ' GROUP BY type_tag ORDER BY n DESC'
  ).bind(...bindP).all();

  const byHour = await env.DB.prepare(
    'SELECT substr(created_at, 1, 13) AS hour, COUNT(*) AS n FROM sessions' + where
    + ' GROUP BY hour ORDER BY hour'
  ).bind(...bindP).all();

  const data = {
    ok: true,
    project: project || '전체',
    started: started.n,
    finished: finished.n,
    completionRate: started.n ? Math.round((finished.n / started.n) * 1000) / 10 : 0,
    redeemed: redeemed.n,
    messaged: messaged.n,
    bySpot: bySpot.results || [],
    byType: byType.results || [],
    byHour: byHour.results || [],
  };

  if (url.searchParams.get('format') === 'csv') {
    const rows = [['항목', '값']];
    rows.push(['시작 수', data.started], ['완주 수', data.finished], ['완주율(%)', data.completionRate]);
    rows.push(['리워드 수령', data.redeemed], ['메시지 수', data.messaged], ['', '']);
    rows.push(['스팟', '스캔 수']);
    data.bySpot.forEach((r) => rows.push([r.spot_id, r.n]));
    rows.push(['', ''], ['유형', '인원']);
    data.byType.forEach((r) => rows.push([r.type_tag, r.n]));
    rows.push(['', ''], ['시각(UTC)', '시작 수']);
    data.byHour.forEach((r) => rows.push([r.hour, r.n]));

    const csv = '﻿' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="stats-${project || 'all'}.csv"`,
        ...cors(env, req),
      },
    });
  }

  return json(data, env, req);
}

/* ── 관리자: 남겨진 기록 보기 ────────────────────── */
/* 들어온 사람 목록 — 이름·언어·도장 수·선물 수령 여부.
   K-컬처 관리자 쪽이 이걸로 엑셀을 만듭니다. */
const PHOTO_KEEP_DAYS = 30;                  // 한 달 뒤 저절로 지웁니다

/* 하루 한 번 깨어나 한 달 지난 영수증을 치웁니다.
   Supabase 에는 R2 같은 수명 규칙이 없어 우리가 직접 지웁니다. */
async function sweepPhotos(env) {
  if (!sbReady(env)) return 0;

  /* 무료 요금제는 **한 주 동안 아무도 안 쓰면 프로젝트가 잠깁니다.**
     행사 사이에 조용한 주가 끼면 손님이 올릴 수 없게 되므로,
     치울 것이 없어도 매일 한 번은 창고를 건드려 깨워 둡니다. */
  try {
    await fetch(String(env.SB_URL).replace(/\/+$/, '') + '/storage/v1/bucket/' + sbBucket(env),
      { headers: sbHead(env) });
  } catch (e) { /* 못 깨워도 치우는 일은 계속합니다 */ }

  const cut = new Date(Date.now() - PHOTO_KEEP_DAYS * 86400 * 1000).toISOString();
  const old = await env.DB.prepare(
    'SELECT k FROM photos WHERE created_at < ? LIMIT 500'
  ).bind(cut).all();

  let gone = 0;
  for (const r of (old.results || [])) {
    try {
      await fetch(sbUrl(env, r.k), { method: 'DELETE', headers: sbHead(env) });
      await env.DB.prepare('DELETE FROM photos WHERE k = ?').bind(r.k).run();
      gone++;
    } catch (e) { /* 한 장이 안 지워져도 나머지는 계속 */ }
  }
  return gone;
}

/* ── 손님이 올린 사진 (영수증) ──────────────────
   파일은 R2 창고에, 「어디에 있는지」만 D1 에 둡니다.
   누구나 올릴 수 있는 길이라 크기·종류를 좁게 막습니다. */

const PHOTO_MAX = 10 * 1024 * 1024;          // 한 장 10MB
const PHOTO_QUOTA = 1024 * 1024 * 1024;      // 무료 요금제가 주는 1GB

/* 사진 창고는 Supabase Storage 입니다 (무료 1GB, 카드 안 받음).
   Cloudflare R2 는 계정에서 따로 켜야 해서 쓰지 않았습니다.

   넣어 두어야 하는 비밀값 (wrangler secret put)
     SB_URL     https://<프로젝트>.supabase.co
     SB_KEY     service_role 키 — 서버에서만 씁니다. 손님 화면에는 절대 두지 마세요.
     SB_BUCKET  창고 이름 (안 적으면 receipts) */
function sbReady(env) { return !!(env.SB_URL && env.SB_KEY); }
function sbBucket(env) { return env.SB_BUCKET || 'receipts'; }

function sbUrl(env, key) {
  return String(env.SB_URL).replace(/\/+$/, '')
    + '/storage/v1/object/' + sbBucket(env) + '/'
    + key.split('/').map(encodeURIComponent).join('/');
}
function sbHead(env, extra) {
  return Object.assign({
    apikey: env.SB_KEY,
    Authorization: 'Bearer ' + env.SB_KEY,
  }, extra || {});
}
const PHOTO_OK = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

async function photoUp(req, env, url) {
  if (!sbReady(env)) return bad('사진 창고가 아직 없습니다', env, req, 503);

  const project = cleanKey(url.searchParams.get('p'), 32);
  const spot = cleanKey(url.searchParams.get('s'), 32);
  if (!project) return bad('어느 행사인지 알 수 없습니다', env, req);

  const mime = (req.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
  if (!PHOTO_OK.has(mime)) return bad('사진 파일만 올릴 수 있습니다', env, req, 415);

  const len = Number(req.headers.get('Content-Length') || 0);
  if (len > PHOTO_MAX) return bad('사진이 너무 큽니다 (10MB 까지)', env, req, 413);

  const body = await req.arrayBuffer();
  if (!body.byteLength) return bad('빈 파일입니다', env, req);
  if (body.byteLength > PHOTO_MAX) return bad('사진이 너무 큽니다 (10MB 까지)', env, req, 413);

  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp'
    : (mime === 'image/heic' || mime === 'image/heif') ? 'heic' : 'jpg';
  // 날짜별로 묶어 두면 나중에 눈으로 찾기 좋습니다
  const key = `${project}/${kstDay()}/${uuid()}.${ext}`;

  // 창고가 꽉 찼으면 받지 않습니다 — 넘겨 받아 놓고 잃어버리는 것보다 낫습니다
  const used = await env.DB.prepare('SELECT COALESCE(SUM(bytes), 0) AS b FROM photos').first();
  if (Number(used.b) + body.byteLength > PHOTO_QUOTA) {
    return bad('창고가 가득 찼습니다. 운영자에게 알려 주세요', env, req, 507);
  }

  const up = await fetch(sbUrl(env, key), {
    method: 'POST',
    headers: sbHead(env, { 'Content-Type': mime, 'x-upsert': 'false' }),
    body,
  });
  if (!up.ok) {
    // 왜 거절했는지는 창고가 알려 줍니다 — 안 적어 두면 고칠 길이 없습니다
    let why = '';
    try { why = (await up.text()).slice(0, 300); } catch (e) { /* 본문이 없을 수도 */ }
    console.log('사진 올리기 실패', up.status, why);
    return json({
      ok: false,
      error: '창고에 넣지 못했습니다 (' + up.status + ')',
      detail: why,
    }, env, req, 502);
  }

  await env.DB.prepare(
    'INSERT INTO photos (k, project, spot, bytes, mime, created_at) VALUES (?,?,?,?,?,?)'
  ).bind(key, project, spot || null, body.byteLength, mime, now()).run();

  return json({ ok: true }, env, req);
}

async function adminPhotos(req, env, url) {
  if (!isAdmin(req, env, url)) return bad('권한이 없습니다', env, req, 401);

  const project = url.searchParams.get('project');
  const limit = Math.min(2000, Math.max(1, Number(url.searchParams.get('limit') || 500)));
  const where = project ? ' WHERE project = ?' : '';
  const bindP = project ? [project] : [];

  const rows = await env.DB.prepare(
    'SELECT k, spot, bytes, mime, created_at FROM photos' + where
    + ' ORDER BY created_at DESC LIMIT ?'
  ).bind(...bindP, limit).all();

  const sum = await env.DB.prepare(
    'SELECT COUNT(*) AS n, COALESCE(SUM(bytes), 0) AS b FROM photos' + where
  ).bind(...bindP).first();

  if (url.searchParams.get('format') === 'csv') {
    const out = [['번호', '올린 때(UTC)', '찍은 곳', '크기(KB)', '파일']];
    (rows.results || []).forEach((r, i) => out.push([
      sum.n - i, r.created_at, r.spot || '', Math.round(r.bytes / 1024), r.k,
    ]));
    return csv(out, `photos-${project || 'all'}.csv`, env, req);
  }

  // 남은 용량은 **창고 전체**(모든 행사 합)로 셉니다 — 1GB 를 같이 쓰니까요
  const all = await env.DB.prepare('SELECT COALESCE(SUM(bytes), 0) AS b FROM photos').first();

  return json({
    ok: true,
    project: project || '전체',
    total: sum.n,
    bytes: sum.b,
    usedBytes: Number(all.b),
    quotaBytes: PHOTO_QUOTA,
    keepDays: PHOTO_KEEP_DAYS,
    photos: rows.results || [],
  }, env, req);
}

/* 한 장 내려받기 — 관리자만. 주소에 코드를 담아 부릅니다. */
async function adminPhoto(req, env, url) {
  if (!isAdmin(req, env, url)) return bad('권한이 없습니다', env, req, 401);
  if (!sbReady(env)) return bad('사진 창고가 아직 없습니다', env, req, 503);

  const k = url.searchParams.get('k') || '';
  const row = await env.DB.prepare('SELECT k, mime FROM photos WHERE k = ?').bind(k).first();
  if (!row) return bad('그런 사진이 없습니다', env, req, 404);

  const obj = await fetch(sbUrl(env, row.k), { headers: sbHead(env) });
  if (!obj.ok) return bad('창고에서 사라졌습니다 (한 달이 지났을 수 있습니다)', env, req, 404);

  const down = url.searchParams.get('download') === '1';
  const headers = {
    'Content-Type': row.mime,
    'Cache-Control': 'private, max-age=60',
    ...cors(env, req),
  };
  if (down) headers['Content-Disposition'] = `attachment; filename="${row.k.split('/').pop()}"`;
  return new Response(obj.body, { headers });
}

async function adminPhotoDel(req, env, url) {
  if (!isAdmin(req, env, url)) return bad('권한이 없습니다', env, req, 401);
  if (!sbReady(env)) return bad('사진 창고가 아직 없습니다', env, req, 503);

  const k = url.searchParams.get('k') || '';
  const row = await env.DB.prepare('SELECT k FROM photos WHERE k = ?').bind(k).first();
  if (!row) return bad('그런 사진이 없습니다', env, req, 404);

  await fetch(sbUrl(env, row.k), { method: 'DELETE', headers: sbHead(env) });
  await env.DB.prepare('DELETE FROM photos WHERE k = ?').bind(row.k).run();
  return json({ ok: true }, env, req);
}

async function adminSessions(req, env, url) {
  if (!isAdmin(req, env, url)) return bad('권한이 없습니다', env, req, 401);

  const project = url.searchParams.get('project');
  const limit = Math.min(5000, Math.max(1, Number(url.searchParams.get('limit') || 2000)));
  const where = project ? ' WHERE s.project = ?' : '';
  const bindP = project ? [project] : [];

  const rows = await env.DB.prepare(
    'SELECT s.id, s.nickname, s.lang, s.created_at,'
    + ' (SELECT COUNT(*) FROM answers a WHERE a.session_id = s.id) AS stamps,'
    + ' (SELECT r.redeemed_at FROM redeems r WHERE r.session_id = s.id) AS redeemed_at'
    + ' FROM sessions s' + where + ' ORDER BY s.created_at DESC LIMIT ?'
  ).bind(...bindP, limit).all();

  const total = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM sessions s' + where
  ).bind(...bindP).first();

  const list = (rows.results || []).map((r) => ({
    nickname: r.nickname,
    lang: r.lang,
    stamps: r.stamps,
    redeemedAt: r.redeemed_at || null,
    createdAt: r.created_at,
  }));

  if (url.searchParams.get('format') === 'csv') {
    const out = [['번호', '이름', '언어', '도장 수', '선물 수령', '들어온 때(UTC)']];
    list.forEach((r, i) => out.push([
      total.n - i, r.nickname, r.lang, r.stamps, r.redeemedAt ? 'O' : '', r.createdAt,
    ]));
    return csv(out, `sessions-${project || 'all'}.csv`, env, req);
  }

  return json({ ok: true, project: project || '전체', total: total.n, sessions: list }, env, req);
}

async function adminMessages(req, env, url) {
  if (!isAdmin(req, env, url)) return bad('권한이 없습니다', env, req, 401);

  const project = url.searchParams.get('project');
  const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get('limit') || 500)));

  const rows = await env.DB.prepare(
    'SELECT nickname, message, created_at FROM messages'
    + (project ? ' WHERE project = ?' : '')
    + ' ORDER BY created_at DESC LIMIT ?'
  ).bind(...(project ? [project, limit] : [limit])).all();

  const total = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM messages' + (project ? ' WHERE project = ?' : '')
  ).bind(...(project ? [project] : [])).first();

  // 문장별로 몇 명이 골랐는지
  const byMessage = await env.DB.prepare(
    'SELECT message, COUNT(*) AS n FROM messages' + (project ? ' WHERE project = ?' : '')
    + ' GROUP BY message ORDER BY n DESC'
  ).bind(...(project ? [project] : [])).all();

  if (url.searchParams.get('format') === 'csv') {
    const out = [['번호', '이름', '남긴 문장', '시각(UTC)']];
    (rows.results || []).forEach((r, i) => out.push([total.n - i, r.nickname, r.message, r.created_at]));
    const csv = '﻿' + out.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="messages-${project || 'all'}.csv"`,
        ...cors(env, req),
      },
    });
  }

  return json({
    ok: true,
    project: project || '전체',
    total: total.n,
    byMessage: byMessage.results || [],
    messages: rows.results || [],
  }, env, req);
}


/* ── 홈페이지 접속자 수 ──────────────────────────── */

/* 셀 수 있는 사이트. 아무 이름이나 들어와 표가 지저분해지는 것을 막습니다. */
const SITES = new Set(['testimony', 'kcheckin', 'seongsu', 'sinchon']);

/* 엑셀에서 바로 열리는 표.
   맨 앞 \ufeff 가 없으면 엑셀이 한글을 깨뜨립니다. */
function csv(rows, filename, env, req) {
  const text = '\ufeff' + rows
    .map((r) => r.map((c) => `"${String(c == null ? '' : c).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  return new Response(text, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      ...cors(env, req),
    },
  });
}

/** 한국 시간 기준 날짜 (2026-10-29) */
function kstDay(back = 0) {
  const t = Date.now() + 9 * 3600 * 1000 - back * 86400 * 1000;
  return new Date(t).toISOString().slice(0, 10);
}

function cleanKey(v, max = 40) {
  const s = String(v == null ? '' : v).trim();
  return /^[A-Za-z0-9._:-]{1,40}$/.test(s) && s.length <= max ? s : null;
}

/** 다녀갔다고 알리기. 누구인지는 받지 않습니다. */
async function hit(req, env) {
  const b = await body(req);
  if (!b) return bad('본문을 읽지 못했습니다', env, req);

  const site = String(b.site || '').trim();
  if (!SITES.has(site)) return bad('모르는 사이트입니다', env, req);

  const page = cleanKey(b.page, 32);
  if (!page) return bad('모르는 화면입니다', env, req);

  const first = b.first ? 1 : 0;
  await env.DB.prepare(
    'INSERT INTO visits (day, site, page, views, uniq) VALUES (?, ?, ?, 1, ?)'
    + ' ON CONFLICT(day, site, page) DO UPDATE SET views = views + 1, uniq = uniq + ?'
  ).bind(kstDay(), site, page, first, first).run();

  return json({ ok: true }, env, req);
}

/** 관리자 화면에 보여 줄 숫자 */
async function visits(req, env, url) {
  if (!isAdmin(req, env, url)) return bad('권한이 없습니다', env, req, 401);

  const site = String(url.searchParams.get('site') || 'testimony').trim();
  if (!SITES.has(site)) return bad('모르는 사이트입니다', env, req);

  const days = Math.min(365, Math.max(1, Number(url.searchParams.get('days')) || 30));
  const from = kstDay(days - 1);

  const rows = await env.DB.prepare(
    'SELECT day, page, views, uniq FROM visits WHERE site = ? AND day >= ? ORDER BY day, page'
  ).bind(site, from).all();

  const byPage = await env.DB.prepare(
    'SELECT page, SUM(views) AS views, SUM(uniq) AS uniq FROM visits WHERE site = ?'
    + ' GROUP BY page ORDER BY views DESC'
  ).bind(site).all();

  const first = await env.DB.prepare(
    'SELECT MIN(day) AS day FROM visits WHERE site = ?'
  ).bind(site).first();

  if (url.searchParams.get('format') === 'csv') {
    const out = [['날짜(한국)', '화면', '들른 수', '사람 수']];
    (rows.results || []).forEach((r) => out.push([r.day, r.page, r.views, r.uniq]));
    return csv(out, `visits-${site}.csv`, env, req);
  }

  return json({
    ok: true,
    site,
    days,
    today: kstDay(),
    since: (first && first.day) || null,
    rows: rows.results || [],
    byPage: byPage.results || [],
  }, env, req);
}

/* ── 홈페이지 문구 ───────────────────────────────── */

/** 화면이 띄울 때 불러갑니다. 아무나 읽을 수 있습니다. */
async function getContent(req, env, url) {
  const site = String(url.searchParams.get('site') || 'testimony').trim();
  if (!SITES.has(site)) return bad('모르는 사이트입니다', env, req);

  const rows = await env.DB.prepare('SELECT k, v FROM content WHERE site = ?').bind(site).all();
  const items = {};
  (rows.results || []).forEach((r) => { items[r.k] = r.v; });

  return json({ ok: true, items }, env, req);
}

/** 관리자가 고친 문구를 저장합니다. 빈 값은 지워, 원래 문구로 되돌립니다. */
async function putContent(req, env, url) {
  if (!isAdmin(req, env, url)) return bad('권한이 없습니다', env, req, 401);

  const b = await body(req);
  if (!b || !b.items || typeof b.items !== 'object') return bad('고칠 내용이 없습니다', env, req);

  const site = String(b.site || 'testimony').trim();
  if (!SITES.has(site)) return bad('모르는 사이트입니다', env, req);

  const keys = Object.keys(b.items);
  if (keys.length > 200) return bad('한 번에 200개까지만 저장합니다', env, req);

  const at = now();
  const jobs = [];
  for (const raw of keys) {
    const k = cleanKey(raw);
    if (!k) return bad('이름이 이상한 칸이 있습니다: ' + String(raw).slice(0, 20), env, req);
    const v = String(b.items[raw] == null ? '' : b.items[raw]).slice(0, 4000);
    if (v.trim() === '') {
      jobs.push(env.DB.prepare('DELETE FROM content WHERE site = ? AND k = ?').bind(site, k));
    } else {
      jobs.push(env.DB.prepare(
        'INSERT INTO content (site, k, v, updated_at) VALUES (?, ?, ?, ?)'
        + ' ON CONFLICT(site, k) DO UPDATE SET v = excluded.v, updated_at = excluded.updated_at'
      ).bind(site, k, v, at));
    }
  }
  if (jobs.length) await env.DB.batch(jobs);

  return json({ ok: true, saved: jobs.length, at }, env, req);
}

/* ── 들어오는 요청 나누기 ────────────────────────── */
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const p = url.pathname;

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env, req) });

    try {
      if (p === '/api/session' && req.method === 'POST') return await createSession(req, env);
      if (p === '/api/state' && req.method === 'GET') return await getState(req, env, url);
      if (p === '/api/answer' && req.method === 'POST') return await saveAnswer(req, env);
      if (p === '/api/complete' && req.method === 'POST') return await complete(req, env);
      if (p === '/api/redeem' && req.method === 'POST') return await redeem(req, env);
      if (p === '/api/message' && req.method === 'POST') return await message(req, env);
      if (p === '/api/messages/recent' && req.method === 'GET') return await recentMessages(req, env, url);
      if (p === '/api/admin/stats' && req.method === 'GET') return await stats(req, env, url);
      if (p === '/api/admin/messages' && req.method === 'GET') return await adminMessages(req, env, url);
      if (p === '/api/admin/sessions' && req.method === 'GET') return await adminSessions(req, env, url);
      if (p === '/api/photo' && req.method === 'POST') return await photoUp(req, env, url);
      if (p === '/api/admin/photos' && req.method === 'GET') return await adminPhotos(req, env, url);
      if (p === '/api/admin/photo' && req.method === 'GET') return await adminPhoto(req, env, url);
      if (p === '/api/admin/photo' && req.method === 'DELETE') return await adminPhotoDel(req, env, url);
      if (p === '/api/hit' && req.method === 'POST') return await hit(req, env);
      if (p === '/api/content' && req.method === 'GET') return await getContent(req, env, url);
      if (p === '/api/admin/visits' && req.method === 'GET') return await visits(req, env, url);
      if (p === '/api/admin/content' && req.method === 'POST') return await putContent(req, env, url);
      if (p === '/api/health') return json({ ok: true, at: now() }, env, req);
      // 손으로 치우고 싶을 때 (관리자만)
      if (p === '/api/admin/photos/sweep' && req.method === 'POST') {
        if (!isAdmin(req, env, url)) return bad('권한이 없습니다', env, req, 401);
        return json({ ok: true, removed: await sweepPhotos(env) }, env, req);
      }

      return bad('없는 주소입니다', env, req, 404);
    } catch (e) {
      return json({ ok: false, error: '서버 오류', detail: String(e && e.message) }, env, req, 500);
    }
  },

  // 하루 한 번 깨어나 한 달 지난 영수증을 치웁니다 (wrangler.toml 의 crons)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(sweepPhotos(env));
  },
};
