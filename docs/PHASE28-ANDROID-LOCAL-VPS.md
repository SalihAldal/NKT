# Phase 28 — Android Local Build + VPS (Emulator)

Date: 2026-09-01
VPS: `http://76.13.138.159`
Package: `com.nkt.app`

## Result Snapshot

- APK build: PASS
- APK install: PASS
- App launch: PASS
- Mock API/realtime: OFF (`.env.local`)
- Mobile process -> VPS TCP: PASS (`76.13.138.159:80` established)
- Room create flow: BLOCKED by UI automation reliability in emulator

## Error -> Root Cause -> Fix -> Retest

### 1) App redbox on startup (`Unable to load script`)

- ERROR: App opened with redbox and Metro bundle error.
- ROOT CAUSE: Debug APK was built without embedded JS bundle.
- FIX:
  - Added debug bundle generation in build flow (`:app:createBundleDebugJsAndAssets`).
  - Enabled bundled debug behavior via `debuggableVariants = []` in `android/app/build.gradle`.
- RETEST: PASS. App starts without redbox and renders splash UI.

### 2) Runtime crash (`crypto.getRandomValues() not supported`)

- ERROR: React Native runtime failed before app registration.
- ROOT CAUSE: `uuid` usage requires Web Crypto polyfill in React Native runtime.
- FIX:
  - Installed `react-native-get-random-values`.
  - Imported polyfill at app entry (`index.ts`).
- RETEST: PASS. `Running "main"` appears, crash removed.

### 3) Guest flow not creating authenticated realtime session

- ERROR: Lobby room-create path returned `Bağlantı hatası / Oda oluşturulamadı`.
- ROOT CAUSE: `authService.loginAsGuest()` produced only local guest user; no backend token existed for realtime/API protected flow.
- FIX:
  - Updated `src/services/auth.ts`:
    - In real API mode (`!env.useMockApi`), call `apiServices.auth.createGuestSession('Misafir')`.
    - Persist generated user to storage using backend response.
- RETEST:
  - App process has active VPS connection (`76.13.138.159:80`).
  - Room UI interaction is intermittently not triggered by emulator tap automation, so end-to-end room creation is pending stable UI action execution.

## Files Updated in Phase 28

- `index.ts`
- `src/services/auth.ts`
- `android/app/build.gradle`
- `scripts/build-android-local.ps1`
- `app.config.ts`
- `package.json`
- `package-lock.json`

