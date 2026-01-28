# AutoClaude Build Script
# Usage: .\build.ps1

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DistDir = Join-Path $ScriptDir "dist"
$InstallerDir = Join-Path $ScriptDir "installer"
$AssetsDir = Join-Path $InstallerDir "assets"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AutoClaude Build Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Create dist directory
if (-not (Test-Path $DistDir)) {
    New-Item -ItemType Directory -Path $DistDir -Force | Out-Null
    Write-Host "[OK] Created dist directory" -ForegroundColor Green
}

# Create assets directory
if (-not (Test-Path $AssetsDir)) {
    New-Item -ItemType Directory -Path $AssetsDir -Force | Out-Null
    Write-Host "[OK] Created assets directory" -ForegroundColor Green
}

# Check for icon file
$iconPath = Join-Path $AssetsDir "autoclaude.ico"
if (-not (Test-Path $iconPath)) {
    Write-Host "[WARN] Icon file not found: $iconPath" -ForegroundColor Yellow
    Write-Host "       Please add icon file and rebuild" -ForegroundColor Yellow
    Write-Host "       Or default icon will be used after install" -ForegroundColor Yellow
}

# Check for Inno Setup
$innoSetupPath = @(
    "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
    "${env:ProgramFiles}\Inno Setup 6\ISCC.exe",
    "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
    "C:\Program Files\Inno Setup 6\ISCC.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $innoSetupPath) {
    Write-Host "[ERROR] Inno Setup 6 not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please download and install Inno Setup 6 from:" -ForegroundColor Yellow
    Write-Host "https://jrsoftware.org/isdl.php" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

Write-Host "[OK] Found Inno Setup: $innoSetupPath" -ForegroundColor Green

# Compile installer
$issFile = Join-Path $InstallerDir "autoclaude.iss"
Write-Host ""
Write-Host "Compiling installer..." -ForegroundColor Cyan

& $innoSetupPath $issFile

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Build Successful!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Installer location:" -ForegroundColor Cyan
    Get-ChildItem -Path $DistDir -Filter "*.exe" | ForEach-Object {
        Write-Host "  $($_.FullName)" -ForegroundColor White
    }
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "[ERROR] Build failed, exit code: $LASTEXITCODE" -ForegroundColor Red
    exit 1
}
