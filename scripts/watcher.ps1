# AutoClaude - Lightweight Watcher
# Usage: watcher.ps1 [-ProjectPath <path>] [-Once]
# Does not consume tokens, only checks file changes and triggers supervisor/executor

param(
    [Parameter(Position=0)]
    [string]$ProjectPath,

    [switch]$Once  # Run check only once
)

$ErrorActionPreference = "Stop"

# Configuration
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppDataDir = Join-Path $env:APPDATA "AutoClaude"
$ProjectsFile = Join-Path $AppDataDir "projects.json"
$StateFile = Join-Path $AppDataDir "watcher_state.json"

# Log function
function Write-Log {
    param(
        [string]$Message,
        [string]$Level = "INFO"
    )
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $color = switch ($Level) {
        "INFO" { "Cyan" }
        "OK" { "Green" }
        "WARN" { "Yellow" }
        "ERROR" { "Red" }
        default { "White" }
    }
    Write-Host "[$timestamp] [$Level] $Message" -ForegroundColor $color
}

# Get file hash (for detecting changes)
function Get-FileHash-Safe {
    param([string]$FilePath)
    if (Test-Path $FilePath) {
        try {
            $hash = Get-FileHash -Path $FilePath -Algorithm MD5
            return $hash.Hash
        } catch {
            return $null
        }
    }
    return $null
}

# Get directory snapshot
function Get-DirectorySnapshot {
    param([string]$DirPath)

    $snapshot = @{
        files = @{}
        count = 0
    }

    if (Test-Path $DirPath) {
        $files = Get-ChildItem -Path $DirPath -File -ErrorAction SilentlyContinue
        foreach ($file in $files) {
            $snapshot.files[$file.Name] = @{
                lastModified = $file.LastWriteTime.ToString("o")
                size = $file.Length
            }
            $snapshot.count++
        }
    }

    return $snapshot
}

# Check single project
function Check-Project {
    param([string]$ProjectPath)

    $collabDir = Join-Path $ProjectPath "collaboration"
    $configFile = Join-Path $collabDir ".autoclaude\config.json"

    # Check if project is valid
    if (-not (Test-Path $collabDir)) {
        Write-Log "Project not initialized: $ProjectPath" "WARN"
        return @{ needsSupervisor = $false; needsExecutor = $false }
    }

    # Read config
    $config = @{
        check_inbox = $true
        check_queue = $true
        check_executing = $true
    }
    if (Test-Path $configFile) {
        try {
            $configData = Get-Content $configFile -Raw | ConvertFrom-Json
            if ($configData.watcher) {
                $config = $configData.watcher
            }
        } catch {}
    }

    $result = @{
        needsSupervisor = $false
        needsExecutor = $false
        orphanedTasks = @()
        reason = ""
    }

    # Check inbox.md
    if ($config.check_inbox) {
        $inboxPath = Join-Path $collabDir "inbox.md"
        if (Test-Path $inboxPath) {
            $content = Get-Content $inboxPath -Raw -ErrorAction SilentlyContinue
            # Check if there's actual content (excluding template header)
            $lines = $content -split "`n" | Where-Object {
                $_.Trim() -ne "" -and
                -not $_.StartsWith("#") -and
                -not $_.StartsWith("---") -and
                -not $_.Contains("Write new requirements")
            }
            if ($lines.Count -gt 0) {
                $result.needsSupervisor = $true
                $result.reason = "inbox.md has new content"
            }
        }
    }

    # Check queue/ directory
    if ($config.check_queue) {
        $queueDir = Join-Path $collabDir "queue"
        if (Test-Path $queueDir) {
            $pendingTasks = Get-ChildItem -Path $queueDir -Filter "*.md" -ErrorAction SilentlyContinue
            if ($pendingTasks.Count -gt 0) {
                $result.needsExecutor = $true
                if ($result.reason) { $result.reason += "; " }
                $result.reason += "queue/ has $($pendingTasks.Count) pending task(s)"
            }
        }
    }

    # Check executing/ directory for tasks pending review or orphaned tasks
    if ($config.check_executing) {
        $executingDir = Join-Path $collabDir "executing"
        $lockDir = Join-Path $collabDir ".autoclaude\lock"

        if (Test-Path $executingDir) {
            $executingTasks = Get-ChildItem -Path $executingDir -Filter "*.md" -ErrorAction SilentlyContinue
            foreach ($task in $executingTasks) {
                $content = Get-Content $task.FullName -Raw -ErrorAction SilentlyContinue

                # Check for tasks pending review
                if ($content -match "status:\s*REVIEW") {
                    $result.needsSupervisor = $true
                    if ($result.reason) { $result.reason += "; " }
                    $result.reason += "task(s) pending review"
                }

                # Check for orphaned tasks (EXECUTING status but lock owner process dead)
                if ($content -match "status:\s*EXECUTING") {
                    $taskId = [System.IO.Path]::GetFileNameWithoutExtension($task.Name)
                    $lockFile = Join-Path $lockDir "$taskId.lock"

                    $isOrphaned = $false

                    if (-not (Test-Path $lockFile)) {
                        # No lock file means orphaned
                        $isOrphaned = $true
                    } else {
                        # Check if lock owner process is still alive
                        try {
                            $lockContent = Get-Content $lockFile -Raw | ConvertFrom-Json
                            $lockPid = $lockContent.pid
                            $process = Get-Process -Id $lockPid -ErrorAction SilentlyContinue
                            if ($null -eq $process) {
                                $isOrphaned = $true
                            }
                        } catch {
                            $isOrphaned = $true
                        }
                    }

                    if ($isOrphaned) {
                        $result.needsExecutor = $true
                        $result.orphanedTasks += @($taskId)
                        if ($result.reason) { $result.reason += "; " }
                        $result.reason += "orphaned task needs recovery: $taskId"
                    }
                }
            }
        }
    }

    return $result
}

# Trigger Supervisor
function Trigger-Supervisor {
    param([string]$ProjectPath)

    $supervisorScript = Join-Path $ScriptDir "supervisor.ps1"
    if (Test-Path $supervisorScript) {
        Write-Log "Triggering Supervisor: $ProjectPath" "INFO"
        Start-Process -FilePath "powershell.exe" -ArgumentList "-ExecutionPolicy Bypass -File `"$supervisorScript`" -ProjectPath `"$ProjectPath`"" -WindowStyle Hidden
        return $true
    } else {
        Write-Log "Supervisor script not found: $supervisorScript" "ERROR"
        return $false
    }
}

# Trigger Executor
function Trigger-Executor {
    param(
        [string]$ProjectPath,
        [string]$ResumeTask = ""
    )

    $executorScript = Join-Path $ScriptDir "executor.ps1"
    if (Test-Path $executorScript) {
        $args = "-ExecutionPolicy Bypass -File `"$executorScript`" -ProjectPath `"$ProjectPath`""
        if ($ResumeTask -ne "") {
            $args += " -ResumeTask `"$ResumeTask`""
            Write-Log "Triggering Executor to resume task: $ResumeTask" "INFO"
        } else {
            Write-Log "Triggering Executor: $ProjectPath" "INFO"
        }
        Start-Process -FilePath "powershell.exe" -ArgumentList $args -WindowStyle Hidden
        return $true
    } else {
        Write-Log "Executor script not found: $executorScript" "ERROR"
        return $false
    }
}

# Get all enabled projects
function Get-EnabledProjects {
    $projects = @()

    # If single project specified
    if ($ProjectPath) {
        $projects += $ProjectPath
        return $projects
    }

    # Read from projects.json
    if (Test-Path $ProjectsFile) {
        try {
            $data = Get-Content $ProjectsFile -Raw | ConvertFrom-Json
            foreach ($project in $data.projects) {
                if ($project.enabled) {
                    $projects += $project.path
                }
            }
        } catch {
            Write-Log "Cannot read projects.json: $_" "ERROR"
        }
    }

    return $projects
}

# Main watch loop
function Start-Watcher {
    Write-Log "AutoClaude Watcher started" "OK"

    if ($Once) {
        Write-Log "Single check mode" "INFO"
    }

    do {
        $projects = Get-EnabledProjects

        if ($projects.Count -eq 0) {
            Write-Log "No enabled projects" "WARN"
        } else {
            foreach ($project in $projects) {
                if (-not (Test-Path $project)) {
                    Write-Log "Project directory not found: $project" "WARN"
                    continue
                }

                $projectName = Split-Path -Leaf $project
                $checkResult = Check-Project -ProjectPath $project

                if ($checkResult.needsSupervisor -or $checkResult.needsExecutor) {
                    Write-Log "[$projectName] $($checkResult.reason)" "INFO"

                    if ($checkResult.needsSupervisor) {
                        Trigger-Supervisor -ProjectPath $project
                    }

                    if ($checkResult.needsExecutor) {
                        # First, resume orphaned tasks
                        if ($checkResult.orphanedTasks.Count -gt 0) {
                            foreach ($orphanedTaskId in $checkResult.orphanedTasks) {
                                Trigger-Executor -ProjectPath $project -ResumeTask $orphanedTaskId
                            }
                        } else {
                            # Normal executor for new tasks
                            Trigger-Executor -ProjectPath $project
                        }
                    }
                } else {
                    Write-Log "[$projectName] No changes" "INFO"
                }
            }
        }

        if (-not $Once) {
            # Read check interval (default 60 seconds)
            $interval = 60
            if ($projects.Count -gt 0) {
                $configFile = Join-Path $projects[0] "collaboration\.autoclaude\config.json"
                if (Test-Path $configFile) {
                    try {
                        $config = Get-Content $configFile -Raw | ConvertFrom-Json
                        if ($config.check_interval_seconds) {
                            $interval = $config.check_interval_seconds
                        }
                    } catch {}
                }
            }

            Write-Log "Waiting $interval seconds..." "INFO"
            Start-Sleep -Seconds $interval
        }

    } while (-not $Once)

    Write-Log "Watcher stopped" "OK"
}

# Execute
Start-Watcher
