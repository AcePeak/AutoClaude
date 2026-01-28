# AutoClaude - Executor Script
# Usage: executor.ps1 -ProjectPath <path>

param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectPath
)

$ErrorActionPreference = "Stop"

# Configuration
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ExecutorId = "executor_$(Get-Date -Format 'yyyyMMddHHmmss')_$PID"
$LogDir = Join-Path $ProjectPath "collaboration\.autoclaude\logs"
$LogFile = Join-Path $LogDir "executor_$(Get-Date -Format 'yyyyMMdd').log"
$LockDir = Join-Path $ProjectPath "collaboration\.autoclaude\lock"

# Ensure directories exist
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}
if (-not (Test-Path $LockDir)) {
    New-Item -ItemType Directory -Path $LockDir -Force | Out-Null
}

# Log function
function Write-Log {
    param(
        [string]$Message,
        [string]$Level = "INFO"
    )
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$ExecutorId] [$Level] $Message"
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

# Try to acquire task lock
function Get-TaskLock {
    param([string]$TaskId)

    $lockFile = Join-Path $LockDir "$TaskId.lock"

    # Check if lock already exists
    if (Test-Path $lockFile) {
        # Check if lock is expired (over 30 minutes is considered expired)
        $lockInfo = Get-Item $lockFile
        $lockAge = (Get-Date) - $lockInfo.LastWriteTime
        if ($lockAge.TotalMinutes -lt 30) {
            return $false
        }
        # Lock expired, delete it
        Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
    }

    # Try to create lock file
    try {
        $lockContent = @{
            executor_id = $ExecutorId
            locked_at = (Get-Date -Format "o")
            pid = $PID
        } | ConvertTo-Json

        # Create file exclusively
        $stream = [System.IO.File]::Open($lockFile, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
        $writer = [System.IO.StreamWriter]::new($stream)
        $writer.Write($lockContent)
        $writer.Close()
        $stream.Close()

        return $true
    } catch {
        # File already exists or other error
        return $false
    }
}

# Release task lock
function Release-TaskLock {
    param([string]$TaskId)

    $lockFile = Join-Path $LockDir "$TaskId.lock"
    if (Test-Path $lockFile) {
        Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
    }
}

# Get project path
$ProjectPath = [System.IO.Path]::GetFullPath($ProjectPath)
$CollabDir = Join-Path $ProjectPath "collaboration"
$QueueDir = Join-Path $CollabDir "queue"
$ExecutingDir = Join-Path $CollabDir "executing"

# Validate project
if (-not (Test-Path $CollabDir)) {
    Write-Log "Project not initialized: $ProjectPath" "ERROR"
    exit 1
}

Write-Log "Executor started: $ProjectPath" "INFO"

# Read config
$configFile = Join-Path $CollabDir ".autoclaude\config.json"
$config = @{
    claude_path = "claude"
    executor = @{
        prompt_template = "You are an Executor, please execute tasks according to EXECUTOR_GUIDE.md."
    }
}

if (Test-Path $configFile) {
    try {
        $config = Get-Content $configFile -Raw | ConvertFrom-Json
    } catch {
        Write-Log "Cannot read config file, using defaults" "WARN"
    }
}

# Ensure executing directory exists
if (-not (Test-Path $ExecutingDir)) {
    New-Item -ItemType Directory -Path $ExecutingDir -Force | Out-Null
}

# Find claimable task
$taskToExecute = $null

if (Test-Path $QueueDir) {
    $queueFiles = Get-ChildItem -Path $QueueDir -Filter "*.md" -ErrorAction SilentlyContinue | Sort-Object Name

    foreach ($file in $queueFiles) {
        # Extract task ID
        $taskId = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)

        # Try to acquire lock
        if (Get-TaskLock -TaskId $taskId) {
            Write-Log "Successfully acquired task lock: $taskId" "OK"
            $taskToExecute = @{
                id = $taskId
                file = $file.FullName
                name = $file.Name
            }
            break
        } else {
            Write-Log "Task already claimed by another Executor: $taskId" "INFO"
        }
    }
}

if (-not $taskToExecute) {
    Write-Log "No claimable tasks, Executor exiting" "INFO"
    exit 0
}

Write-Log "Starting task execution: $($taskToExecute.name)" "INFO"

try {
    # Read task content
    $taskContent = Get-Content $taskToExecute.file -Raw

    # Move task to executing directory
    $executingPath = Join-Path $ExecutingDir $taskToExecute.name
    Move-Item -Path $taskToExecute.file -Destination $executingPath -Force

    # Update task status to EXECUTING
    $taskContent = $taskContent -replace "status:\s*\w+", "status: EXECUTING"
    $taskContent = $taskContent -replace "assigned_to:\s*\w*", "assigned_to: $ExecutorId"
    Set-Content -Path $executingPath -Value $taskContent -Encoding UTF8

    Write-Log "Task moved to executing directory" "INFO"

    # Build Executor prompt
    $prompt = @"
You are an Executor in the AutoClaude system, ID: $ExecutorId

Please read collaboration/EXECUTOR_GUIDE.md to understand your responsibilities.

## Current Task

Task file: collaboration/executing/$($taskToExecute.name)

Task content:
$taskContent

## Execution Instructions

1. Carefully read task description and acceptance criteria
2. Perform required operations in project directory (write code, create files, etc.)
3. After completion, update task file:
   - Record what you did in "Execution Feedback" section
   - Mark completion status of each acceptance criterion
   - Change status to REVIEW

Notes:
- Working directory is project root: $ProjectPath
- Task file is at: collaboration/executing/$($taskToExecute.name)
- After completion, you must change status to REVIEW
"@

    # Call Claude
    Write-Log "Calling Claude Executor..." "INFO"

    $claudePath = $config.claude_path
    if (-not $claudePath) { $claudePath = "claude" }

    Push-Location $ProjectPath

    $output = & $claudePath -p $prompt --allowedTools "Bash,Read,Edit,Write" 2>&1
    $exitCode = $LASTEXITCODE

    Pop-Location

    # Log output
    Write-Log "Claude output:`n$output" "INFO"

    if ($exitCode -eq 0) {
        Write-Log "Task execution complete: $($taskToExecute.name)" "OK"
    } else {
        Write-Log "Task execution failed, exit code: $exitCode" "ERROR"

        # Even on failure, set to REVIEW to let Supervisor decide how to handle
        if (Test-Path $executingPath) {
            $taskContent = Get-Content $executingPath -Raw
            if ($taskContent -notmatch "status:\s*REVIEW") {
                $taskContent = $taskContent -replace "status:\s*\w+", "status: REVIEW"
                $taskContent += "`n`n## Execution Error`nExecution failed, exit code: $exitCode`n"
                Set-Content -Path $executingPath -Value $taskContent -Encoding UTF8
            }
        }
    }

} catch {
    Write-Log "Task execution exception: $_" "ERROR"
} finally {
    # Release lock
    Release-TaskLock -TaskId $taskToExecute.id
    Write-Log "Released task lock: $($taskToExecute.id)" "INFO"
}

Write-Log "Executor ended" "INFO"
