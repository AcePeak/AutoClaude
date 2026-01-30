<#
.SYNOPSIS
    AutoClaude Uninstaller
.DESCRIPTION
    One-line uninstall: irm https://raw.githubusercontent.com/user/autoclaude/main/uninstall.ps1 | iex
.PARAMETER NoPrompt
    Skip all interactive prompts (remove everything)
.PARAMETER KeepConfig
    Keep configuration and logs
#>
param(
    [switch]$NoPrompt,
    [switch]$KeepConfig
)

$ErrorActionPreference = "Stop"
$InstallDir = "$env:LOCALAPPDATA\Programs\AutoClaude"
$AppDataDir = "$env:APPDATA\AutoClaude"

$Interactive = [Environment]::UserInteractive -and -not $NoPrompt

function Write-Step {
    param([string]$Message)
    Write-Host "  [*] " -NoNewline -ForegroundColor Yellow
    Write-Host $Message
}

function Write-Ok {
    param([string]$Message)
    Write-Host "  [+] " -NoNewline -ForegroundColor Green
    Write-Host $Message
}

function Ask-User {
    param(
        [string]$Question,
        [bool]$Default = $false
    )
    if (-not $Interactive) {
        return $Default
    }
    $defaultText = if ($Default) { "Y/n" } else { "y/N" }
    $response = Read-Host "  $Question ($defaultText)"
    if ([string]::IsNullOrWhiteSpace($response)) {
        return $Default
    }
    return ($response -eq "y" -or $response -eq "Y")
}

Write-Host ""
Write-Host "  +---------------------------------------+" -ForegroundColor Yellow
Write-Host "  |     AutoClaude Uninstaller           |" -ForegroundColor Yellow
Write-Host "  +---------------------------------------+" -ForegroundColor Yellow
Write-Host ""

# Confirm
if ($Interactive) {
    if (-not (Ask-User "Uninstall AutoClaude?" $false)) {
        Write-Host "  Cancelled." -ForegroundColor Yellow
        exit 0
    }
}

# Step 1: Stop AutoClaude
Write-Step "Stopping AutoClaude..."
Get-Process -Name "AutoClaude" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# Step 2: Remove context menus
Write-Step "Removing context menus..."
$menus = @(
    "HKCU\Software\Classes\Directory\Background\shell\AutoClaudeInit",
    "HKCU\Software\Classes\Directory\shell\AutoClaudeInit",
    "HKCU\Software\Classes\Directory\Background\shell\AutoClaudeOpen",
    "HKCU\Software\Classes\Directory\shell\AutoClaudeOpen",
    "HKCU\Software\Classes\Directory\Background\shell\AutoClaudeDashboard",
    "HKCU\Software\Classes\Directory\shell\AutoClaudeDashboard"
)
foreach ($menu in $menus) {
    reg delete $menu /f 2>$null | Out-Null
}
Write-Ok "Context menus removed"

# Step 3: Remove shortcuts
Write-Step "Removing shortcuts..."
Remove-Item "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\AutoClaude.lnk" -Force -ErrorAction SilentlyContinue
Remove-Item "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\AutoClaude.lnk" -Force -ErrorAction SilentlyContinue
Write-Ok "Shortcuts removed"

# Step 4: Remove installation
Write-Step "Removing program files..."
if (Test-Path $InstallDir) {
    Remove-Item -Path $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
}
Write-Ok "Program files removed"

# Step 5: Config
if (-not $KeepConfig) {
    $removeData = $NoPrompt -or (Ask-User "Remove config and logs?" $false)
    if ($removeData) {
        Write-Step "Removing configuration..."
        if (Test-Path $AppDataDir) {
            Remove-Item -Path $AppDataDir -Recurse -Force -ErrorAction SilentlyContinue
        }
        Write-Ok "Configuration removed"
    } else {
        Write-Host "      Config kept: $AppDataDir" -ForegroundColor Gray
    }
}

# Done
Write-Host ""
Write-Host "  +---------------------------------------+" -ForegroundColor Green
Write-Host "  |     Uninstall Complete!              |" -ForegroundColor Green
Write-Host "  +---------------------------------------+" -ForegroundColor Green
Write-Host ""
Write-Host "  Project 'collaboration/' folders are preserved." -ForegroundColor Gray
Write-Host "  Reinstall: irm https://raw.githubusercontent.com/AcePeak/AutoClaude/main/install.ps1 | iex" -ForegroundColor DarkGray
Write-Host ""
