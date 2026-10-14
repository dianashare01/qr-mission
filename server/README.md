# 서버 (Cloudflare Workers + D1)

전시 3건이 **이 서버 하나, 데이터베이스 하나**를 같이 씁니다. 요청의 `project` 값으로 구분합니다.

```
휴대폰 (GitHub Pages 페이지)
   │  https://qr-mission-api.<계정>.workers.dev/api/...
   ▼
Cloudflare Workers ──▶ D1 (SQLite)
```

## 무료 한도와 우리 사용량

한도는 **프로젝트별이 아니라 계정 전체** 기준입니다. 3건을 합쳐서 계산해야 합니다.

| | 무료 한도 (하루) | 관람객 1,000명 × 3개 전시 |
|---|---|---|
| 요청 수 | 100,000 | **30,000** (1/3) |
| DB 쓰기 | 100,000 행 | **30,000 행** |
| DB 읽기 | 5,000,000 행 | 훨씬 적음 |
| 저장 용량 | 5 GB | 1명당 1KB 미만 |

관람객 1명이 보내는 요청은 약 10건입니다(시작 1 + 스팟 6~7 + 결과 1 + 수령/메시지 1).
**여유가 3배 이상**이고, 카드 등록도 필요 없습니다.

> 한도를 넘기면 그날 **UTC 자정(한국 시간 오전 9시)까지** 중단됩니다. 전시 중 오전 9시에
> 풀리는 셈이라, 혹시 몰라 관리자 통계에서 요청 수를 가끔 확인하시는 걸 권합니다.

---

## 만드는 순서

### 0. 준비

[dash.cloudflare.com](https://dash.cloudflare.com) 가입 (무료, 카드 불필요).

```bash
cd server
npx wrangler login
```

### 1. 데이터베이스 만들기

```bash
npx wrangler d1 create qr-mission
```

출력에 나오는 `database_id` 를 **`wrangler.toml` 의 `database_id`** 에 붙여넣으세요.

### 2. 표 만들기

```bash
npx wrangler d1 execute qr-mission --remote --file=./schema.sql
```

### 3. 비밀값 넣기

```bash
npx wrangler secret put ADMIN_KEY     # 통계를 볼 때 쓰는 아무 긴 문자열
npx wrangler secret put STAFF_PIN     # 운영요원 확인 번호 (예: 4자리)
```

> **PIN 은 설정 파일이 아니라 여기에 넣으세요.** 설정 파일은 누구나 볼 수 있습니다.

### 4. 올리기

```bash
npx wrangler deploy
```

끝나면 주소가 나옵니다:

```
https://qr-mission-api.<계정이름>.workers.dev
```

### 5. 웹에 연결

`config/wianbu.json` 과 `config/inje.json` 의 `api.baseUrl` 에 그 주소를 넣고 GitHub 에 Push.

```json
"api": { "baseUrl": "https://qr-mission-api.<계정이름>.workers.dev" }
```

### 6. 확인

```
https://qr-mission-api.<계정이름>.workers.dev/api/health
```

`{"ok":true,...}` 가 나오면 됩니다.

---

## 서버를 붙이면 되는 것

| | 서버 없을 때 | 서버 있을 때 |
|---|---|---|
| 진행 상황 | 그 휴대폰에만 | 서버에 저장 |
| 기기 바꿔서 이어 하기 | ❌ | ✅ 6자리 번호로 |
| 리워드 중복 수령 | ❌ 막지 못함 | ✅ 세션당 1회 고정 |
| 2,745번째 기록 | 모이지 않음 | ✅ 모임 |
| 관리자 통계 | ❌ | ✅ 완주율·스팟별·유형별 |
| 운영요원 PIN | 설정 파일에 노출 | ✅ 서버에만 |

**서버가 잠깐 안 되어도 체험은 멈추지 않습니다.** 화면은 서버 응답을 기다리지 않고,
실패하면 그 휴대폰에만 저장된 채로 계속 진행됩니다.

---

## 주소 모음

| 주소 | 하는 일 |
|---|---|
| `POST /api/session` | 세션 만들기 → 6자리 번호 발급 |
| `GET /api/state?sessionId=` | 진행 상황 |
| `GET /api/state?project=&code=` | **이어 하기 번호로 복구** |
| `POST /api/answer` | 스팟 응답 저장 (중복은 무시) |
| `POST /api/complete` | 결과 저장 (1회) |
| `POST /api/redeem` | 리워드 수령 (PIN 확인, 1회) |
| `POST /api/message` | 메시지 남기기 (1회) |
| `GET /api/admin/stats?key=` | 통계 |
| `GET /api/health` | 살아 있는지 확인 |

### 통계 보기

```
https://<주소>/api/admin/stats?key=<ADMIN_KEY>
https://<주소>/api/admin/stats?key=<ADMIN_KEY>&project=wianbu
https://<주소>/api/admin/stats?key=<ADMIN_KEY>&project=wianbu&format=csv
```

시작 수 · 완주 수 · 완주율 · 스팟별 스캔 수 · 유형 분포 · 시간대별 참여 · 리워드 수령 수가 나옵니다.
`format=csv` 는 엑셀로 바로 열립니다.

### 메시지 내려받기 (위안부)

```bash
npx wrangler d1 execute qr-mission --remote \
  --command "SELECT nickname, message, created_at FROM messages WHERE project='wianbu' ORDER BY created_at"
```

---

## 지켜 둔 것

- **중복 저장 방지**: 같은 스팟을 두 번 보내도 처음 것만 남습니다 (명세: 응답 수정 불가)
- **결과 고정**: 결과는 세션당 1회만 만들어지고, 다시 보내도 처음 것을 돌려줍니다
- **수령 1회**: 리워드와 메시지는 세션당 한 번만 기록됩니다
- **허용 주소 제한**: `wrangler.toml` 의 `ALLOWED_ORIGINS` 에 적힌 곳에서만 호출됩니다
- **개인정보**: 닉네임과 언어 외에는 받지 않습니다
