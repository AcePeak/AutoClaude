# AutoClaude - Log Viewer
# Usage: view-logs.ps1 -ProjectPath <path> [-TaskId <task_id>] [-Follow] [-Lines <n>]

param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectPath,

    [Parameter(Mandatory=$false)]
    [string]$TaskId = "",

    [switch]$Follow,  # Real-time follow mode

    [int]$Lines = 50  # Number of lines to show
)

$ErrorActionPreference = "Stop"

$ProjectPath = [System.IO.Path]::GetFullPath($ProjectPath)
$LogDir = Join-Path $ProjectPath "collaboration\.autoclaude\logs"
$TaskLogDir = Join-Path $LogDir "tasks"

function Write-Header {
    param([string]$Text)
    Write-Host ""
    Write-Host "========== $Text ==========" -ForegroundColor Cyan
    Write-Host ""
}

function Format-LogLine {
    param([string]$Line)

    if ($Line -match "\[ERROR\]") {
        Write-Host $Line -ForegroundColor Red
    } elseif ($Line -match "\[WARN\]") {
        Write-Host $Line -ForegroundColor Yellow
    } elseif ($Line -match "\[OK\]") {
        Write-Host $Line -ForegroundColor Green
    } else {
        Write-Host $Line
    }
}

# Check if log directory exists
if (-not (Test-Path $LogDir)) {
    Write-Host "Log directory not found: $LogDir" -ForegroundColor Red
    Write-Host "Project may not be initialized or no tasks have been executed yet."
    exit 1
}

# If specific task ID provided
if ($TaskId -ne "") {
    $taskLogFile = Join-Path $TaskLogDir "$TaskId.log"

    if (-not (Test-Path $taskLogFile)) {
        Write-Host "Task log not found: $TaskId" -ForegroundColor Red
        Write-Host ""
        Write-Host "Available task logs:"
        if (Test-Path $TaskLogDir) {
            Get-ChildItem -Path $TaskLogDir -Filter "*.log" | ForEach-Object {
                Write-Host "  - $($_.BaseName)" -ForegroundColor Gray
            }
        } else {
            Write-Host "  (none)" -ForegroundColor Gray
        }
        exit 1
    }

    Write-Header "Task Log: $TaskId"

    if ($Follow) {
        Write-Host "(Following log in real-time. Press Ctrl+C to stop)" -ForegroundColor Gray
        Write-Host ""
        Get-Content $taskLogFile -Wait | ForEach-Object { Format-LogLine $_ }
    } else {
        Get-Content $taskLogFile -Tail $Lines | ForEach-Object { Format-LogLine $_ }
    }
} else {
    # Show overview of all logs
    Write-Header "AutoClaude Logs: $(Split-Path -Leaf $ProjectPath)"

    # Show executor logs
    Write-Host "Executor Logs:" -ForegroundColor Yellow
    $executorLogs = Get-ChildItem -Path $LogDir -Filter "executor_*.log" -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 3
    if ($executorLogs) {
        foreach ($log in $executorLogs) {
            Write-Host "  $($log.Name) ($('{0:N0}' -f $log.Length) bytes)" -ForegroundColor Gray
        }
    } else {
        Write-Host "  (none)" -ForegroundColor Gray
    }

    # Show supervisor logs
    Write-Host ""
    Write-Host "Supervisor Logs:" -ForegroundColor Yellow
    $supervisorLogs = Get-ChildItem -Path $LogDir -Filter "supervisor_*.log" -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 3
    if ($supervisorLogs) {
        foreach ($log in $supervisorLogs) {
            Write-Host "  $($log.Name) ($('{0:N0}' -f $log.Length) bytes)" -ForegroundColor Gray
        }
    } else {
        Write-Host "  (none)" -ForegroundColor Gray
    }

    # Show task logs
    Write-Host ""
    Write-Host "Task Logs:" -ForegroundColor Yellow
    if (Test-Path $TaskLogDir) {
        $taskLogs = Get-ChildItem -Path $TaskLogDir -Filter "*.log" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
        if ($taskLogs) {
            foreach ($log in $taskLogs) {
                $taskId = $log.BaseName
                $lastModified = $log.LastWriteTime.ToString("yyyy-MM-dd HH:mm")

                # Try to get task status
                $status = "?"
                $taskFile = Join-Path $ProjectPath "collaboration\queue\$taskId.md"
                if (-not (Test-Path $taskFile)) {
                    $taskFile = Join-Path $ProjectPath "collaboration\executing\$taskId.md"
                }
                if (-not (Test-Path $taskFile)) {
                    $taskFile = Join-Path $ProjectPath "collaboration\completed\$taskId.md"
                }
                if (Test-Path $taskFile) {
                    $content = Get-Content $taskFile -Raw -ErrorAction SilentlyContinue
                    if ($content -match "status:\s*(\w+)") {
                        $status = $Matches[1]
                    }
                }

                $statusColor = switch ($status) {
                    "PENDING" { "Gray" }
                    "EXECUTING" { "Yellow" }
                    "REVIEW" { "Cyan" }
                    "APPROVED" { "Green" }
                    "COMPLETED" { "Green" }
                    "REJECTED" { "Red" }
                    default { "White" }
                }

                Write-Host "  $taskId " -NoNewline
                Write-Host "[$status]" -ForegroundColor $statusColor -NoNewline
                Write-Host " - $lastModified" -ForegroundColor Gray
            }
        } else {
            Write-Host "  (none)" -ForegroundColor Gray
        }
    } else {
        Write-Host "  (none)" -ForegroundColor Gray
    }

    Write-Host ""
    Write-Host "Usage:" -ForegroundColor Cyan
    Write-Host "  View specific task log:" -ForegroundColor Gray
    Write-Host "    .\view-logs.ps1 -ProjectPath `"$ProjectPath`" -TaskId <task_id>"
    Write-Host ""
    Write-Host "  Follow task log in real-time:" -ForegroundColor Gray
    Write-Host "    .\view-logs.ps1 -ProjectPath `"$ProjectPath`" -TaskId <task_id> -Follow"
    Write-Host ""
    Write-Host "  View today's executor log:" -ForegroundColor Gray
    Write-Host "    Get-Content `"$LogDir\executor_$(Get-Date -Format 'yyyyMMdd').log`" -Tail 50"
    Write-Host ""
}
