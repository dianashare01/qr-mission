-- QR 미션 공통 엔진 — 데이터베이스 구조
-- 3개 전시(위안부·박인환·K-컬처)가 이 하나를 같이 씁니다. project 칸으로 구분합니다.
--
-- 만드는 법:  npx wrangler d1 execute qr-mission --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY,
  project       TEXT NOT NULL,
  nickname      TEXT NOT NULL,
  lang          TEXT NOT NULL DEFAULT 'ko',
  recovery_code TEXT NOT NULL,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project, created_at);
-- 이어 하기 번호는 프로젝트 안에서만 겹치지 않으면 됩니다
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_code ON sessions(project, recovery_code);

CREATE TABLE IF NOT EXISTS answers (
  session_id  TEXT NOT NULL,
  spot_id     TEXT NOT NULL,
  k_choice    INTEGER,
  k_correct   INTEGER,
  p_choice    INTEGER,
  p_tag       TEXT,
  p_value     TEXT,
  answered_at TEXT NOT NULL,
  PRIMARY KEY (session_id, spot_id)          -- 같은 스팟 중복 저장을 막습니다
);
CREATE INDEX IF NOT EXISTS idx_answers_spot ON answers(spot_id);

CREATE TABLE IF NOT EXISTS results (
  session_id TEXT PRIMARY KEY,               -- 세션당 1회만 생성됩니다
  project    TEXT NOT NULL,
  type_tag   TEXT NOT NULL,
  payload    TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_results_project ON results(project, type_tag);

CREATE TABLE IF NOT EXISTS redeems (
  session_id  TEXT PRIMARY KEY,              -- 세션당 1회만 수령됩니다
  project     TEXT NOT NULL,
  staff_id    TEXT,
  redeemed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_redeems_project ON redeems(project, redeemed_at);

-- 위안부 2,745번째 기록
CREATE TABLE IF NOT EXISTS messages (
  session_id TEXT PRIMARY KEY,               -- 세션당 1회만 남길 수 있습니다
  project    TEXT NOT NULL,
  nickname   TEXT NOT NULL,
  message    TEXT NOT NULL,
  seq        INTEGER,                        -- 전시 안에서 몇 번째 기록인지 (1부터)
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_project ON messages(project, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_seq ON messages(project, seq);

-- ── 홈페이지 접속자 수 ────────────────────────────
-- 누가 왔는지는 적지 않습니다. 날짜·화면별 숫자만 셉니다.
-- uniq 는 그 브라우저가 그날 처음 들어온 경우에만 1 올라갑니다.
-- (브라우저가 스스로 '오늘 처음인지'만 알려 주며, IP·쿠키는 쓰지 않습니다.)
CREATE TABLE IF NOT EXISTS visits (
  day   TEXT NOT NULL,                       -- 2026-10-29 (한국 시간)
  site  TEXT NOT NULL,                       -- testimony
  page  TEXT NOT NULL,                       -- home / hall / tour / room:02 …
  views INTEGER NOT NULL DEFAULT 0,
  uniq  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, site, page)
);
CREATE INDEX IF NOT EXISTS idx_visits_site ON visits(site, day);

-- ── 홈페이지에서 고칠 수 있는 문구 ────────────────
-- 화면의 data-cms="키" 자리에 들어갑니다. 비어 있으면 원래 문구가 그대로 나옵니다.
CREATE TABLE IF NOT EXISTS content (
  site       TEXT NOT NULL,
  k          TEXT NOT NULL,
  v          TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (site, k)
);
