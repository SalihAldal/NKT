# NKT — Android SDK path helper for Windows (interactive)
# Sets ANDROID_HOME for current session and prints persistent setup instructions.

param(
  [string]$SdkPath = 'D:\Android\Sdk'
)

Write-Host "`n=== NKT Android SDK Setup (Windows) ===`n" -ForegroundColor Cyan

if (-not (Test-Path $SdkPath)) {
  Write-Host "[FAIL] SDK path not found: $SdkPath" -ForegroundColor Red
  Write-Host @"

Install Android Studio: https://developer.android.com/studio
Then set SdkPath to your SDK location, e.g.:
  `$env:LOCALAPPDATA\Android\Sdk
  D:\Android\Sdk

"@ -ForegroundColor Yellow
  exit 1
}

$env:ANDROID_HOME = $SdkPath
$env:ANDROID_SDK_ROOT = $SdkPath
$platformTools = Join-Path $SdkPath 'platform-tools'
$env:PATH = "$platformTools;$env:PATH"

Write-Host "[OK] ANDROID_HOME=$SdkPath" -ForegroundColor Green
Write-Host "[OK] adb: $(adb version 2>&1 | Select-Object -First 1)" -ForegroundColor Green

Write-Host @"

To persist (PowerShell profile or System Environment Variables):
  ANDROID_HOME = $SdkPath
  ANDROID_SDK_ROOT = $SdkPath
  PATH += $platformTools

Install SDK components (Android Studio SDK Manager):
  - Android SDK Platform 35 (or project target)
  - Android SDK Build-Tools
  - Android SDK Platform-Tools

Then run:
  scripts\check-android-env.ps1
  scripts\use-vps-local.ps1
  scripts\build-android-local.ps1

"@ -ForegroundColor Cyan
