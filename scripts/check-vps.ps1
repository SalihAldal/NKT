# NKT - VPS connectivity check (HTTP + IP)
# Usage: powershell -ExecutionPolicy Bypass -File scripts/check-vps.ps1

param(
  [string]$VpsUrl = $(if ($env:VPS_URL) { $env:VPS_URL } else { 'http://76.13.138.159' })
)

$VpsUrl = $VpsUrl.TrimEnd('/')
$ErrorActionPreference = 'Continue'

function Test-Endpoint([string]$Name, [string]$Url, [scriptblock]$Validate) {
  try {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 15
    $sw.Stop()
    $ok = & $Validate $r
    if ($ok) {
      Write-Host "[PASS] $Name ($([int]$sw.ElapsedMilliseconds)ms)" -ForegroundColor Green
      return $true
    }
    Write-Host "[FAIL] $Name - unexpected response" -ForegroundColor Red
    return $false
  } catch {
    Write-Host "[FAIL] $Name - $($_.Exception.Message)" -ForegroundColor Red
    return $false
  }
}

Write-Host "`n=== VPS Check: $VpsUrl ===`n" -ForegroundColor Cyan

$api = Test-Endpoint 'API /health' "$VpsUrl/health" {
  param($r)
  $j = $r.Content | ConvertFrom-Json
  $j.success -and $j.data.status -eq 'ok'
}

$ready = Test-Endpoint 'READY /health/ready' "$VpsUrl/health/ready" {
  param($r)
  $j = $r.Content | ConvertFrom-Json
  $j.data.ready -eq $true -and $j.data.checks.database -eq 'PASS'
}

$socket = Test-Endpoint 'REALTIME /socket.io polling' "$VpsUrl/socket.io/?EIO=4&transport=polling" {
  param($r) $r.StatusCode -eq 200
}

$admin = Test-Endpoint 'ADMIN SPA' "$VpsUrl/" {
  param($r) $r.StatusCode -eq 200
}

$adminPass = $env:ADMIN_PASSWORD
if ($adminPass) {
  try {
    $loginBody = @{ email = 'admin@nkt.local'; password = $adminPass } | ConvertTo-Json
    $login = Invoke-RestMethod -Uri "$VpsUrl/api/v1/admin/auth/login" -Method POST -Body $loginBody -ContentType 'application/json' -TimeoutSec 15
    $token = $login.data.token
    $logout = Invoke-WebRequest -Uri "$VpsUrl/api/v1/admin/auth/logout" -Method POST -Headers @{ Authorization = "Bearer $token" } -UseBasicParsing -TimeoutSec 15
    if ($logout.StatusCode -eq 200) {
      Write-Host '[PASS] ADMIN logout' -ForegroundColor Green
    } else {
      Write-Host "[FAIL] ADMIN logout - HTTP $($logout.StatusCode)" -ForegroundColor Red
    }
  } catch {
    Write-Host "[FAIL] ADMIN logout - $($_.Exception.Message)" -ForegroundColor Red
  }
} else {
  Write-Host '[SKIP] ADMIN logout - set ADMIN_PASSWORD env to test' -ForegroundColor Yellow
}

if ($api -and $ready -and $socket -and $admin) { exit 0 }
exit 1
