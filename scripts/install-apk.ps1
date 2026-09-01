# NKT — Install APK to connected Android device
# Usage: powershell -ExecutionPolicy Bypass -File scripts/install-apk.ps1 [-ApkPath release/nkt-vps-test.apk]

param(
  [string]$ApkPath = ''
)

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if (-not $ApkPath) { $ApkPath = Join-Path $Root 'release\nkt-vps-test.apk' }
if (-not (Test-Path $ApkPath)) {
  Write-Host "[FAIL] APK not found: $ApkPath" -ForegroundColor Red
  Write-Host 'Run scripts/build-android-local.ps1 first' -ForegroundColor Yellow
  exit 1
}

$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { $env:ANDROID_SDK_ROOT }
if ($sdk) { $env:PATH = "$(Join-Path $sdk 'platform-tools');$env:PATH" }

$devices = adb devices 2>&1 | Select-String '\tdevice$'
if (-not $devices) {
  Write-Host '[FAIL] No authorized device. Run scripts/check-android-device.ps1' -ForegroundColor Red
  exit 1
}

Write-Host "Installing $ApkPath ..." -ForegroundColor Cyan
adb install -r $ApkPath
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$Package = 'com.nkt.app'
Write-Host "Launching $Package ..." -ForegroundColor Cyan
adb shell monkey -p $Package -c android.intent.category.LAUNCHER 1 | Out-Null
Write-Host '[OK] Installed and launched' -ForegroundColor Green
