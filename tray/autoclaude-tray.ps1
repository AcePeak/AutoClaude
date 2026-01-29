# AutoClaude - System Tray Application
# Provides project status monitoring, notifications, and management

param(
    [switch]$Hidden  # Hide console window
)

# Hide console window
if ($Hidden) {
    Add-Type -Name Window -Namespace Console -MemberDefinition '
    [DllImport("Kernel32.dll")]
    public static extern IntPtr GetConsoleWindow();
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, Int32 nCmdShow);
    '
    $consolePtr = [Console.Window]::GetConsoleWindow()
    [Console.Window]::ShowWindow($consolePtr, 0) | Out-Null
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Configuration
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppDir = Split-Path -Parent $ScriptDir
$ScriptsDir = Join-Path $AppDir "scripts"
$AppDataDir = Join-Path $env:APPDATA "AutoClaude"
$ProjectsFile = Join-Path $AppDataDir "projects.json"

# Ensure AppData directory exists
if (-not (Test-Path $AppDataDir)) {
    New-Item -ItemType Directory -Path $AppDataDir -Force | Out-Null
}

# Global variables
$global:WatcherProcess = $null
$global:NotifyIcon = $null
$global:ContextMenu = $null
$global:Timer = $null

# Log function
function Write-TrayLog {
    param([string]$Message)
    $logFile = Join-Path $AppDataDir "tray.log"
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $logFile -Value "[$timestamp] $Message" -Encoding UTF8
}

# Show notification
function Show-Notification {
    param(
        [string]$Title,
        [string]$Message,
        [System.Windows.Forms.ToolTipIcon]$Icon = [System.Windows.Forms.ToolTipIcon]::Info
    )

    if ($global:NotifyIcon) {
        $global:NotifyIcon.BalloonTipTitle = $Title
        $global:NotifyIcon.BalloonTipText = $Message
        $global:NotifyIcon.BalloonTipIcon = $Icon
        $global:NotifyIcon.ShowBalloonTip(5000)
    }
}

# Read project list
function Get-Projects {
    $projects = @()

    if (Test-Path $ProjectsFile) {
        try {
            $data = Get-Content $ProjectsFile -Raw | ConvertFrom-Json
            $projects = @($data.projects)
        } catch {
            Write-TrayLog "Cannot read projects.json: $_"
        }
    }

    return $projects
}

# Save project list
function Save-Projects {
    param($Projects)

    $data = @{ projects = $Projects }
    $data | ConvertTo-Json -Depth 10 | Set-Content $ProjectsFile -Encoding UTF8
}

# Get project status
function Get-ProjectStatus {
    param([string]$ProjectPath)

    $status = @{
        queue = 0
        executing = 0
        completed = 0
        hasError = $false
    }

    $collabDir = Join-Path $ProjectPath "collaboration"

    if (Test-Path $collabDir) {
        $queueDir = Join-Path $collabDir "queue"
        $executingDir = Join-Path $collabDir "executing"
        $completedDir = Join-Path $collabDir "completed"

        if (Test-Path $queueDir) {
            $status.queue = (Get-ChildItem -Path $queueDir -Filter "*.md" -ErrorAction SilentlyContinue).Count
        }
        if (Test-Path $executingDir) {
            $status.executing = (Get-ChildItem -Path $executingDir -Filter "*.md" -ErrorAction SilentlyContinue).Count
        }
        if (Test-Path $completedDir) {
            $status.completed = (Get-ChildItem -Path $completedDir -Filter "*.md" -ErrorAction SilentlyContinue).Count
        }
    }

    return $status
}

# Get detailed task list for a project
function Get-ProjectTasks {
    param([string]$ProjectPath)

    $tasks = @()
    $collabDir = Join-Path $ProjectPath "collaboration"

    foreach ($dir in @("queue", "executing")) {
        $taskDir = Join-Path $collabDir $dir
        if (Test-Path $taskDir) {
            $files = Get-ChildItem -Path $taskDir -Filter "*.md" -ErrorAction SilentlyContinue
            foreach ($file in $files) {
                $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
                $task = @{
                    id = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
                    name = $file.Name
                    path = $file.FullName
                    location = $dir
                    status = "UNKNOWN"
                    iteration = 1
                    maxIterations = 3
                }

                if ($content -match "status:\s*(\w+)") {
                    $task.status = $Matches[1]
                }
                if ($content -match "iteration:\s*(\d+)") {
                    $task.iteration = [int]$Matches[1]
                }
                if ($content -match "max_iterations:\s*(\d+)") {
                    $task.maxIterations = [int]$Matches[1]
                }

                # Extract short description from task
                if ($content -match "## Task Description\s*\n+([^\n]+)") {
                    $task.description = $Matches[1].Substring(0, [Math]::Min(50, $Matches[1].Length))
                } else {
                    $task.description = $task.id
                }

                $tasks += $task
            }
        }
    }

    return $tasks
}

# Approve a task (stop iterations)
function Approve-Task {
    param(
        [string]$TaskPath,
        [string]$ProjectPath
    )

    if (-not (Test-Path $TaskPath)) {
        return $false
    }

    $content = Get-Content $TaskPath -Raw
    $completedDir = Join-Path $ProjectPath "collaboration\completed"

    # Update status to APPROVED
    $content = $content -replace "status:\s*\w+", "status: APPROVED"

    # Add approval note
    $approvalNote = @"

## Manual Approval
- Approved by: User (via tray menu)
- Approved at: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
- Note: Task iteration stopped by user request
"@

    if ($content -notmatch "## Manual Approval") {
        $content += $approvalNote
    }

    # Move to completed
    if (-not (Test-Path $completedDir)) {
        New-Item -ItemType Directory -Path $completedDir -Force | Out-Null
    }

    $fileName = Split-Path -Leaf $TaskPath
    $destPath = Join-Path $completedDir $fileName

    Set-Content -Path $TaskPath -Value $content -Encoding UTF8
    Move-Item -Path $TaskPath -Destination $destPath -Force

    return $true
}

# Set task to approve on next review (set max_iterations = current iteration)
function Stop-TaskIteration {
    param([string]$TaskPath)

    if (-not (Test-Path $TaskPath)) {
        return $false
    }

    $content = Get-Content $TaskPath -Raw
    $currentIteration = 1

    if ($content -match "iteration:\s*(\d+)") {
        $currentIteration = [int]$Matches[1]
    }

    # Set max_iterations to current iteration so it will be approved on next review
    if ($content -match "max_iterations:\s*\d+") {
        $content = $content -replace "max_iterations:\s*\d+", "max_iterations: $currentIteration"
    } else {
        # Add max_iterations field after iteration field
        $content = $content -replace "(iteration:\s*\d+)", "`$1`nmax_iterations: $currentIteration"
    }

    Set-Content -Path $TaskPath -Value $content -Encoding UTF8
    return $true
}

# Update tray icon tooltip
function Update-TrayTooltip {
    $projects = Get-Projects
    $enabledCount = ($projects | Where-Object { $_.enabled }).Count
    $totalQueue = 0
    $totalExecuting = 0

    foreach ($project in $projects) {
        if ($project.enabled) {
            $status = Get-ProjectStatus -ProjectPath $project.path
            $totalQueue += $status.queue
            $totalExecuting += $status.executing
        }
    }

    $tooltip = "AutoClaude`n"
    $tooltip += "Projects: $enabledCount`n"
    $tooltip += "Queue: $totalQueue | Executing: $totalExecuting"

    if ($global:NotifyIcon) {
        $global:NotifyIcon.Text = $tooltip.Substring(0, [Math]::Min(63, $tooltip.Length))
    }
}

# Build context menu
function Build-ContextMenu {
    $menu = New-Object System.Windows.Forms.ContextMenuStrip

    # Title
    $titleItem = New-Object System.Windows.Forms.ToolStripMenuItem
    $titleItem.Text = "AutoClaude"
    $titleItem.Enabled = $false
    $titleItem.Font = New-Object System.Drawing.Font($titleItem.Font, [System.Drawing.FontStyle]::Bold)
    $menu.Items.Add($titleItem) | Out-Null

    $menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null

    # Project list
    $projects = Get-Projects

    if ($projects.Count -eq 0) {
        $noProjectItem = New-Object System.Windows.Forms.ToolStripMenuItem
        $noProjectItem.Text = "No projects"
        $noProjectItem.Enabled = $false
        $menu.Items.Add($noProjectItem) | Out-Null
    } else {
        foreach ($project in $projects) {
            $projectItem = New-Object System.Windows.Forms.ToolStripMenuItem
            $status = Get-ProjectStatus -ProjectPath $project.path
            $statusText = "Queue:$($status.queue) Exec:$($status.executing)"

            if ($project.enabled) {
                $projectItem.Text = "[ON] $($project.name) ($statusText)"
                $projectItem.Checked = $true
            } else {
                $projectItem.Text = "[OFF] $($project.name)"
                $projectItem.Checked = $false
            }

            # Submenu
            $subMenu = New-Object System.Windows.Forms.ToolStripMenuItem
            $subMenu.Text = $project.name

            # Open directory
            $openDirItem = New-Object System.Windows.Forms.ToolStripMenuItem
            $openDirItem.Text = "Open Directory"
            $projectPath = $project.path
            $openDirItem.Add_Click({
                Start-Process "explorer.exe" -ArgumentList $projectPath
            }.GetNewClosure())
            $subMenu.DropDownItems.Add($openDirItem) | Out-Null

            # Open Claude
            $openClaudeItem = New-Object System.Windows.Forms.ToolStripMenuItem
            $openClaudeItem.Text = "Open Claude"
            $openClaudeItem.Add_Click({
                $script = Join-Path $ScriptsDir "open-claude.ps1"
                Start-Process "powershell.exe" -ArgumentList "-ExecutionPolicy Bypass -File `"$script`" -Path `"$projectPath`""
            }.GetNewClosure())
            $subMenu.DropDownItems.Add($openClaudeItem) | Out-Null

            # Toggle enabled state
            $toggleItem = New-Object System.Windows.Forms.ToolStripMenuItem
            $toggleItem.Text = if ($project.enabled) { "Pause Monitoring" } else { "Resume Monitoring" }
            $projectName = $project.name
            $toggleItem.Add_Click({
                $projects = Get-Projects
                foreach ($p in $projects) {
                    if ($p.name -eq $projectName) {
                        $p.enabled = -not $p.enabled
                        break
                    }
                }
                Save-Projects -Projects $projects
                Update-TrayTooltip
                Show-Notification -Title "AutoClaude" -Message "Project $projectName monitoring $(if ($p.enabled) { 'resumed' } else { 'paused' })"
            }.GetNewClosure())
            $subMenu.DropDownItems.Add($toggleItem) | Out-Null

            # Manage Tasks submenu
            $tasksMenu = New-Object System.Windows.Forms.ToolStripMenuItem
            $tasksMenu.Text = "Manage Tasks"

            $tasks = Get-ProjectTasks -ProjectPath $projectPath

            if ($tasks.Count -eq 0) {
                $noTaskItem = New-Object System.Windows.Forms.ToolStripMenuItem
                $noTaskItem.Text = "(No active tasks)"
                $noTaskItem.Enabled = $false
                $tasksMenu.DropDownItems.Add($noTaskItem) | Out-Null
            } else {
                foreach ($task in $tasks) {
                    $taskMenu = New-Object System.Windows.Forms.ToolStripMenuItem
                    $maxIterLabel = if ($task.maxIterations -eq 0) { "∞" } else { $task.maxIterations }
                    $taskMenu.Text = "$($task.id) [$($task.status)] (iter: $($task.iteration)/$maxIterLabel)"

                    $taskPath = $task.path
                    $taskId = $task.id
                    $taskLocation = $task.location

                    # View task file
                    $viewTaskItem = New-Object System.Windows.Forms.ToolStripMenuItem
                    $viewTaskItem.Text = "View Task File"
                    $viewTaskItem.Add_Click({
                        Start-Process "notepad.exe" -ArgumentList $taskPath
                    }.GetNewClosure())
                    $taskMenu.DropDownItems.Add($viewTaskItem) | Out-Null

                    # View task log
                    $viewLogItem = New-Object System.Windows.Forms.ToolStripMenuItem
                    $viewLogItem.Text = "View Task Log"
                    $viewLogItem.Add_Click({
                        $logFile = Join-Path $projectPath "collaboration\.autoclaude\logs\tasks\$taskId.log"
                        if (Test-Path $logFile) {
                            Start-Process "notepad.exe" -ArgumentList $logFile
                        } else {
                            Show-Notification -Title "AutoClaude" -Message "No log file for this task yet" -Icon Warning
                        }
                    }.GetNewClosure())
                    $taskMenu.DropDownItems.Add($viewLogItem) | Out-Null

                    $taskMenu.DropDownItems.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null

                    # Stop iterations (approve on next review)
                    $stopIterItem = New-Object System.Windows.Forms.ToolStripMenuItem
                    $stopIterItem.Text = "Stop After Current Review"
                    $stopIterItem.Add_Click({
                        if (Stop-TaskIteration -TaskPath $taskPath) {
                            Show-Notification -Title "AutoClaude" -Message "Task '$taskId' will be approved after current review"
                            Write-TrayLog "Stopped iteration for task: $taskId"
                        } else {
                            Show-Notification -Title "AutoClaude" -Message "Failed to update task" -Icon Error
                        }
                    }.GetNewClosure())
                    $taskMenu.DropDownItems.Add($stopIterItem) | Out-Null

                    # Approve now
                    $approveItem = New-Object System.Windows.Forms.ToolStripMenuItem
                    $approveItem.Text = "Approve Now (Skip Review)"
                    $approveItem.Add_Click({
                        $result = [System.Windows.Forms.MessageBox]::Show(
                            "Are you sure you want to approve this task immediately?`n`nTask: $taskId`n`nThis will skip any remaining reviews and mark the task as completed.",
                            "Confirm Approval",
                            [System.Windows.Forms.MessageBoxButtons]::YesNo,
                            [System.Windows.Forms.MessageBoxIcon]::Question
                        )
                        if ($result -eq [System.Windows.Forms.DialogResult]::Yes) {
                            if (Approve-Task -TaskPath $taskPath -ProjectPath $projectPath) {
                                Show-Notification -Title "AutoClaude" -Message "Task '$taskId' approved and moved to completed"
                                Write-TrayLog "Manually approved task: $taskId"
                            } else {
                                Show-Notification -Title "AutoClaude" -Message "Failed to approve task" -Icon Error
                            }
                        }
                    }.GetNewClosure())
                    $taskMenu.DropDownItems.Add($approveItem) | Out-Null

                    $tasksMenu.DropDownItems.Add($taskMenu) | Out-Null
                }
            }

            $subMenu.DropDownItems.Add($tasksMenu) | Out-Null

            $subMenu.DropDownItems.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null

            # Remove project
            $removeItem = New-Object System.Windows.Forms.ToolStripMenuItem
            $removeItem.Text = "Remove Project"
            $removeItem.Add_Click({
                $projects = Get-Projects
                $projects = @($projects | Where-Object { $_.name -ne $projectName })
                Save-Projects -Projects $projects
                Update-TrayTooltip
                Show-Notification -Title "AutoClaude" -Message "Project $projectName removed"
            }.GetNewClosure())
            $subMenu.DropDownItems.Add($removeItem) | Out-Null

            $menu.Items.Add($subMenu) | Out-Null
        }
    }

    $menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null

    # Start/Stop Watcher
    $watcherItem = New-Object System.Windows.Forms.ToolStripMenuItem
    if ($global:WatcherProcess -and -not $global:WatcherProcess.HasExited) {
        $watcherItem.Text = "Stop Monitoring"
        $watcherItem.Add_Click({
            Stop-Watcher
            Show-Notification -Title "AutoClaude" -Message "Monitoring stopped"
        })
    } else {
        $watcherItem.Text = "Start Monitoring"
        $watcherItem.Add_Click({
            Start-Watcher
            Show-Notification -Title "AutoClaude" -Message "Monitoring started"
        })
    }
    $menu.Items.Add($watcherItem) | Out-Null

    # View logs submenu
    $logMenu = New-Object System.Windows.Forms.ToolStripMenuItem
    $logMenu.Text = "View Logs"

    # Tray log
    $trayLogItem = New-Object System.Windows.Forms.ToolStripMenuItem
    $trayLogItem.Text = "Tray Application Log"
    $trayLogItem.Add_Click({
        $logFile = Join-Path $AppDataDir "tray.log"
        if (Test-Path $logFile) {
            Start-Process "notepad.exe" -ArgumentList $logFile
        } else {
            Show-Notification -Title "AutoClaude" -Message "Log file does not exist" -Icon Warning
        }
    })
    $logMenu.DropDownItems.Add($trayLogItem) | Out-Null

    $logMenu.DropDownItems.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null

    # Project task logs
    if ($projects.Count -gt 0) {
        foreach ($project in $projects) {
            $projectLogItem = New-Object System.Windows.Forms.ToolStripMenuItem
            $projectLogItem.Text = "$($project.name) Logs"
            $projectPath = $project.path

            # Open logs folder
            $openLogFolderItem = New-Object System.Windows.Forms.ToolStripMenuItem
            $openLogFolderItem.Text = "Open Logs Folder"
            $openLogFolderItem.Add_Click({
                $logDir = Join-Path $projectPath "collaboration\.autoclaude\logs"
                if (Test-Path $logDir) {
                    Start-Process "explorer.exe" -ArgumentList $logDir
                } else {
                    Show-Notification -Title "AutoClaude" -Message "No logs yet for this project" -Icon Warning
                }
            }.GetNewClosure())
            $projectLogItem.DropDownItems.Add($openLogFolderItem) | Out-Null

            # View task logs (launch view-logs.ps1)
            $viewTaskLogsItem = New-Object System.Windows.Forms.ToolStripMenuItem
            $viewTaskLogsItem.Text = "View Task Logs"
            $viewTaskLogsItem.Add_Click({
                $viewLogsScript = Join-Path $ScriptsDir "view-logs.ps1"
                if (Test-Path $viewLogsScript) {
                    Start-Process "powershell.exe" -ArgumentList "-ExecutionPolicy Bypass -NoExit -File `"$viewLogsScript`" -ProjectPath `"$projectPath`""
                } else {
                    # Fallback: open logs folder
                    $logDir = Join-Path $projectPath "collaboration\.autoclaude\logs"
                    if (Test-Path $logDir) {
                        Start-Process "explorer.exe" -ArgumentList $logDir
                    }
                }
            }.GetNewClosure())
            $projectLogItem.DropDownItems.Add($viewTaskLogsItem) | Out-Null

            # Today's executor log
            $executorLogItem = New-Object System.Windows.Forms.ToolStripMenuItem
            $executorLogItem.Text = "Today's Executor Log"
            $executorLogItem.Add_Click({
                $logFile = Join-Path $projectPath "collaboration\.autoclaude\logs\executor_$(Get-Date -Format 'yyyyMMdd').log"
                if (Test-Path $logFile) {
                    Start-Process "notepad.exe" -ArgumentList $logFile
                } else {
                    Show-Notification -Title "AutoClaude" -Message "No executor log for today" -Icon Warning
                }
            }.GetNewClosure())
            $projectLogItem.DropDownItems.Add($executorLogItem) | Out-Null

            # Today's supervisor log
            $supervisorLogItem = New-Object System.Windows.Forms.ToolStripMenuItem
            $supervisorLogItem.Text = "Today's Supervisor Log"
            $supervisorLogItem.Add_Click({
                $logFile = Join-Path $projectPath "collaboration\.autoclaude\logs\supervisor_$(Get-Date -Format 'yyyyMMdd').log"
                if (Test-Path $logFile) {
                    Start-Process "notepad.exe" -ArgumentList $logFile
                } else {
                    Show-Notification -Title "AutoClaude" -Message "No supervisor log for today" -Icon Warning
                }
            }.GetNewClosure())
            $projectLogItem.DropDownItems.Add($supervisorLogItem) | Out-Null

            $logMenu.DropDownItems.Add($projectLogItem) | Out-Null
        }
    }

    $menu.Items.Add($logMenu) | Out-Null

    $menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null

    # Exit
    $exitItem = New-Object System.Windows.Forms.ToolStripMenuItem
    $exitItem.Text = "Exit"
    $exitItem.Add_Click({
        Stop-Watcher
        $global:NotifyIcon.Visible = $false
        $global:NotifyIcon.Dispose()
        [System.Windows.Forms.Application]::Exit()
    })
    $menu.Items.Add($exitItem) | Out-Null

    return $menu
}

# Start Watcher
function Start-Watcher {
    if ($global:WatcherProcess -and -not $global:WatcherProcess.HasExited) {
        Write-TrayLog "Watcher already running"
        return
    }

    $watcherScript = Join-Path $ScriptsDir "watcher.ps1"
    if (Test-Path $watcherScript) {
        $global:WatcherProcess = Start-Process -FilePath "powershell.exe" `
            -ArgumentList "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$watcherScript`"" `
            -WindowStyle Hidden -PassThru

        Write-TrayLog "Watcher started, PID: $($global:WatcherProcess.Id)"
    } else {
        Write-TrayLog "Watcher script not found: $watcherScript"
        Show-Notification -Title "AutoClaude" -Message "Cannot start monitoring: script not found" -Icon Error
    }
}

# Stop Watcher
function Stop-Watcher {
    if ($global:WatcherProcess -and -not $global:WatcherProcess.HasExited) {
        $global:WatcherProcess.Kill()
        $global:WatcherProcess = $null
        Write-TrayLog "Watcher stopped"
    }
}

# Create tray icon
function Initialize-TrayIcon {
    # Create icon (use system icon)
    $iconPath = Join-Path $AppDir "installer\assets\autoclaude.ico"
    if (Test-Path $iconPath) {
        $icon = New-Object System.Drawing.Icon($iconPath)
    } else {
        # Use default icon
        $icon = [System.Drawing.SystemIcons]::Application
    }

    # Create NotifyIcon
    $global:NotifyIcon = New-Object System.Windows.Forms.NotifyIcon
    $global:NotifyIcon.Icon = $icon
    $global:NotifyIcon.Visible = $true
    $global:NotifyIcon.Text = "AutoClaude - Loading..."

    # Click event - refresh menu
    $global:NotifyIcon.Add_MouseClick({
        param($sender, $e)
        if ($e.Button -eq [System.Windows.Forms.MouseButtons]::Right) {
            $global:ContextMenu = Build-ContextMenu
            $global:NotifyIcon.ContextMenuStrip = $global:ContextMenu
        }
    })

    # Double-click event - open first project directory
    $global:NotifyIcon.Add_DoubleClick({
        $projects = Get-Projects
        if ($projects.Count -gt 0) {
            Start-Process "explorer.exe" -ArgumentList $projects[0].path
        }
    })

    # Initial menu
    $global:ContextMenu = Build-ContextMenu
    $global:NotifyIcon.ContextMenuStrip = $global:ContextMenu

    Update-TrayTooltip
}

# Timer for periodic updates
function Start-UpdateTimer {
    $global:Timer = New-Object System.Windows.Forms.Timer
    $global:Timer.Interval = 30000  # 30 seconds
    $global:Timer.Add_Tick({
        Update-TrayTooltip
    })
    $global:Timer.Start()
}

# Main function
function Main {
    Write-TrayLog "AutoClaude tray application started"

    Initialize-TrayIcon
    Start-UpdateTimer

    # Auto-start Watcher
    Start-Watcher

    Show-Notification -Title "AutoClaude" -Message "Tray application started`nRight-click icon for menu"

    # Run message loop
    [System.Windows.Forms.Application]::Run()

    Write-TrayLog "AutoClaude tray application exited"
}

# Execute
Main
