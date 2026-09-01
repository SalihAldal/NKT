# NKT — Android + VPS device test orchestrator
# Usage: powershell -ExecutionPolicy Bypass -File scripts/run-device-test.ps1

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host "`n=== NKT Device Test Pipeline ===`n" -ForegroundColor Cyan

$steps = @(
  @{ Name = 'Android env'; Script = 'check-android-env.ps1' },
  @{ Name = 'VPS reachability'; Script = 'check-vps.ps1' },
  @{ Name = 'Android devices'; Script = 'check-android-device.ps1' },
  @{ Name = 'VPS env'; Script = 'use-vps-local.ps1' }
)

foreach ($step in $steps) {
  Write-Host "--- $($step.Name) ---" -ForegroundColor Cyan
  & (Join-Path $Root "scripts\$($step.Script)")
  if ($LASTEXITCODE -ne 0 -and $step.Script -ne 'check-android-device.ps1') {
    Write-Host "[STOP] $($step.Name) failed" -ForegroundColor Red
    exit $LASTEXITCODE
  }
}

$hasDevice = adb devices 2>&1 | Select-String '\tdevice$'
if ($hasDevice) {
  Write-Host "--- Build & install ---" -ForegroundColor Cyan
  & (Join-Path $Root 'scripts\build-android-local.ps1')
} else {
  Write-Host "[SKIP] Build/install — no device connected" -ForegroundColor Yellow
  Write-Host "Connect phone (USB debugging) then re-run this script" -ForegroundColor Yellow
}

Write-Host "`nManual device tests (not automated):" -ForegroundColor Yellow
Write-Host "  - Login / guest / home / profile"
Write-Host "  - Friends Mode -> Create Room -> Join (2nd device)"
Write-Host "  - Socket connected indicator in lobby"
Write-Host "  - Full game flow"
Write-Host "  - Reconnect (toggle airplane mode)"
Write-Host "`nLogs: scripts/device-logcat.ps1" -ForegroundColor Cyan
