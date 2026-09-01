# NKT — Local Android debug APK build (Windows)
# Usage: powershell -ExecutionPolicy Bypass -File scripts/build-android-local.ps1
# Prerequisites: scripts/check-android-env.ps1, scripts/use-vps-local.ps1

param(
  [switch]$SkipPrebuild,
  [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host "`n=== NKT Android Build ===`n" -ForegroundColor Cyan

# Ensure VPS env
if (-not (Test-Path '.env.local')) {
  Write-Host '[INFO] .env.local missing — running use-vps-local.ps1' -ForegroundColor Yellow
  & (Join-Path $Root 'scripts\use-vps-local.ps1')
}

# Validate mock off
$envText = Get-Content '.env.local' -Raw
if ($envText -match 'EXPO_PUBLIC_USE_MOCK_API=true' -or $envText -match 'EXPO_PUBLIC_USE_MOCK_REALTIME=true') {
  Write-Host '[FAIL] Mock API/realtime enabled — aborting' -ForegroundColor Red
  exit 1
}

Write-Host '[1/5] TypeScript check...' -ForegroundColor Cyan
npm run typecheck
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host '[2/5] Unit tests...' -ForegroundColor Cyan
npm test
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if (-not $SkipPrebuild) {
  Write-Host '[3/5] Expo prebuild (android)...' -ForegroundColor Cyan
  npx expo prebuild --platform android --no-install
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} else {
  Write-Host '[3/5] Skipping prebuild' -ForegroundColor Yellow
}

if (-not (Test-Path 'android\gradlew.bat')) {
  Write-Host '[FAIL] android/gradlew.bat not found. Run without -SkipPrebuild' -ForegroundColor Red
  exit 1
}

# Force JS bundle into debug APK (default debug skips bundling → Metro required)
$gradleFile = Join-Path $Root 'android\app\build.gradle'
if (Test-Path $gradleFile) {
  $gradleText = Get-Content $gradleFile -Raw
  if ($gradleText -notmatch '(?m)^\s*debuggableVariants\s*=') {
    $gradleText = $gradleText -replace '(?m)^\s*// debuggableVariants = \["liteDebug", "prodDebug"\]', '    debuggableVariants = []'
    if ($gradleText -notmatch '(?m)^\s*debuggableVariants\s*=') {
      $gradleText = $gradleText -replace '(react \{)', "`$1`r`n    debuggableVariants = []"
    }
    Set-Content $gradleFile $gradleText -NoNewline
    Write-Host '[OK] Patched build.gradle debuggableVariants=[] (embed JS bundle)' -ForegroundColor Green
  }
}

# Export .env.local for Metro export:embed during Gradle
Get-Content '.env.local' | ForEach-Object {
  if ($_ -match '^\s*([^#=]+)=(.*)$') {
    $name = $Matches[1].Trim()
    $value = $Matches[2].Trim()
    Set-Item -Path "env:$name" -Value $value
  }
}

# HTTP VPS requires cleartext on Android 9+
$manifest = Join-Path $Root 'android\app\src\main\AndroidManifest.xml'
if ((Test-Path $manifest) -and ($envText -match 'EXPO_PUBLIC_ALLOW_CLEARTEXT=true')) {
  $xml = Get-Content $manifest -Raw
  if ($xml -notmatch 'usesCleartextTraffic') {
    $xml = $xml -replace '<application ', '<application android:usesCleartextTraffic="true" '
    Set-Content $manifest $xml -NoNewline
    Write-Host '[OK] Patched AndroidManifest usesCleartextTraffic=true' -ForegroundColor Green
  }
}

Write-Host '[4/5] Gradle assembleDebug...' -ForegroundColor Cyan
$env:NODE_ENV = 'development'
Push-Location android
.\gradlew.bat assembleDebug --no-daemon
$gradleExit = $LASTEXITCODE
Pop-Location
if ($gradleExit -ne 0) { exit $gradleExit }

$apkSrc = Get-ChildItem -Path 'android\app\build\outputs\apk\debug' -Filter '*.apk' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $apkSrc) {
  Write-Host '[FAIL] APK not found under android/app/build/outputs/apk/debug' -ForegroundColor Red
  exit 1
}

$releaseDir = Join-Path $Root 'release'
if (-not (Test-Path $releaseDir)) { New-Item -ItemType Directory -Path $releaseDir | Out-Null }
$apkDest = Join-Path $releaseDir 'nkt-vps-test.apk'
Copy-Item $apkSrc.FullName $apkDest -Force
Write-Host "[OK] APK: $apkDest ($([math]::Round($apkSrc.Length/1MB, 2)) MB)" -ForegroundColor Green

Write-Host '[5/5] APK verification' -ForegroundColor Cyan
Write-Host "  Package: com.nkt.app"
Write-Host "  API URL: $(if ($envText -match 'EXPO_PUBLIC_API_URL=(.+)') { $Matches[1].Trim() } else { '?' })"

if (-not $SkipInstall) {
  $devices = adb devices 2>&1 | Select-String 'device$'
  if ($devices) {
    Write-Host '[INFO] Installing to device...' -ForegroundColor Cyan
    & (Join-Path $Root 'scripts\install-apk.ps1') -ApkPath $apkDest
  } else {
    Write-Host '[SKIP] No device connected — install manually with scripts/install-apk.ps1' -ForegroundColor Yellow
  }
}

Write-Host "`nBuild complete." -ForegroundColor Green
