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
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_project ON messages(project, created_at);
