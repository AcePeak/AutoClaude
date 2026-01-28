# AutoClaude - Supervisor Script
# Usage: supervisor.ps1 -ProjectPath <path>

param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectPath
)

$ErrorActionPreference = "Stop"

# Configuration
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogDir = Join-Path $ProjectPath "collaboration\.autoclaude\logs"
$LogFile = Join-Path $LogDir "supervisor_$(Get-Date -Format 'yyyyMMdd').log"

# Ensure log directory exists
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

# Log function
function Write-Log {
    param(
        [string]$Message,
        [string]$Level = "INFO"
    )
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$Level] $Message"
    Add-Content -Path $LogFile -Value $logEntry -Encoding UTF8

    $color = switch ($Level) {
        "INFO" { "Cyan" }
        "OK" { "Green" }
        "WARN" { "Yellow" }
        "ERROR" { "Red" }
        default { "White" }
    }
    Write-Host $logEntry -ForegroundColor $color
}

# Get project path
$ProjectPath = [System.IO.Path]::GetFullPath($ProjectPath)
$CollabDir = Join-Path $ProjectPath "collaboration"

# Validate project
if (-not (Test-Path $CollabDir)) {
    Write-Log "Project not initialized: $ProjectPath" "ERROR"
    exit 1
}

Write-Log "Supervisor started: $ProjectPath" "INFO"

# Read config
$configFile = Join-Path $CollabDir ".autoclaude\config.json"
$config = @{
    claude_path = "claude"
    supervisor = @{
        prompt_template = "You are a Supervisor, please execute task management work according to SUPERVISOR_GUIDE.md."
    }
}

if (Test-Path $configFile) {
    try {
        $config = Get-Content $configFile -Raw | ConvertFrom-Json
    } catch {
        Write-Log "Cannot read config file, using defaults" "WARN"
    }
}

# Build Supervisor prompt
$supervisorGuide = Join-Path $CollabDir "SUPERVISOR_GUIDE.md"
$inboxPath = Join-Path $CollabDir "inbox.md"
$queueDir = Join-Path $CollabDir "queue"
$executingDir = Join-Path $CollabDir "executing"

# Collect current status info
$statusInfo = @"
## Current Project Status

Project path: $ProjectPath
Check time: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

"@

# Check inbox
if (Test-Path $inboxPath) {
    $inboxContent = Get-Content $inboxPath -Raw -ErrorAction SilentlyContinue
    $statusInfo += @"
### Inbox Content
$inboxContent

"@
}

# Check queue
$queueTasks = @()
if (Test-Path $queueDir) {
    $queueFiles = Get-ChildItem -Path $queueDir -Filter "*.md" -ErrorAction SilentlyContinue
    foreach ($file in $queueFiles) {
        $queueTasks += $file.Name
    }
}
$statusInfo += "### Tasks in Queue ($($queueTasks.Count))`n"
foreach ($task in $queueTasks) {
    $statusInfo += "- $task`n"
}
$statusInfo += "`n"

# Check executing
$executingTasks = @()
if (Test-Path $executingDir) {
    $executingFiles = Get-ChildItem -Path $executingDir -Filter "*.md" -ErrorAction SilentlyContinue
    foreach ($file in $executingFiles) {
        $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
        $status = "UNKNOWN"
        if ($content -match "status:\s*(\w+)") {
            $status = $Matches[1]
        }
        $executingTasks += @{
            name = $file.Name
            status = $status
            path = $file.FullName
        }
    }
}
$statusInfo += "### Executing Tasks ($($executingTasks.Count))`n"
foreach ($task in $executingTasks) {
    $statusInfo += "- $($task.name) [Status: $($task.status)]`n"
}

# Build complete prompt
$prompt = @"
You are the Supervisor in the AutoClaude system.

Please read collaboration/SUPERVISOR_GUIDE.md to understand your responsibilities.

$statusInfo

Please execute your responsibilities based on the above status:
1. If inbox has new content, convert it to task files in queue/ directory, then clear inbox (keep template header)
2. If there are tasks with REVIEW status, perform review
3. Update project status

Notes:
- Use format for task files: task_<YYYYMMDD>_<HHMMSS>_<short_description>.md
- Task files must include YAML front matter (id, status, priority, created, etc.)
- Move approved tasks to completed/ directory
- Move rejected tasks back to queue/ directory with feedback
"@

# Check if there's anything to process
$needsAction = $false

# Check if inbox has actual content
if (Test-Path $inboxPath) {
    $inboxContent = Get-Content $inboxPath -Raw -ErrorAction SilentlyContinue
    $lines = $inboxContent -split "`n" | Where-Object {
        $_.Trim() -ne "" -and
        -not $_.StartsWith("#") -and
        -not $_.StartsWith("---") -and
        -not $_.Contains("Write new requirements")
    }
    if ($lines.Count -gt 0) {
        $needsAction = $true
        Write-Log "Found new content in inbox" "INFO"
    }
}

# Check if there are tasks pending review
foreach ($task in $executingTasks) {
    if ($task.status -eq "REVIEW") {
        $needsAction = $true
        Write-Log "Found task pending review: $($task.name)" "INFO"
        break
    }
}

if (-not $needsAction) {
    Write-Log "Nothing to process, Supervisor exiting" "INFO"
    exit 0
}

# Call Claude
Write-Log "Calling Claude Supervisor..." "INFO"

$claudePath = $config.claude_path
if (-not $claudePath) { $claudePath = "claude" }

# Save prompt to temp file
$promptFile = Join-Path $env:TEMP "autoclaude_supervisor_prompt_$(Get-Date -Format 'yyyyMMddHHmmss').txt"
Set-Content -Path $promptFile -Value $prompt -Encoding UTF8

try {
    # Switch to project directory and execute
    Push-Location $ProjectPath

    # Execute Claude
    $output = & $claudePath -p $prompt --allowedTools "Bash,Read,Edit,Write" 2>&1
    $exitCode = $LASTEXITCODE

    Pop-Location

    # Log output
    Write-Log "Claude output:`n$output" "INFO"

    if ($exitCode -eq 0) {
        Write-Log "Supervisor execution complete" "OK"
    } else {
        Write-Log "Supervisor execution failed, exit code: $exitCode" "ERROR"
    }

} catch {
    Pop-Location
    Write-Log "Supervisor execution exception: $_" "ERROR"
} finally {
    # Clean up temp file
    if (Test-Path $promptFile) {
        Remove-Item $promptFile -Force -ErrorAction SilentlyContinue
    }
}

Write-Log "Supervisor ended" "INFO"
