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

    # View logs
    $logItem = New-Object System.Windows.Forms.ToolStripMenuItem
    $logItem.Text = "View Logs"
    $logItem.Add_Click({
        $logFile = Join-Path $AppDataDir "tray.log"
        if (Test-Path $logFile) {
            Start-Process "notepad.exe" -ArgumentList $logFile
        } else {
            Show-Notification -Title "AutoClaude" -Message "Log file does not exist" -Icon Warning
        }
    })
    $menu.Items.Add($logItem) | Out-Null

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
