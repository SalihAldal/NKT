# NKT — Filtered logcat for com.nkt.app (no secrets)
# Usage: powershell -ExecutionPolicy Bypass -File scripts/device-logcat.ps1
# Press Ctrl+C to stop

$Package = 'com.nkt.app'
$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { $env:ANDROID_SDK_ROOT }
if ($sdk) { $env:PATH = "$(Join-Path $sdk 'platform-tools');$env:PATH" }

Write-Host "Logcat for $Package (Ctrl+C to stop)`n" -ForegroundColor Cyan
adb logcat -c
adb logcat --pid=$(adb shell pidof -s $Package 2>$null) 2>$null
if ($LASTEXITCODE -ne 0) {
  # Fallback: tag filter
  adb logcat ReactNative:V ReactNativeJS:V ExpoModules:V '*:S'
}
