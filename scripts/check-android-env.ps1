# NKT — Android development environment check (Windows)
# Usage: powershell -ExecutionPolicy Bypass -File scripts/check-android-env.ps1

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$results = @()

function Report([string]$Name, [string]$Status, [string]$Detail = '') {
  $script:results += [pscustomobject]@{ Name = $Name; Status = $Status; Detail = $Detail }
  $color = switch ($Status) { 'PASS' { 'Green' } 'FAIL' { 'Red' } default { 'Yellow' } }
  Write-Host ("[{0}] {1}" -f $Status, $Name) -ForegroundColor $color
  if ($Detail) { Write-Host "       $Detail" -ForegroundColor DarkGray }
}

Write-Host "`n=== NKT Android Environment Check ===`n" -ForegroundColor Cyan

# Node
try {
  $nodeV = (node --version 2>$null).Trim()
  if ($nodeV) { Report 'Node.js' 'PASS' $nodeV } else { Report 'Node.js' 'FAIL' 'not found' }
} catch { Report 'Node.js' 'FAIL' $_.Exception.Message }

# npm
try {
  $npmV = (npm --version 2>$null).Trim()
  if ($npmV) { Report 'npm' 'PASS' $npmV } else { Report 'npm' 'FAIL' 'not found' }
} catch { Report 'npm' 'FAIL' $_.Exception.Message }

# npx
try {
  $npxV = (npx --version 2>$null).Trim()
  if ($npxV) { Report 'npx' 'PASS' $npxV } else { Report 'npx' 'WARNING' 'not found' }
} catch { Report 'npx' 'WARNING' $_.Exception.Message }

# Java
try {
  $javaOut = (java -version 2>&1 | Out-String).Trim()
  if ($javaOut -match 'version') { Report 'Java/JDK' 'PASS' ($javaOut -split "`n")[0] } else { Report 'Java/JDK' 'FAIL' 'not found' }
} catch { Report 'Java/JDK' 'FAIL' 'Install JDK 17: https://adoptium.net/' }

# Android SDK
$sdk = $env:ANDROID_HOME
if (-not $sdk) { $sdk = $env:ANDROID_SDK_ROOT }
if ($sdk -and (Test-Path $sdk)) {
  Report 'Android SDK' 'PASS' $sdk
} else {
  Report 'Android SDK' 'FAIL' 'Set ANDROID_HOME or ANDROID_SDK_ROOT (e.g. D:\Android\Sdk)'
}

# adb
$adb = Get-Command adb -ErrorAction SilentlyContinue
if ($adb) {
  $adbV = (adb version 2>&1 | Select-Object -First 1)
  Report 'adb' 'PASS' $adbV
} else {
  $adbPath = Join-Path $sdk 'platform-tools\adb.exe'
  if ($sdk -and (Test-Path $adbPath)) {
    Report 'adb' 'PASS' $adbPath
    $env:PATH = "$(Split-Path $adbPath);$env:PATH"
  } else {
    Report 'adb' 'FAIL' 'Install Android SDK Platform-Tools'
  }
}

# emulator
$emu = Get-Command emulator -ErrorAction SilentlyContinue
if ($emu) { Report 'emulator' 'PASS' $emu.Source } else { Report 'emulator' 'WARNING' 'optional — physical device OK' }

# Gradle / gradlew
$gradlew = Join-Path $Root 'android\gradlew.bat'
if (Test-Path $gradlew) {
  Report 'Gradle (gradlew)' 'PASS' $gradlew
} else {
  Report 'Gradle (gradlew)' 'WARNING' 'Run: npx expo prebuild --platform android'
}

# Expo project
if (Test-Path (Join-Path $Root 'package.json')) {
  Report 'Expo project' 'PASS' $Root
} else {
  Report 'Expo project' 'FAIL' 'package.json not found'
}

# Mock config check
$envLocal = Join-Path $Root '.env.local'
if (Test-Path $envLocal) {
  $envText = Get-Content $envLocal -Raw
  $mockApi = if ($envText -match 'EXPO_PUBLIC_USE_MOCK_API=true') { 'ON' } else { 'OFF' }
  $mockRt = if ($envText -match 'EXPO_PUBLIC_USE_MOCK_REALTIME=true') { 'ON' } else { 'OFF' }
  if ($mockApi -eq 'ON' -or $mockRt -eq 'ON') {
    Report 'Mock disabled (.env.local)' 'FAIL' "mock API=$mockApi realtime=$mockRt - run scripts/use-vps-local.ps1"
  } else {
    Report 'Mock disabled (.env.local)' 'PASS' 'mock API=OFF realtime=OFF'
  }
  if ($envText -match 'EXPO_PUBLIC_ALLOW_CLEARTEXT=true') {
    Report 'Cleartext HTTP (VPS)' 'PASS' 'EXPO_PUBLIC_ALLOW_CLEARTEXT=true'
  } else {
    Report 'Cleartext HTTP (VPS)' 'WARNING' 'Add EXPO_PUBLIC_ALLOW_CLEARTEXT=true for HTTP VPS'
  }
} else {
  Report 'Mock disabled (.env.local)' 'WARNING' '.env.local missing - run scripts/use-vps-local.ps1'
}

# Connected devices
try {
  $devices = adb devices 2>&1 | Select-Object -Skip 1 | Where-Object { $_ -match '\S' }
  if ($devices -match 'device$') {
    Report 'Connected device' 'PASS' ($devices -join '; ')
  } elseif ($devices -match 'unauthorized') {
    Report 'Connected device' 'WARNING' 'device unauthorized - accept USB debugging on phone'
  } else {
    Report 'Connected device' 'WARNING' 'no device - connect phone or start emulator'
  }
} catch {
  Report 'Connected device' 'WARNING' 'adb devices failed'
}

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
$results | Format-Table -AutoSize
$fail = ($results | Where-Object Status -eq 'FAIL').Count
if ($fail -gt 0) { exit 1 }
exit 0
