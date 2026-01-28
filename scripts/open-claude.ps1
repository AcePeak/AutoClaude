# AutoClaude - Open Claude in Directory
# Usage: open-claude.ps1 [-Path <directory_path>]

param(
    [Parameter(Position=0)]
    [string]$Path = (Get-Location).Path
)

$ErrorActionPreference = "Stop"

# Get absolute path
$Path = [System.IO.Path]::GetFullPath($Path)

# Check if directory exists
if (-not (Test-Path $Path)) {
    Write-Host "[ERROR] Directory does not exist: $Path" -ForegroundColor Red
    exit 1
}

# Check if claude command is available
$claudePath = Get-Command "claude" -ErrorAction SilentlyContinue
if (-not $claudePath) {
    Write-Host "[ERROR] claude command not found, please ensure Claude CLI is installed" -ForegroundColor Red
    Write-Host "Installation: npm install -g @anthropic-ai/claude-code" -ForegroundColor Yellow
    exit 1
}

# Switch to target directory and start Claude
Write-Host "[INFO] Opening Claude in directory: $Path" -ForegroundColor Cyan

# Command to run
$command = "cd `"$Path`" && claude"

# Use Start-Process to open in new window
Start-Process -FilePath "cmd.exe" -ArgumentList "/k", $command -WorkingDirectory $Path

Write-Host "[OK] Claude started in new window" -ForegroundColor Green
