-- AI 시화전 (마리서사 RE:OPEN in 인제) — 작품 표
-- 기존 qr-mission 데이터베이스에 표 하나만 더합니다.
--
-- 만드는 법:  npx wrangler d1 execute qr-mission --remote --file=./schema-sihwa.sql

CREATE TABLE IF NOT EXISTS artworks (
  token      TEXT PRIMARY KEY,          -- 주소에 쓰는 무작위 10자. 남의 작품을 짐작할 수 없게 합니다
  id         TEXT NOT NULL,             -- 사람이 읽는 번호 IJ-20261125-0012
  project    TEXT NOT NULL,             -- inje-sihwa
  name       TEXT,                      -- 필명. 없으면 「이름 없는 시인」
  poem_id    TEXT,                      -- 고른 시 (안 골랐으면 비어 있음)
  style_id   TEXT,                      -- 고른 화풍
  style_name TEXT,                      -- 화면에 보여 줄 화풍 이름
  status     TEXT NOT NULL,             -- done / fallback / hidden / deleted
  k_orig     TEXT,                      -- 창고 안의 원화 파일 이름
  k_result   TEXT,                      -- 창고 안의 시화 파일 이름
  bytes      INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_artworks_project ON artworks(project, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_artworks_id ON artworks(project, id);
