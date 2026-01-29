# AutoClaude - Dashboard Generator
# Generates an HTML dashboard showing all tasks status
# Usage: generate-dashboard.ps1 -ProjectPath <path>

param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectPath
)

$ErrorActionPreference = "Stop"

# Load required assembly for HTML encoding
Add-Type -AssemblyName System.Web

$ProjectPath = [System.IO.Path]::GetFullPath($ProjectPath)
$CollabDir = Join-Path $ProjectPath "collaboration"
$DashboardPath = Join-Path $CollabDir "dashboard.html"

# Validate project
if (-not (Test-Path $CollabDir)) {
    Write-Host "Project not initialized: $ProjectPath" -ForegroundColor Red
    exit 1
}

# Get all tasks from all directories
function Get-AllTasks {
    $tasks = @{
        queue = @()
        executing = @()
        completed = @()
    }

    foreach ($dir in @("queue", "executing", "completed")) {
        $taskDir = Join-Path $CollabDir $dir
        if (Test-Path $taskDir) {
            $files = Get-ChildItem -Path $taskDir -Filter "*.md" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
            foreach ($file in $files) {
                $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
                $task = @{
                    id = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
                    name = $file.Name
                    path = $file.FullName
                    relativePath = "$dir/$($file.Name)"
                    location = $dir
                    status = "UNKNOWN"
                    priority = "normal"
                    iteration = 1
                    maxIterations = 3
                    created = $file.CreationTime.ToString("yyyy-MM-dd HH:mm")
                    modified = $file.LastWriteTime.ToString("yyyy-MM-dd HH:mm")
                    assignedTo = ""
                    description = ""
                    content = $content
                }

                if ($content -match "status:\s*(\w+)") { $task.status = $Matches[1] }
                if ($content -match "priority:\s*(\w+)") { $task.priority = $Matches[1] }
                if ($content -match "iteration:\s*(\d+)") { $task.iteration = [int]$Matches[1] }
                if ($content -match "max_iterations:\s*(\d+)") { $task.maxIterations = [int]$Matches[1] }
                if ($content -match "assigned_to:\s*(\S+)") { $task.assignedTo = $Matches[1] }
                if ($content -match "created:\s*([^\n]+)") { $task.created = $Matches[1].Trim() }
                if ($content -match "## Task Description\s*\n+([^\n]+)") {
                    $task.description = $Matches[1].Trim()
                }

                $tasks[$dir] += $task
            }
        }
    }

    return $tasks
}

# Get lock information
function Get-LockInfo {
    $locks = @{}
    $lockDir = Join-Path $CollabDir ".autoclaude\lock"

    if (Test-Path $lockDir) {
        $lockFiles = Get-ChildItem -Path $lockDir -Filter "*.lock" -ErrorAction SilentlyContinue
        foreach ($file in $lockFiles) {
            try {
                $lockContent = Get-Content $file.FullName -Raw | ConvertFrom-Json
                $taskId = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
                $locks[$taskId] = @{
                    executorId = $lockContent.executor_id
                    pid = $lockContent.pid
                    lockedAt = $lockContent.locked_at
                }
            } catch {}
        }
    }

    return $locks
}

# Get project metrics
function Get-Metrics {
    $metricsFile = Join-Path $CollabDir ".autoclaude\metrics.md"
    $metrics = @{
        totalCompletions = 0
        lastLightRefactor = "N/A"
        lastHeavyRefactor = "N/A"
    }

    if (Test-Path $metricsFile) {
        $content = Get-Content $metricsFile -Raw -ErrorAction SilentlyContinue
        if ($content -match "Total task completions\s*\|\s*(\d+)") {
            $metrics.totalCompletions = [int]$Matches[1]
        }
    }

    return $metrics
}

# Generate HTML
$tasks = Get-AllTasks
$locks = Get-LockInfo
$metrics = Get-Metrics
$projectName = Split-Path -Leaf $ProjectPath
$generatedTime = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

# Count stats
$totalQueue = $tasks.queue.Count
$totalExecuting = $tasks.executing.Count
$totalCompleted = $tasks.completed.Count

$html = @"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="refresh" content="30">
    <title>AutoClaude Dashboard - $projectName</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: #eee;
            min-height: 100vh;
            padding: 20px;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding: 20px;
            background: rgba(255,255,255,0.05);
            border-radius: 15px;
            backdrop-filter: blur(10px);
        }
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            background: linear-gradient(90deg, #00d2ff, #3a7bd5);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .header .meta {
            color: #888;
            font-size: 0.9em;
        }
        .stats {
            display: flex;
            justify-content: center;
            gap: 20px;
            margin-bottom: 30px;
            flex-wrap: wrap;
        }
        .stat-card {
            background: rgba(255,255,255,0.08);
            padding: 20px 40px;
            border-radius: 12px;
            text-align: center;
            min-width: 150px;
            border: 1px solid rgba(255,255,255,0.1);
        }
        .stat-card .number {
            font-size: 2.5em;
            font-weight: bold;
        }
        .stat-card .label {
            color: #888;
            margin-top: 5px;
        }
        .stat-card.queue .number { color: #ffd700; }
        .stat-card.executing .number { color: #00bfff; }
        .stat-card.completed .number { color: #00ff7f; }

        .section {
            margin-bottom: 30px;
        }
        .section-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid rgba(255,255,255,0.1);
        }
        .section-header h2 {
            font-size: 1.5em;
        }
        .section-header .badge {
            background: rgba(255,255,255,0.2);
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 0.8em;
        }

        .task-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
            gap: 15px;
        }
        .task-card {
            background: rgba(255,255,255,0.05);
            border-radius: 12px;
            padding: 20px;
            border: 1px solid rgba(255,255,255,0.1);
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .task-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        .task-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 10px;
        }
        .task-id {
            font-family: 'Consolas', monospace;
            font-size: 0.85em;
            color: #888;
            word-break: break-all;
        }
        .task-status {
            padding: 3px 10px;
            border-radius: 5px;
            font-size: 0.75em;
            font-weight: bold;
            text-transform: uppercase;
        }
        .status-PENDING { background: #ffd700; color: #000; }
        .status-EXECUTING { background: #00bfff; color: #000; }
        .status-REVIEW { background: #ff69b4; color: #000; }
        .status-APPROVED { background: #00ff7f; color: #000; }
        .status-COMPLETED { background: #00ff7f; color: #000; }
        .status-REJECTED { background: #ff4444; color: #fff; }

        .task-description {
            margin: 10px 0;
            color: #ccc;
            font-size: 0.95em;
            line-height: 1.4;
        }
        .task-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin: 10px 0;
            font-size: 0.8em;
            color: #888;
        }
        .task-meta span {
            background: rgba(255,255,255,0.05);
            padding: 3px 8px;
            border-radius: 4px;
        }
        .task-meta .priority-high { color: #ff4444; }
        .task-meta .priority-normal { color: #888; }
        .task-meta .priority-low { color: #4a9eff; }

        .task-actions {
            display: flex;
            gap: 8px;
            margin-top: 15px;
            flex-wrap: wrap;
        }
        .btn {
            padding: 6px 12px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 0.8em;
            transition: opacity 0.2s;
            text-decoration: none;
            display: inline-block;
        }
        .btn:hover { opacity: 0.8; }
        .btn-primary { background: #3a7bd5; color: #fff; }
        .btn-secondary { background: rgba(255,255,255,0.1); color: #fff; }
        .btn-success { background: #00aa55; color: #fff; }

        .executor-info {
            background: rgba(0,191,255,0.1);
            border: 1px solid rgba(0,191,255,0.3);
            border-radius: 8px;
            padding: 10px;
            margin-top: 10px;
            font-size: 0.85em;
        }
        .executor-info .label {
            color: #00bfff;
            font-weight: bold;
        }

        .iteration-bar {
            margin-top: 10px;
        }
        .iteration-bar .bar {
            height: 6px;
            background: rgba(255,255,255,0.1);
            border-radius: 3px;
            overflow: hidden;
        }
        .iteration-bar .progress {
            height: 100%;
            background: linear-gradient(90deg, #00d2ff, #3a7bd5);
            transition: width 0.3s;
        }
        .iteration-bar .text {
            font-size: 0.75em;
            color: #888;
            margin-top: 5px;
        }

        .empty-state {
            text-align: center;
            padding: 40px;
            color: #666;
        }

        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            z-index: 1000;
            overflow: auto;
        }
        .modal-content {
            background: #1a1a2e;
            margin: 50px auto;
            padding: 30px;
            border-radius: 15px;
            max-width: 800px;
            max-height: 80vh;
            overflow: auto;
            border: 1px solid rgba(255,255,255,0.1);
        }
        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        .modal-close {
            font-size: 1.5em;
            cursor: pointer;
            color: #888;
        }
        .modal-close:hover { color: #fff; }
        .modal-body pre {
            background: rgba(0,0,0,0.3);
            padding: 15px;
            border-radius: 8px;
            overflow: auto;
            white-space: pre-wrap;
            word-wrap: break-word;
            font-family: 'Consolas', monospace;
            font-size: 0.9em;
            line-height: 1.5;
        }

        .footer {
            text-align: center;
            margin-top: 40px;
            padding: 20px;
            color: #666;
            font-size: 0.85em;
        }
        .footer a {
            color: #3a7bd5;
            text-decoration: none;
        }

        @media (max-width: 600px) {
            .task-grid {
                grid-template-columns: 1fr;
            }
            .stats {
                flex-direction: column;
                align-items: center;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1> AutoClaude Dashboard</h1>
        <div class="meta">
            Project: <strong>$projectName</strong> |
            Last updated: $generatedTime |
            Total completions: $($metrics.totalCompletions)
        </div>
    </div>

    <div class="stats">
        <div class="stat-card queue">
            <div class="number">$totalQueue</div>
            <div class="label">In Queue</div>
        </div>
        <div class="stat-card executing">
            <div class="number">$totalExecuting</div>
            <div class="label">Executing</div>
        </div>
        <div class="stat-card completed">
            <div class="number">$totalCompleted</div>
            <div class="label">Completed</div>
        </div>
    </div>

"@

# Executing section
$html += @"
    <div class="section">
        <div class="section-header">
            <h2>[Running] Currently Executing</h2>
            <span class="badge">$totalExecuting tasks</span>
        </div>
        <div class="task-grid">
"@

if ($tasks.executing.Count -eq 0) {
    $html += '<div class="empty-state">No tasks currently executing</div>'
} else {
    foreach ($task in $tasks.executing) {
        $maxIterLabel = if ($task.maxIterations -eq 0) { "Inf" } else { $task.maxIterations }
        $iterProgress = if ($task.maxIterations -eq 0) { 50 } else { [Math]::Min(100, ($task.iteration / $task.maxIterations) * 100) }
        $lockInfo = $locks[$task.id]
        $escapedContent = [System.Web.HttpUtility]::HtmlEncode($task.content)

        $html += @"
            <div class="task-card">
                <div class="task-header">
                    <div class="task-id">$($task.id)</div>
                    <span class="task-status status-$($task.status)">$($task.status)</span>
                </div>
                <div class="task-description">$([System.Web.HttpUtility]::HtmlEncode($task.description))</div>
                <div class="task-meta">
                    <span class="priority-$($task.priority)">Priority: $($task.priority)</span>
                    <span>Modified: $($task.modified)</span>
                </div>
                <div class="iteration-bar">
                    <div class="bar"><div class="progress" style="width: $iterProgress%"></div></div>
                    <div class="text">Iteration $($task.iteration) / $maxIterLabel</div>
                </div>
"@
        if ($lockInfo) {
            $html += @"
                <div class="executor-info">
                    <span class="label">Executor:</span> $($lockInfo.executorId)<br>
                    <span class="label">PID:</span> $($lockInfo.pid)<br>
                    <span class="label">Started:</span> $($lockInfo.lockedAt)
                </div>
"@
        }
        $html += @"
                <div class="task-actions">
                    <button class="btn btn-primary" onclick="showTask('$($task.id)')">View Details</button>
                    <a class="btn btn-secondary" href="file:///$($task.path.Replace('\','/'))" target="_blank">Open File</a>
                </div>
            </div>
            <script>
                var taskContent_$($task.id.Replace('-','_').Replace('.','_')) = `$escapedContent`;
            </script>
"@
    }
}

$html += @"
        </div>
    </div>
"@

# Queue section
$html += @"
    <div class="section">
        <div class="section-header">
            <h2>[Queue] Queued Tasks</h2>
            <span class="badge">$totalQueue tasks</span>
        </div>
        <div class="task-grid">
"@

if ($tasks.queue.Count -eq 0) {
    $html += '<div class="empty-state">No tasks in queue</div>'
} else {
    foreach ($task in $tasks.queue) {
        $maxIterLabel = if ($task.maxIterations -eq 0) { "Inf" } else { $task.maxIterations }
        $iterProgress = if ($task.maxIterations -eq 0) { 50 } else { [Math]::Min(100, ($task.iteration / $task.maxIterations) * 100) }
        $escapedContent = [System.Web.HttpUtility]::HtmlEncode($task.content)

        $html += @"
            <div class="task-card">
                <div class="task-header">
                    <div class="task-id">$($task.id)</div>
                    <span class="task-status status-$($task.status)">$($task.status)</span>
                </div>
                <div class="task-description">$([System.Web.HttpUtility]::HtmlEncode($task.description))</div>
                <div class="task-meta">
                    <span class="priority-$($task.priority)">Priority: $($task.priority)</span>
                    <span>Created: $($task.created)</span>
                </div>
                <div class="iteration-bar">
                    <div class="bar"><div class="progress" style="width: $iterProgress%"></div></div>
                    <div class="text">Iteration $($task.iteration) / $maxIterLabel</div>
                </div>
                <div class="task-actions">
                    <button class="btn btn-primary" onclick="showTask('$($task.id)')">View Details</button>
                    <a class="btn btn-secondary" href="file:///$($task.path.Replace('\','/'))" target="_blank">Open File</a>
                </div>
            </div>
            <script>
                var taskContent_$($task.id.Replace('-','_').Replace('.','_')) = `$escapedContent`;
            </script>
"@
    }
}

$html += @"
        </div>
    </div>
"@

# Completed section
$html += @"
    <div class="section">
        <div class="section-header">
            <h2>[Done] Completed Tasks</h2>
            <span class="badge">$totalCompleted tasks</span>
        </div>
        <div class="task-grid">
"@

if ($tasks.completed.Count -eq 0) {
    $html += '<div class="empty-state">No completed tasks yet</div>'
} else {
    # Show only last 10 completed tasks
    $recentCompleted = $tasks.completed | Select-Object -First 10
    foreach ($task in $recentCompleted) {
        $escapedContent = [System.Web.HttpUtility]::HtmlEncode($task.content)

        $html += @"
            <div class="task-card">
                <div class="task-header">
                    <div class="task-id">$($task.id)</div>
                    <span class="task-status status-$($task.status)">$($task.status)</span>
                </div>
                <div class="task-description">$([System.Web.HttpUtility]::HtmlEncode($task.description))</div>
                <div class="task-meta">
                    <span>Completed: $($task.modified)</span>
                    <span>Iterations: $($task.iteration)</span>
                </div>
                <div class="task-actions">
                    <button class="btn btn-primary" onclick="showTask('$($task.id)')">View Details</button>
                    <a class="btn btn-secondary" href="file:///$($task.path.Replace('\','/'))" target="_blank">Open File</a>
                </div>
            </div>
            <script>
                var taskContent_$($task.id.Replace('-','_').Replace('.','_')) = `$escapedContent`;
            </script>
"@
    }
    if ($tasks.completed.Count -gt 10) {
        $html += "<div class='empty-state'>... and $($tasks.completed.Count - 10) more completed tasks</div>"
    }
}

$html += @"
        </div>
    </div>
"@

# Modal and footer
$html += @"
    <div id="taskModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h3 id="modalTitle">Task Details</h3>
                <span class="modal-close" onclick="closeModal()">&times;</span>
            </div>
            <div class="modal-body">
                <pre id="modalContent"></pre>
            </div>
        </div>
    </div>

    <div class="footer">
        <p>AutoClaude Dashboard | Auto-refreshes every 30 seconds</p>
        <p><a href="https://github.com/AcePeak/AutoClaude" target="_blank">GitHub</a> |
           <a href="https://github.com/sponsors/AcePeak" target="_blank">Sponsor</a></p>
    </div>

    <script>
        function showTask(taskId) {
            var varName = 'taskContent_' + taskId.replace(/-/g, '_').replace(/\./g, '_');
            var content = window[varName] || 'Content not available';
            document.getElementById('modalTitle').textContent = taskId;
            document.getElementById('modalContent').textContent = decodeHtml(content);
            document.getElementById('taskModal').style.display = 'block';
        }

        function closeModal() {
            document.getElementById('taskModal').style.display = 'none';
        }

        function decodeHtml(html) {
            var txt = document.createElement('textarea');
            txt.innerHTML = html;
            return txt.value;
        }

        window.onclick = function(event) {
            var modal = document.getElementById('taskModal');
            if (event.target == modal) {
                modal.style.display = 'none';
            }
        }

        document.onkeydown = function(e) {
            if (e.key === 'Escape') {
                closeModal();
            }
        }
    </script>
</body>
</html>
"@

# Write HTML file
Set-Content -Path $DashboardPath -Value $html -Encoding UTF8

Write-Host "Dashboard generated: $DashboardPath" -ForegroundColor Green
