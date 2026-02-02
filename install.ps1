<#
.SYNOPSIS
    AutoClaude Installer
.DESCRIPTION
    One-line install: irm https://raw.githubusercontent.com/user/autoclaude/main/install.ps1 | iex
    Or with options: & ([scriptblock]::Create((irm https://.../install.ps1))) -NoPrompt -StartOnLogin
.PARAMETER NoPrompt
    Skip all interactive prompts (use defaults)
.PARAMETER StartOnLogin
    Add AutoClaude to Windows startup
.PARAMETER NoStart
    Don't start AutoClaude after installation
#>
param(
    [switch]$NoPrompt,
    [switch]$StartOnLogin,
    [switch]$NoStart
)

$ErrorActionPreference = "Stop"
$InstallDir = "$env:LOCALAPPDATA\Programs\AutoClaude"
$AppDataDir = "$env:APPDATA\AutoClaude"
$TempDir = "$env:TEMP\autoclaude-install"

# GitHub 配置
$RepoOwner = "AcePeak"
$RepoName = "AutoClaude"

# 从 artifacts 分支下载（由 GitHub Actions 自动构建）
$BaseUrl = "https://raw.githubusercontent.com/$RepoOwner/$RepoName/artifacts"
$DownloadUrl = "$BaseUrl/AutoClaude-latest.zip"
$VersionUrl = "$BaseUrl/VERSION"

# 检测脚本所在目录（用于本地测试回退）
$ScriptDir = $null
if ($PSScriptRoot) {
    $ScriptDir = $PSScriptRoot
} elseif ($MyInvocation.MyCommand.Path) {
    $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
} else {
    $ScriptDir = (Get-Location).Path
}

# 获取最新版本号
$Version = "latest"
try {
    $Version = (Invoke-WebRequest -Uri $VersionUrl -UseBasicParsing -TimeoutSec 5).Content.Trim()
} catch {
    # 尝试从本地 package.json 读取版本
    if ($ScriptDir) {
        $localPkg = Join-Path $ScriptDir "package.json"
        if (Test-Path $localPkg) {
            $Version = (Get-Content $localPkg | ConvertFrom-Json).version
        }
    }
}

# Detect if running interactively
$Interactive = [Environment]::UserInteractive -and -not $NoPrompt

function Write-Banner {
    Write-Host ""
    Write-Host "  +---------------------------------------+" -ForegroundColor Cyan
    Write-Host "  |     AutoClaude Installer v$Version      |" -ForegroundColor Cyan
    Write-Host "  +---------------------------------------+" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step {
    param([string]$Message)
    Write-Host "  [*] " -NoNewline -ForegroundColor Green
    Write-Host $Message
}

function Write-Warn {
    param([string]$Message)
    Write-Host "  [!] " -NoNewline -ForegroundColor Yellow
    Write-Host $Message
}

function Write-Err {
    param([string]$Message)
    Write-Host "  [X] " -NoNewline -ForegroundColor Red
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
        [bool]$Default = $true
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

Write-Banner

# Step 1: Check prerequisites
Write-Step "Checking prerequisites..."

$claudeExists = Get-Command claude -ErrorAction SilentlyContinue
if (-not $claudeExists) {
    Write-Host ""
    Write-Warn "Claude CLI not found in PATH"
    Write-Host "      AutoClaude requires Claude CLI to function." -ForegroundColor Gray
    Write-Host "      Install from: https://claude.ai/download" -ForegroundColor Gray
    Write-Host ""
    if ($Interactive) {
        if (-not (Ask-User "Continue anyway?" $false)) {
            Write-Host "  Installation cancelled." -ForegroundColor Yellow
            exit 0
        }
    }
}

# Step 2: Stop existing AutoClaude
Write-Step "Stopping existing AutoClaude processes..."
Get-Process -Name "AutoClaude" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# Step 3: Create directories
Write-Step "Creating directories..."
New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
New-Item -ItemType Directory -Path $AppDataDir -Force | Out-Null
New-Item -ItemType Directory -Path $TempDir -Force | Out-Null

# Step 4: Download
Write-Step "Downloading AutoClaude v$Version..."
$zipPath = "$TempDir\autoclaude.zip"

$downloaded = $false
try {
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $zipPath -UseBasicParsing -TimeoutSec 30
    Write-Ok "Downloaded from GitHub"
    $downloaded = $true
} catch {
    # Fallback: check for local build
    if ($ScriptDir) {
        $distDir = Join-Path $ScriptDir "dist-electron"
        if (Test-Path $distDir) {
            # 查找本地构建的 zip
            $localZip = Get-ChildItem "$distDir\*portable*.zip" -ErrorAction SilentlyContinue |
                        Sort-Object LastWriteTime -Descending |
                        Select-Object -First 1

            if ($localZip) {
                Write-Warn "Using local build: $($localZip.Name)"
                Copy-Item $localZip.FullName $zipPath
                $downloaded = $true
            }
        }
    }

    if (-not $downloaded) {
        Write-Err "Download failed - artifacts branch may not exist yet"
        Write-Host ""
        Write-Host "  If this is first install, push code to GitHub first:" -ForegroundColor Yellow
        Write-Host "    git push" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  Or run local build:" -ForegroundColor Yellow
        Write-Host "    npm run build:portable" -ForegroundColor Cyan
        exit 1
    }
}

# Step 5: Extract
Write-Step "Extracting files..."
Expand-Archive -Path $zipPath -DestinationPath $InstallDir -Force
Write-Ok "Extracted to $InstallDir"

# Step 6: Register context menus
Write-Step "Registering context menus..."

$exePath = "$InstallDir\AutoClaude.exe"
$iconPath = "$InstallDir\resources\assets\icon.ico"
$actionsPath = "$InstallDir\resources\src\actions"

# Find Node.js executable
$nodePath = "node"
try {
    $nodePath = (Get-Command node -ErrorAction Stop).Source
} catch {
    Write-Warn "Node.js not found in PATH, using 'node' command"
}

# Helper to add context menu
function Add-ContextMenu {
    param(
        [string]$Name,
        [string]$Label,
        [string]$Script,
        [string]$PathVar  # %V or %1
    )
    $bgKey = "HKCU\Software\Classes\Directory\Background\shell\$Name"
    $dirKey = "HKCU\Software\Classes\Directory\shell\$Name"
    $cmd = "`"$nodePath`" `"$Script`" --path `"$PathVar`""

    # Background (right-click in folder)
    reg add $bgKey /ve /d $Label /f 2>$null | Out-Null
    reg add $bgKey /v "Icon" /d $iconPath /f 2>$null | Out-Null
    reg add "$bgKey\command" /ve /d $cmd /f 2>$null | Out-Null

    # Directory (right-click on folder)
    $cmd2 = $cmd -replace '%V', '%1'
    reg add $dirKey /ve /d $Label /f 2>$null | Out-Null
    reg add $dirKey /v "Icon" /d $iconPath /f 2>$null | Out-Null
    reg add "$dirKey\command" /ve /d $cmd2 /f 2>$null | Out-Null
}

Add-ContextMenu "AutoClaudeInit" "Initialize AutoClaude Project" "$actionsPath\init-project.js" "%V"
Add-ContextMenu "AutoClaudeOpen" "Open Claude" "$actionsPath\open-claude.js" "%V"
Add-ContextMenu "AutoClaudeDashboard" "View AutoClaude Dashboard" "$actionsPath\view-dashboard.js" "%V"

Write-Ok "Context menus registered"

# Step 7: Create Start Menu shortcut
Write-Step "Creating Start Menu shortcut..."
$startMenuPath = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\AutoClaude.lnk"
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($startMenuPath)
$shortcut.TargetPath = $exePath
$shortcut.WorkingDirectory = $InstallDir
$shortcut.Description = "AutoClaude - AI-powered continuous development"
$shortcut.Save()
Write-Ok "Start Menu shortcut created"

# Step 8: Optional - Add to startup
$addStartup = $StartOnLogin -or (Ask-User "Start AutoClaude on login?" $true)
if ($addStartup) {
    Write-Step "Adding to startup..."
    $startupPath = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\AutoClaude.lnk"
    $shortcut = $shell.CreateShortcut($startupPath)
    $shortcut.TargetPath = $exePath
    $shortcut.WorkingDirectory = $InstallDir
    $shortcut.Arguments = "--minimized"
    $shortcut.Save()
    Write-Ok "Added to startup"
}

# Step 9: Cleanup
Write-Step "Cleaning up..."
Remove-Item -Path $TempDir -Recurse -Force -ErrorAction SilentlyContinue

# Step 10: Start AutoClaude
if (-not $NoStart) {
    $startNow = Ask-User "Start AutoClaude now?" $true
    if ($startNow) {
        Write-Step "Starting AutoClaude..."
        Start-Process -FilePath $exePath
        Write-Ok "AutoClaude started"
    }
}

# Done
Write-Host ""
Write-Host "  +---------------------------------------+" -ForegroundColor Green
Write-Host "  |     Installation Complete!           |" -ForegroundColor Green
Write-Host "  +---------------------------------------+" -ForegroundColor Green
Write-Host ""
Write-Host "  Installed to: $InstallDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Usage:" -ForegroundColor White
Write-Host "    - Right-click folder > 'Initialize AutoClaude Project'" -ForegroundColor Gray
Write-Host "    - Right-click folder > 'Open Claude'" -ForegroundColor Gray
Write-Host "    - Tell Claude: 'continuous task' or '不间断任务'" -ForegroundColor Gray
Write-Host ""
Write-Host "  Uninstall: irm https://raw.githubusercontent.com/AcePeak/AutoClaude/main/uninstall.ps1 | iex" -ForegroundColor DarkGray
Write-Host ""
