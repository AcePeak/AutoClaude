# AutoClaude - Executor Script
# Usage: executor.ps1 -ProjectPath <path> [-ResumeTask <task_id>]

param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectPath,

    [Parameter(Mandatory=$false)]
    [string]$ResumeTask = ""
)

$ErrorActionPreference = "Stop"

# Configuration
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ExecutorId = "executor_$(Get-Date -Format 'yyyyMMddHHmmss')_$PID"
$LogDir = Join-Path $ProjectPath "collaboration\.autoclaude\logs"
$TaskLogDir = Join-Path $LogDir "tasks"
$LogFile = Join-Path $LogDir "executor_$(Get-Date -Format 'yyyyMMdd').log"
$LockDir = Join-Path $ProjectPath "collaboration\.autoclaude\lock"

# Ensure directories exist
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}
if (-not (Test-Path $TaskLogDir)) {
    New-Item -ItemType Directory -Path $TaskLogDir -Force | Out-Null
}
if (-not (Test-Path $LockDir)) {
    New-Item -ItemType Directory -Path $LockDir -Force | Out-Null
}

# Current task log file (set when task is claimed)
$script:CurrentTaskLogFile = $null

# Log function - writes to both global log and task-specific log
function Write-Log {
    param(
        [string]$Message,
        [string]$Level = "INFO"
    )
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$ExecutorId] [$Level] $Message"

    # Write to global executor log
    Add-Content -Path $LogFile -Value $logEntry -Encoding UTF8

    # Write to task-specific log if set
    if ($script:CurrentTaskLogFile -and (Test-Path (Split-Path $script:CurrentTaskLogFile -Parent))) {
        Add-Content -Path $script:CurrentTaskLogFile -Value $logEntry -Encoding UTF8
    }

    $color = switch ($Level) {
        "INFO" { "Cyan" }
        "OK" { "Green" }
        "WARN" { "Yellow" }
        "ERROR" { "Red" }
        default { "White" }
    }
    Write-Host $logEntry -ForegroundColor $color
}

# Initialize task-specific log file
function Initialize-TaskLog {
    param([string]$TaskId)

    $script:CurrentTaskLogFile = Join-Path $TaskLogDir "$TaskId.log"

    # Create or append to task log
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $header = "`n`n========== Execution Session: $timestamp =========="
    $header += "`nExecutor ID: $ExecutorId"
    $header += "`n================================================`n"
    Add-Content -Path $script:CurrentTaskLogFile -Value $header -Encoding UTF8
}

# Read previous task log for recovery context
function Get-TaskLogHistory {
    param([string]$TaskId)

    $taskLogFile = Join-Path $TaskLogDir "$TaskId.log"
    if (Test-Path $taskLogFile) {
        return Get-Content $taskLogFile -Raw -ErrorAction SilentlyContinue
    }
    return ""
}

# Check if a lock's owner process is still running
function Test-LockProcessAlive {
    param([string]$LockFile)

    if (-not (Test-Path $LockFile)) {
        return $false
    }

    try {
        $lockContent = Get-Content $LockFile -Raw | ConvertFrom-Json
        $lockPid = $lockContent.pid

        # Check if process is still running
        $process = Get-Process -Id $lockPid -ErrorAction SilentlyContinue
        return ($null -ne $process)
    } catch {
        return $false
    }
}

# Try to acquire task lock
function Get-TaskLock {
    param(
        [string]$TaskId,
        [switch]$ForceIfOrphaned
    )

    $lockFile = Join-Path $LockDir "$TaskId.lock"

    # Check if lock already exists
    if (Test-Path $lockFile) {
        # Check if lock owner process is still alive
        $processAlive = Test-LockProcessAlive -LockFile $lockFile

        if ($processAlive) {
            # Check if lock is expired (over 30 minutes is considered expired even if process alive)
            $lockInfo = Get-Item $lockFile
            $lockAge = (Get-Date) - $lockInfo.LastWriteTime
            if ($lockAge.TotalMinutes -lt 30) {
                return @{ success = $false; orphaned = $false }
            }
        }

        # Lock is orphaned (process dead) or expired
        $isOrphaned = -not $processAlive
        if ($isOrphaned) {
            Write-Log "Detected orphaned lock for task: $TaskId (owner process not running)" "WARN"
        } else {
            Write-Log "Detected expired lock for task: $TaskId" "WARN"
        }

        # Remove stale lock
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

        return @{ success = $true; orphaned = $false }
    } catch {
        # File already exists or other error
        return @{ success = $false; orphaned = $false }
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
$isResumingOrphan = $false
$previousLogHistory = ""

# First check: Resume specific task if requested
if ($ResumeTask -ne "") {
    Write-Log "Attempting to resume specified task: $ResumeTask" "INFO"
    $taskFile = Join-Path $ExecutingDir "$ResumeTask.md"
    if (Test-Path $taskFile) {
        $lockResult = Get-TaskLock -TaskId $ResumeTask -ForceIfOrphaned
        if ($lockResult.success) {
            $taskToExecute = @{
                id = $ResumeTask
                file = $taskFile
                name = "$ResumeTask.md"
                isInExecuting = $true
            }
            $isResumingOrphan = $true
            $previousLogHistory = Get-TaskLogHistory -TaskId $ResumeTask
            Write-Log "Resuming specified task: $ResumeTask" "OK"
        }
    }
}

# Second check: Look for orphaned tasks in executing directory
if (-not $taskToExecute -and (Test-Path $ExecutingDir)) {
    $executingFiles = Get-ChildItem -Path $ExecutingDir -Filter "*.md" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime

    foreach ($file in $executingFiles) {
        $taskId = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)

        # Read task content to check status
        $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
        if ($content -match "status:\s*EXECUTING") {
            # This task might be orphaned, try to acquire lock
            $lockResult = Get-TaskLock -TaskId $taskId

            if ($lockResult.success) {
                Write-Log "Found and claimed orphaned task: $taskId" "WARN"
                $taskToExecute = @{
                    id = $taskId
                    file = $file.FullName
                    name = $file.Name
                    isInExecuting = $true
                }
                $isResumingOrphan = $true
                $previousLogHistory = Get-TaskLogHistory -TaskId $taskId
                break
            }
        }
    }
}

# Third check: Look for new tasks in queue
if (-not $taskToExecute -and (Test-Path $QueueDir)) {
    $queueFiles = Get-ChildItem -Path $QueueDir -Filter "*.md" -ErrorAction SilentlyContinue | Sort-Object Name

    foreach ($file in $queueFiles) {
        # Extract task ID
        $taskId = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)

        # Try to acquire lock
        $lockResult = Get-TaskLock -TaskId $taskId
        if ($lockResult.success) {
            Write-Log "Successfully acquired task lock: $taskId" "OK"
            $taskToExecute = @{
                id = $taskId
                file = $file.FullName
                name = $file.Name
                isInExecuting = $false
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

# Initialize per-task log
Initialize-TaskLog -TaskId $taskToExecute.id

try {
    # Read task content
    $taskContent = Get-Content $taskToExecute.file -Raw

    # Determine executing path
    $executingPath = $null

    if ($taskToExecute.isInExecuting) {
        # Task is already in executing directory (orphaned task recovery)
        $executingPath = $taskToExecute.file
        Write-Log "Task already in executing directory (recovery mode)" "INFO"
    } else {
        # Move task to executing directory
        $executingPath = Join-Path $ExecutingDir $taskToExecute.name
        Move-Item -Path $taskToExecute.file -Destination $executingPath -Force
        Write-Log "Task moved to executing directory" "INFO"
    }

    # Update task status to EXECUTING
    $taskContent = $taskContent -replace "status:\s*\w+", "status: EXECUTING"
    $taskContent = $taskContent -replace "assigned_to:\s*\w*", "assigned_to: $ExecutorId"
    Set-Content -Path $executingPath -Value $taskContent -Encoding UTF8

    # Build recovery context if resuming orphaned task
    $recoveryContext = ""
    if ($isResumingOrphan -and $previousLogHistory -ne "") {
        Write-Log "Including previous execution log for recovery context" "INFO"
        $recoveryContext = @"

## IMPORTANT: Recovery Mode

This task was previously being executed but was interrupted unexpectedly.
Below is the execution log from the previous session. Please:
1. Review what was already done
2. Continue from where it left off
3. Do NOT redo work that was already completed
4. If unsure about state, check the actual files in the project

### Previous Execution Log:
``````
$previousLogHistory
``````

"@
    }

    # Read metrics for iteration tracking
    $metricsFile = Join-Path $CollabDir ".autoclaude\metrics.md"
    $currentIterations = 0
    if (Test-Path $metricsFile) {
        $metricsContent = Get-Content $metricsFile -Raw -ErrorAction SilentlyContinue
        if ($metricsContent -match "Total task completions\s*\|\s*(\d+)") {
            $currentIterations = [int]$Matches[1]
        }
    }

    # Determine if refactoring is due
    $lightRefactorDue = ($currentIterations % 5 -eq 4)  # Every 5 iterations
    $heavyRefactorDue = ($currentIterations % 15 -eq 14)  # Every 15 iterations
    $refactorNote = ""
    if ($heavyRefactorDue) {
        $refactorNote = "`n`n**HEAVY REFACTORING DUE**: This is iteration $($currentIterations + 1). After completing the task, perform heavy refactoring (see EXECUTOR_GUIDE.md)."
    } elseif ($lightRefactorDue) {
        $refactorNote = "`n`n**LIGHT REFACTORING DUE**: This is iteration $($currentIterations + 1). After completing the task, perform light refactoring (see EXECUTOR_GUIDE.md)."
    }

    # Build Executor prompt
    $prompt = @"
You are an Executor in the AutoClaude system, ID: $ExecutorId

Please read collaboration/EXECUTOR_GUIDE.md to understand your full responsibilities.
$recoveryContext
## Current Task

Task file: collaboration/executing/$($taskToExecute.name)

Task content:
$taskContent

## Execution Instructions

### 1. Analyze & Execute
- Read task description and acceptance criteria carefully
- Identify project type (software/business/documentation/other)
- Perform required operations

### 2. Self-Testing (CRITICAL)
- Run existing tests first (check collaboration/.autoclaude/tests/test_registry.md)
- Write NEW tests for new functionality
- For software: unit tests, integration tests
- For business: persona validation, market checks
- For documentation: accuracy and consistency checks
- Update test_registry.md with new tests

### 3. Update Test Registry
After adding tests, update collaboration/.autoclaude/tests/test_registry.md:
- Add new test entries with IDs
- Record test results
- Note any failures

### 4. Check Architecture
- Current iteration count: $currentIterations$refactorNote
- If refactoring is due, perform it after task completion
- Update collaboration/.autoclaude/metrics.md

### 5. Submit for Review
Update task file with:
- Detailed execution feedback
- Test results (tests added, pass/fail counts)
- Any refactoring performed
- Change status to REVIEW

## Important Paths
- Working directory: $ProjectPath
- Task file: collaboration/executing/$($taskToExecute.name)
- Test registry: collaboration/.autoclaude/tests/test_registry.md
- Metrics: collaboration/.autoclaude/metrics.md
- Task log: collaboration/.autoclaude/logs/tasks/$($taskToExecute.id).log

## Quality Requirements
- No submission without tests
- All existing tests must pass
- Document everything you changed
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
