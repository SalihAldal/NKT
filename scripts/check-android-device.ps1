# NKT — List connected Android devices via adb
# Usage: powershell -ExecutionPolicy Bypass -File scripts/check-android-device.ps1

$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { $env:ANDROID_SDK_ROOT }
if ($sdk) {
  $adbPath = Join-Path $sdk 'platform-tools'
  if (Test-Path $adbPath) { $env:PATH = "$adbPath;$env:PATH" }
}

Write-Host "`n=== ADB Devices ===`n" -ForegroundColor Cyan

if (-not (Get-Command adb -ErrorAction SilentlyContinue)) {
  Write-Host '[FAIL] adb not found. Run scripts/check-android-env.ps1' -ForegroundColor Red
  exit 1
}

$raw = adb devices 2>&1
Write-Host $raw

$lines = $raw | Where-Object { $_ -match '\t' }
$authorized = @()
$unauthorized = @()
$offline = @()

foreach ($line in $lines) {
  if ($line -match '^(\S+)\s+device$') { $authorized += $Matches[1] }
  elseif ($line -match '^(\S+)\s+unauthorized$') { $unauthorized += $Matches[1] }
  elseif ($line -match '^(\S+)\s+offline$') { $offline += $Matches[1] }
}

Write-Host "`n--- Summary ---" -ForegroundColor Cyan
Write-Host "Authorized: $($authorized.Count)" -ForegroundColor Green
foreach ($d in $authorized) { Write-Host "  [device] $d" }

if ($unauthorized.Count) {
  Write-Host "Unauthorized: $($unauthorized.Count)" -ForegroundColor Yellow
  foreach ($d in $unauthorized) { Write-Host "  [unauthorized] $d — accept RSA prompt on phone" }
}

if ($offline.Count) {
  Write-Host "Offline: $($offline.Count)" -ForegroundColor Yellow
  foreach ($d in $offline) { Write-Host "  [offline] $d" }
}

if ($authorized.Count -eq 0) { exit 1 }
exit 0
