# NKT — Switch mobile env to live VPS (backs up existing .env.local)
# Usage: powershell -ExecutionPolicy Bypass -File scripts/use-vps-local.ps1

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Source = Join-Path $Root '.env.vps.example'
$Target = Join-Path $Root '.env.local'

if (-not (Test-Path $Source)) {
  Write-Host "[FAIL] Missing $Source" -ForegroundColor Red
  exit 1
}

if (Test-Path $Target) {
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $backup = Join-Path $Root ".env.local.backup-$stamp"
  Copy-Item $Target $backup -Force
  Write-Host "[OK] Backed up existing .env.local -> $backup" -ForegroundColor Yellow
}

Copy-Item $Source $Target -Force
Write-Host "[OK] Wrote $Target from .env.vps.example" -ForegroundColor Green

$content = Get-Content $Target -Raw
if ($content -match 'EXPO_PUBLIC_USE_MOCK_API=true' -or $content -match 'EXPO_PUBLIC_USE_MOCK_REALTIME=true') {
  Write-Host '[FAIL] Mock flags still enabled in template!' -ForegroundColor Red
  exit 1
}

Write-Host "`nVPS config active:" -ForegroundColor Cyan
Get-Content $Target | Where-Object { $_ -match 'EXPO_PUBLIC_' }
Write-Host "`nNext: npx expo start  OR  scripts/build-android-local.ps1" -ForegroundColor Cyan
