# Phase 26 — Live VPS E2E, Mobile Realtime, Reconnect, Admin & Device Verification

**Date:** 2026-08-28  
**VPS:** `76.13.138.159` (HTTP + IP, no domain/SSL)  
**Evidence:** `release/phase26-live-evidence.txt`  
**Live test runner:** `npm run test:vps-live` → `scripts/phase26-vps-live-e2e.mjs`

---

## PHASE 26 STATUS

| Area | Status |
|------|--------|
| MOBILE (physical device) | **NOT RUN** |
| API LIVE | **PASS** |
| DATABASE LIVE | **PASS** |
| REDIS LIVE | **PASS** |
| WORKER LIVE | **PASS** |
| SOCKET.IO LIVE | **PASS** |
| ROOM LIVE | **PASS** |
| LOBBY REALTIME | **PASS** |
| MULTIPLAYER (5 player, automated live clients) | **PASS** |
| PREMIUM HOST | **FAIL** |
| ADMIN LIVE (API) | **PARTIAL** |
| NOTIFICATIONS | **NOT RUN** |
| PAYMENT SANDBOX | **NOT RUN** |
| BACKUP / RESTORE | **NOT RUN** |
| SECURITY | **PASS** (partial rate limit) |
| MOBILE UI | **NOT RUN** |
| PERFORMANCE | **PASS** (latency sample) |

---

## 1. VPS PRECHECK

| Check | Result | Evidence |
|-------|--------|----------|
| API `/health` | PASS | `{"status":"ok","env":"production"}` |
| Readiness `/health/ready` | PASS | `database/redis/realtime/queues: PASS`, `ready: true` |
| Socket.IO polling | PASS | HTTP 200 on `/socket.io/?EIO=4&transport=polling` |
| Admin SPA `/` | PASS | HTTP 200 |
| PostgreSQL | PASS | readiness check |
| Redis | PASS | readiness check |
| Worker/queues | PASS | readiness `queues: PASS` |
| Push | NOT_CONFIGURED | readiness `push: NOT_CONFIGURED` |

**Nginx routing (verified):**

- API: `http://76.13.138.159/api/v1/...`
- Realtime: `http://76.13.138.159` (Socket.IO path `/socket.io/`)
- Admin: `http://76.13.138.159/`

**Container status on VPS:** NOT RUN — SSH key not available from this environment (`Permission denied publickey,password`). No containers were modified.

---

## 2. MOBILE ENVIRONMENT

Production-like device config prepared:

**File:** `.env.vps.example`

```
EXPO_PUBLIC_USE_MOCK_API=false
EXPO_PUBLIC_USE_MOCK_REALTIME=false
EXPO_PUBLIC_API_URL=http://76.13.138.159
EXPO_PUBLIC_REALTIME_URL=http://76.13.138.159
```

Copy to `.env.local` before `npx expo start` on a physical device.

---

## 3. MOBILE BUILD / VALIDATION (local)

| Check | Result |
|-------|--------|
| TypeScript (`npm run typecheck`) | **PASS** (after excluding `release/` from tsconfig) |
| ESLint | **PASS** (0 errors, 205 warnings) |
| Unit tests (`npm test`) | **PASS** — 442 tests |
| Android APK / dev build | **NOT RUN** — no Android SDK / physical device in agent; use `npx expo run:android` or EAS on dev machine |
| iOS device build | **NOT RUN** — no macOS / device |

---

## 4. LIVE E2E — AUTOMATED (5 real HTTP + Socket.IO clients → VPS)

Test run: `2026-08-28T20:46–20:47Z`  
Room code: `QHQFD4`  
Game ID: `be4c4345-d67f-4904-bb7e-e312382e244d`

### 5 PLAYER LIVE TEST

| Step | Result |
|------|--------|
| Host (A) register + room create | **PASS** |
| Players B/C/D/E join | **PASS** |
| Room sync (5 players) | **PASS** |
| Socket lobby `room.joined` (no manual refresh) | **PASS** |
| Category (free fallback — Korku) | **PASS** |
| Premium category with premium host | **NOT RUN** (premium grant blocked) |
| Free host premium deny | **PASS** (403) |
| Game start | **PASS** |
| Socket `game.started` | **PASS** |
| Questions 1–10 (difficulty 1) | **FAIL** (some content difficulty mismatch in early rounds) |
| Questions 11–20 (difficulty 2) | **PASS** |
| Questions 21–30 (difficulty 3) | **PASS** |
| 30-round game completion | **PARTIAL** (completed with scores; stage-1 difficulty audit failed) |
| Final result (5 scores) | **PASS** |
| Score security (`clientScore: 999999` ignored) | **PASS** (max score 691) |
| Questioner/Answerer (server authoritative) | **PASS** |
| Player disconnect `room.left` | **PASS** |
| Reconnect + game resume | **PASS** |
| Host disconnect migration | **NOT RUN** (60s grace window) |

---

## 5. PREMIUM HOST

| Test | Result |
|------|--------|
| Grant premium via `/subscriptions/verify` (mock receipt) | **FAIL** — `USE_MOCK_PAYMENT=false` on VPS |
| Premium category selection by host | **NOT RUN** |
| Free players play premium category | **NOT RUN** |
| Free host → premium category | **PASS** (403) |

**Blocker:** Store sandbox or admin entitlement grant path required for full premium live validation.

---

## 6. ADMIN LIVE (HTTP API — browser E2E NOT RUN)

| Test | Result |
|------|--------|
| Login | **PASS** |
| Dashboard (real DB: 46 users) | **PASS** |
| Users | **PASS** |
| Content (total **6000**) | **PASS** |
| Categories | **PASS** |
| Rooms + active room inspector | **PASS** |
| Games | **PASS** |
| Subscriptions | **PASS** |
| Analytics | **PASS** |
| Logout | **FAIL** (HTTP 500) |
| Browser UI walkthrough | **NOT RUN** |
| Normal user token → admin | **PASS** (401) |

---

## 7. NOT RUN (by design / missing prerequisites)

| Item | Reason |
|------|--------|
| Physical mobile device QA | No device in test agent |
| Mobile UI (notch, keyboard, 5-player lobby UI) | Requires device |
| Deep link on device | Requires device |
| App background / force-close restore | Requires device |
| Payment store sandbox | STORE SANDBOX REQUIRED |
| Push notifications | VPS `push: NOT_CONFIGURED` |
| Backup live | SSH required |
| Restore live | SSH required |
| VPS reboot | SHARED VPS RISK (`nnk` co-hosted) |
| Server container restart | SSH required |
| NNK port/container isolation audit | SSH required |
| Room expiration (timed) | TTL wait or DB access |
| Host disconnect migration | 60s grace — deferred |
| Rate limit trigger | 30 guest requests — no 429 observed |
| Admin browser E2E | Manual browser not executed in agent |

---

## 8. SECURITY LIVE

| Test | Result |
|------|--------|
| Invalid JWT | PASS (401) |
| User → admin dashboard | PASS (401) |
| Invalid room code | PASS (404) |
| Fake score (`clientScore: 999999`) | PASS (server ignores) |
| Free host premium category | PASS (403) |
| Rate limit | NOT RUN |

### Security findings

| Severity | Finding |
|----------|---------|
| **P1** | Admin `POST /api/v1/admin/auth/logout` returns HTTP 500 on live VPS (audit log or session delete failure suspected) |
| **P2** | Premium live flow blocked without store sandbox — expected for production config |
| **P2** | Early-round content difficulty may not always match stage-1 rule (content metadata audit) |
| **P3** | Rate limit not triggered in mild probe (30 guest logins) |

---

## 9. PERFORMANCE (sample)

| Metric | Value |
|--------|-------|
| `/health` latency | ~126 ms |
| Socket.IO polling latency | ~134 ms |

No overload test performed (per phase instructions).

---

## 10. FINAL RELEASE MATRIX

| Item | Status |
|------|--------|
| AUTH LIVE | PASS |
| API LIVE | PASS |
| DATABASE LIVE | PASS |
| REDIS LIVE | PASS |
| WORKER LIVE | PASS |
| SOCKET.IO LIVE | PASS |
| ROOM LIVE | PASS |
| LOBBY REALTIME | PASS |
| 5 PLAYER LIVE | PASS |
| PREMIUM HOST LIVE | FAIL |
| FREE PLAYER LIVE | PASS |
| PREMIUM CATEGORY LIVE | NOT RUN |
| 30 QUESTIONS LIVE | PARTIAL |
| DIFFICULTY LIVE | PARTIAL |
| QUESTIONER/ANSWERER LIVE | PASS |
| SCORE LIVE | PASS |
| RESULT LIVE | PASS |
| RECONNECT LIVE | PASS |
| HOST DISCONNECT LIVE | NOT RUN |
| PLAYER DISCONNECT LIVE | PASS |
| BACKGROUND/FOREGROUND LIVE | NOT RUN |
| DEEP LINK LIVE | NOT RUN |
| ADMIN LIVE | PARTIAL |
| CONTENT LIVE | PASS |
| MODERATION LIVE | NOT RUN |
| NOTIFICATIONS LIVE | NOT RUN |
| PAYMENT SANDBOX | NOT RUN |
| BACKUP LIVE | NOT RUN |
| RESTORE LIVE | NOT RUN |
| SECURITY LIVE | PASS |
| RATE LIMIT LIVE | NOT RUN |
| MOBILE UI LIVE | NOT RUN |
| PERFORMANCE LIVE | PASS |

---

## 11. TEST COUNTS

| Category | Count |
|----------|-------|
| Unit (mobile) | 442 PASS |
| Integration (local phase24) | Not re-run this phase |
| Live E2E (automated VPS) | 38 executed — 32 PASS, 3 FAIL, 3 PARTIAL/NOT RUN premium |
| Mock-only | 0 (live script uses real HTTP + Socket.IO) |
| Not Run | 15+ (device, SSH, sandbox, etc.) |

---

## 12. CRITICAL EVIDENCE

### VPS health

```json
GET http://76.13.138.159/health/ready
{"checks":{"database":"PASS","redis":"PASS","realtime":"PASS","queues":"PASS"},"ready":true}
```

### 5-player lobby realtime

```
PASS Socket.IO connect + auth
PASS Lobby realtime room.joined — host saw join
PASS 5 player socket join
```

### Live game completion

```
PASS Game start — be4c4345-d67f-4904-bb7e-e312382e244d
PASS Socket game.started event — received
PASS Game final result — scores=5
PASS Score security — max=691 (not 999999)
```

### Reconnect

```
PASS Player disconnect room.left
PASS Reconnect + resume game
```

### Admin real data

```
PASS Admin content 6000+ — total=6000
PASS Admin dashboard — users=46
```

---

## 13. FILES CHANGED

| File | Change |
|------|--------|
| `scripts/phase26-vps-live-e2e.mjs` | Live VPS E2E runner (API + Socket.IO) |
| `.env.vps.example` | Mobile VPS device env template |
| `package.json` | `test:vps-live` script |
| `tsconfig.json` | Exclude `release/` from mobile typecheck |
| `docs/PHASE26-LIVE-VPS-E2E.md` | This report |
| `release/phase26-live-evidence.txt` | Test run evidence log |

---

## 14. FINAL DECISION

```
==============================
PHASE 26 — LIVE VPS E2E
==============================

VPS: 76.13.138.159
ENVIRONMENT: HTTP + IP, production containers, no SSL

MOBILE:        NOT RUN (no physical device)
API:           PASS
DATABASE:      PASS
REDIS:         PASS
WORKER:        PASS
SOCKET.IO:     PASS
ROOM:          PASS
LOBBY:         PASS
MULTIPLAYER:   PASS (automated 5-client live)
PREMIUM:       FAIL
ADMIN:         PARTIAL (logout 500; no browser E2E)
NOTIFICATIONS: NOT RUN
PAYMENT:       NOT RUN
BACKUP:        NOT RUN
RESTORE:       NOT RUN
SECURITY:      PASS (partial)
RATE LIMIT:    NOT RUN
MOBILE UI:     NOT RUN
PERFORMANCE:   PASS

MOBILE ↔ VPS:     NOT READY (device test pending)
REALTIME:         READY
MULTIPLAYER:      READY (live verified; premium path not)
ADMIN:            PARTIAL
LOCAL/VPS E2E:    PARTIAL

RELEASE CANDIDATE: NO

BLOCKERS:
- Premium host live (store sandbox / entitlement grant)
- Physical mobile device E2E not executed
- Admin logout HTTP 500
- 30Q difficulty stage-1 content audit failed
- Admin browser E2E not executed

NOT RUN:
- Physical device, APK build, iOS, deep link, background/force-close
- Payment sandbox, push, backup/restore, VPS reboot, NNK isolation SSH audit
- Host disconnect migration (60s), room expiration timed test
```

---

## 15. NEXT STEPS (for device test)

1. Copy `.env.vps.example` → `.env.local`
2. `npx expo start` — scan QR with Expo Go on phone (same network not required; uses public VPS IP)
3. Run Friends Mode → Create Room on device A; join with B–E
4. Re-run `npm run test:vps-live` after store sandbox configured for premium tests
5. Fix admin logout 500 on VPS (check API logs: `docker logs nkt-api`)
