# AutoClaude - View Dashboard Script
# Usage: view-dashboard.ps1 [-Path <directory_path>]

param(
    [Parameter(Position=0)]
    [string]$Path = (Get-Location).Path
)

$ErrorActionPreference = "Stop"

# Get absolute path
$Path = [System.IO.Path]::GetFullPath($Path)

# Check if this is an AutoClaude project
$CollabDir = Join-Path $Path "collaboration"
if (-not (Test-Path $CollabDir)) {
    [System.Windows.Forms.MessageBox]::Show(
        "This directory is not an AutoClaude project.`n`nPlease initialize it first using 'Initialize AutoClaude Project' from the context menu.",
        "AutoClaude",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Warning
    )
    exit 1
}

# Generate/update dashboard
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$GenerateScript = Join-Path $ScriptDir "generate-dashboard.ps1"

if (Test-Path $GenerateScript) {
    try {
        & powershell -ExecutionPolicy Bypass -File $GenerateScript -ProjectPath $Path 2>&1 | Out-Null
    } catch {
        # Ignore errors, dashboard may still exist
    }
}

# Open dashboard in default browser
$DashboardPath = Join-Path $CollabDir "dashboard.html"

if (Test-Path $DashboardPath) {
    Start-Process $DashboardPath
} else {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show(
        "Dashboard file not found.`n`nPlease wait for the watcher to generate it, or check if the project is properly initialized.",
        "AutoClaude",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Warning
    )
    exit 1
}
