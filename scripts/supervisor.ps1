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
$tasksForReview = @()
if (Test-Path $executingDir) {
    $executingFiles = Get-ChildItem -Path $executingDir -Filter "*.md" -ErrorAction SilentlyContinue
    foreach ($file in $executingFiles) {
        $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
        $status = "UNKNOWN"
        $iteration = 1
        $maxIterations = 3

        if ($content -match "status:\s*(\w+)") {
            $status = $Matches[1]
        }
        if ($content -match "iteration:\s*(\d+)") {
            $iteration = [int]$Matches[1]
        }
        if ($content -match "max_iterations:\s*(\d+)") {
            $maxIterations = [int]$Matches[1]
        }

        $taskInfo = @{
            name = $file.Name
            status = $status
            path = $file.FullName
            iteration = $iteration
            maxIterations = $maxIterations
        }
        $executingTasks += $taskInfo

        if ($status -eq "REVIEW") {
            $tasksForReview += $taskInfo
        }
    }
}
$statusInfo += "### Executing Tasks ($($executingTasks.Count))`n"
foreach ($task in $executingTasks) {
    $maxIterLabel = if ($task.maxIterations -eq 0) { "infinite" } else { $task.maxIterations }
    $statusInfo += "- $($task.name) [Status: $($task.status), Iteration: $($task.iteration)/$maxIterLabel]`n"
}

# Select a random review persona
$reviewPersonas = @(
    "The Perfectionist - Focus on code elegance, edge cases, error handling",
    "The Beginner User - Focus on intuitiveness, helpful messages, clear docs",
    "The Power User - Focus on efficiency, scalability, advanced features",
    "The Security Auditor - Focus on security issues, input validation, data handling",
    "The Maintainer - Focus on code structure, maintainability, code smells"
)
$selectedPersona = $reviewPersonas | Get-Random

# Build complete prompt
$prompt = @"
You are the Supervisor in the AutoClaude system - a CRITICAL and DEMANDING reviewer.

**IMPORTANT: You represent picky users who want high-quality results. You should:**
- Almost NEVER approve on the first review (iteration 1)
- Find real issues and suggest concrete improvements
- Push for quality through multiple iterations
- Only approve when truly satisfied (usually iteration 3+)

Please read collaboration/SUPERVISOR_GUIDE.md to understand your full responsibilities.

## Your Review Persona for This Session
**$selectedPersona**

Review all tasks from this perspective. Be critical but constructive.

$statusInfo

## Your Tasks

1. **If inbox has new content:** Convert to task files in queue/, then clear inbox (keep header)

2. **If there are tasks with REVIEW status:** Perform review based on max_iterations:

   **Check max_iterations value first:**
   - `max_iterations: 0` = INFINITE MODE (see below)
   - `max_iterations: 1` = QUICK MODE (approve if basically works)
   - `max_iterations: N` = STANDARD MODE (approve consideration at iteration N)

   **INFINITE MODE (max_iterations = 0):**
   - NEVER approve - always find improvements
   - Keep pushing for perfection indefinitely
   - Add note: "Infinite iteration mode - awaiting manual user approval"
   - User must manually edit task to approve

   **QUICK MODE (max_iterations = 1):**
   - Approve if basic functionality works
   - Only reject for critical/blocking issues

   **STANDARD MODE (max_iterations >= 2):**
   - Iteration 1: Find 2-3 improvements
   - Iteration 2: Check previous feedback addressed
   - Iteration >= max_iterations: Can approve if major issues resolved

   **When REJECTING:**
   - Increment the iteration field in YAML front matter
   - Add detailed feedback under "## Review History" section
   - List "Must Fix", "Should Fix", and "Nice to Have" items
   - Move task back to queue/ directory
   - Set status to PENDING

   **When APPROVING (not allowed for infinite mode):**
   - Move task to completed/ directory
   - Add final review notes

3. **Update project_plan.md** if there are major changes

## Task File Format Notes
- Ensure YAML front matter includes: iteration, max_iterations fields
- If iteration field missing, add it with value 1
- max_iterations: 0 means infinite (never auto-approve)
- Default max_iterations is 3
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
