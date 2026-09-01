# Phase 27 — Local Android Build + Real Device / VPS Connection

**Date:** 2026-08-29  
**VPS:** `http://76.13.138.159` (HTTP, no SSL)  
**Package ID:** `com.nkt.app`

---

## PHASE 27 STATUS

| Area | Status |
|------|--------|
| ANDROID ENV (developer machine) | **PASS** |
| ANDROID SDK | **PASS** (`D:\Android\Sdk`) |
| ADB | **PASS** |
| CONNECTED DEVICE | **NOT RUN** (no phone/emulator connected) |
| APK BUILD | **FAIL** (Gradle: expo-constants mismatch fixed via `expo install --fix`; re-run `build-android-local.ps1`) |
| APK INSTALL | **NOT RUN** |
| MOBILE → VPS (device) | **NOT RUN** |
| VPS API/Realtime (scripts) | **PASS** |
| ADMIN LOGOUT (code fix) | **PASS** (local); **FAIL** on live VPS until redeploy |
| DIFFICULTY BUG (engine) | **FIXED** (wrong-difficulty fallback removed) |
| CONTENT DATASET | **PASS** (6000 items, balanced difficulty) |

---

## 1. Environment Discovery (Windows Developer Machine)

| Tool | Result |
|------|--------|
| Node.js | **PASS** v24.13.0 |
| npm | **PASS** 11.6.2 |
| npx | **PASS** 11.6.2 |
| Java/JDK | **PASS** OpenJDK 17.0.18 |
| ANDROID_HOME | **PASS** `D:\Android\Sdk` |
| adb | **PASS** v1.0.41 |
| emulator | **PASS** available |
| Gradle/gradlew | **PASS** after `npx expo prebuild` |
| Connected device | **WARNING** none |

Run anytime:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-android-env.ps1
powershell -ExecutionPolicy Bypass -File scripts/check-android-device.ps1
```

---

## 2. Automation Scripts (Windows)

| Script | Purpose |
|--------|---------|
| `scripts/check-android-env.ps1` | Full env audit (PASS/FAIL/WARNING) |
| `scripts/check-android-device.ps1` | `adb devices` status |
| `scripts/check-vps.ps1` | VPS health + socket + admin logout test |
| `scripts/use-vps-local.ps1` | `.env.vps.example` → `.env.local` (with backup) |
| `scripts/setup-android-windows.ps1` | SDK path helper |
| `scripts/build-android-local.ps1` | typecheck + test + prebuild + Gradle APK |
| `scripts/install-apk.ps1` | `adb install -r` + launch `com.nkt.app` |
| `scripts/device-logcat.ps1` | Filtered logcat |
| `scripts/run-device-test.ps1` | Full pipeline orchestrator |

### Quick start (device connected)

```powershell
cd C:\Users\salih\Desktop\NKT
powershell -ExecutionPolicy Bypass -File scripts/run-device-test.ps1
```

Or step by step:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/use-vps-local.ps1
powershell -ExecutionPolicy Bypass -File scripts/build-android-local.ps1
powershell -ExecutionPolicy Bypass -File scripts/install-apk.ps1
```

---

## 3. Mobile VPS Environment

`.env.vps.example` / `.env.local`:

```
EXPO_PUBLIC_USE_MOCK_API=false
EXPO_PUBLIC_USE_MOCK_REALTIME=false
EXPO_PUBLIC_API_URL=http://76.13.138.159
EXPO_PUBLIC_REALTIME_URL=http://76.13.138.159
EXPO_PUBLIC_ALLOW_CLEARTEXT=true
```

- Mock API/Realtime: **OFF**
- Cleartext HTTP: **ON** (required for Android → VPS IP without SSL)
- `app.config.ts`: `android.usesCleartextTraffic` when `EXPO_PUBLIC_ALLOW_CLEARTEXT=true`

---

## 4. VPS Connectivity (automated)

`scripts/check-vps.ps1` results:

| Check | Result |
|-------|--------|
| API /health | **PASS** |
| /health/ready | **PASS** |
| Socket.IO polling | **PASS** |
| Admin SPA | **PASS** |
| Admin logout | **FAIL** (HTTP 500 on live VPS — fix deployed in code, VPS needs update) |

---

## 5. APK Build

| Step | Result |
|------|--------|
| `npm run typecheck` | **PASS** |
| `npm test` (442 tests) | **PASS** |
| `npx expo prebuild --platform android` | **PASS** |
| `react-native-worklets` | **FIXED** (was missing) |
| `expo install --fix` | **DONE** (aligned expo-constants 57.x, reanimated 4.5.1) |
| `gradlew assembleDebug` | **FAIL** (expo-constants Kotlin; fixed after --fix, rebuild required) |
| Output target | `release/nkt-vps-test.apk` |

**Note:** First Gradle build downloads SDK components; may take 5–15 minutes.

---

## 6. Bugs Fixed (Phase 27)

### Admin logout HTTP 500

- **Root cause (suspected on VPS):** `writeAuditLog` failure during logout (audit table / requestId edge case); session delete happened after audit, causing 500 even when logout should succeed.
- **Fix:** Audit before session delete; catch audit errors with logging; session always deleted; `getRequestId()` fallback to `randomUUID()`.
- **Test:** `server/src/__tests__/admin-logout.test.ts` — **PASS** locally.
- **Live VPS:** Still **FAIL** until NKT API container is updated (no redeploy in this phase).

### Stage-1 difficulty mismatch

- **Root cause:** `pickContent()` fell back to **any** difficulty when category pool was exhausted, serving d2/d3 content in rounds 0–9.
- **Fix:** Removed wrong-difficulty fallback; retry same difficulty without exclude filter; throw `CONTENT_EXHAUSTED` if none.
- **Dataset audit:** `npm run test:content-difficulty` — all 20 categories **PASS** (100 per difficulty).

---

## 7. NOT RUN (requires physical device)

| Test | Status |
|------|--------|
| APK install | NOT RUN |
| App launch on device | NOT RUN |
| Mobile → VPS API | NOT RUN |
| Mobile → Socket.IO | NOT RUN |
| Room create/join | NOT RUN |
| 2+ player realtime | NOT RUN |
| 5 player | NOT RUN |
| Full game on device | NOT RUN |
| Reconnect / background / force-close | NOT RUN |
| Deep link on device | NOT RUN |
| Mobile UI QA | NOT RUN |
| Premium (store sandbox) | NOT RUN |
| Push | NOT CONFIGURED |

**Connected devices during test:** `adb devices` → empty list.

---

## 8. Real Device Matrix

```
DEVICE: (none connected)

API:           NOT RUN
SOCKET:        NOT RUN
LOGIN:         NOT RUN
ROOM CREATE:   NOT RUN
ROOM JOIN:     NOT RUN
LOBBY:         NOT RUN
GAME START:    NOT RUN
QUESTION:      NOT RUN
ANSWER:        NOT RUN
SCORE:         NOT RUN
RESULT:        NOT RUN
RECONNECT:     NOT RUN
BACKGROUND:    NOT RUN
DEEP LINK:     NOT RUN
UI:            NOT RUN
PREMIUM:       NOT RUN
```

Automated **Node 5-client** VPS test (Phase 26) ≠ mobile device test.

---

## 9. FILES CHANGED

| File | Change |
|------|--------|
| `scripts/check-android-env.ps1` | New |
| `scripts/check-android-device.ps1` | New |
| `scripts/check-vps.ps1` | New |
| `scripts/use-vps-local.ps1` | New |
| `scripts/setup-android-windows.ps1` | New |
| `scripts/build-android-local.ps1` | New |
| `scripts/install-apk.ps1` | New |
| `scripts/device-logcat.ps1` | New |
| `scripts/run-device-test.ps1` | New |
| `scripts/audit-content-difficulty.ts` | New |
| `.env.vps.example` | Cleartext flag |
| `app.config.ts` | `usesCleartextTraffic` |
| `server/src/admin/admin.routes.ts` | Logout fix |
| `server/src/admin/admin.service.ts` | Audit requestId fallback |
| `server/src/common/response.ts` | getRequestId fallback |
| `server/src/games/game.service.ts` | Difficulty pick fix |
| `server/src/__tests__/admin-logout.test.ts` | New test |
| `package.json` | `test:content-difficulty`, worklets dep |
| `.gitignore` | `release/*.apk` |

---

## 10. FINAL DECISION

```
FINAL DEVICE STATUS:     NOT READY (no device test)
MOBILE → VPS:            NOT READY (device required)
REAL MULTIPLAYER:        NOT READY (device required)
ADMIN:                   PARTIAL (logout fix in code, VPS pending deploy)
RELEASE:                 NOT READY

BLOCKERS:
- No physical Android device connected for live test
- APK build blocked until Gradle completes (worklets installed)
- VPS API needs redeploy for admin logout fix
- Premium / payment / push still NOT RUN
```

---

## 11. Next Steps (on your machine)

1. Connect Android phone (USB debugging ON) or start emulator
2. `powershell -ExecutionPolicy Bypass -File scripts/run-device-test.ps1`
3. Manual: Friends Mode → Create Room → test on 2nd device/emulator
4. Logs: `scripts/device-logcat.ps1`
5. When ready: redeploy NKT API to VPS for logout fix (no NNK changes)
