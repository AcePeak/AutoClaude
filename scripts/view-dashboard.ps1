# AutoClaude - View Dashboard Script
# Usage: view-dashboard.ps1 [-Path <directory_path>]

param(
    [Parameter(Position=0)]
    [string]$Path = (Get-Location).Path
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms

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

$DashboardPath = Join-Path $CollabDir "dashboard.html"

if (Test-Path $GenerateScript) {
    try {
        # Run synchronously and wait for completion
        $result = & powershell -ExecutionPolicy Bypass -File $GenerateScript -ProjectPath $Path 2>&1
        Write-Host $result
    } catch {
        Write-Host "Warning: Could not generate dashboard: $_"
    }
}

# Open dashboard in default browser
if (Test-Path $DashboardPath) {
    Start-Process $DashboardPath
} else {
    [System.Windows.Forms.MessageBox]::Show(
        "Dashboard generation failed.`n`nError details may be in the console output.",
        "AutoClaude",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Warning
    )
    exit 1
}
