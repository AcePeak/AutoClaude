# AutoClaude - Project Initialization Script
# Usage: init-project.ps1 [-Path <directory_path>]

param(
    [Parameter(Position=0)]
    [string]$Path = (Get-Location).Path
)

$ErrorActionPreference = "Stop"

# Configuration
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$TemplatesDir = Join-Path (Split-Path -Parent $ScriptDir) "templates"
$AppDataDir = Join-Path $env:APPDATA "AutoClaude"
$ProjectsFile = Join-Path $AppDataDir "projects.json"

# Color output functions
function Write-Success { param($Message) Write-Host "[OK] $Message" -ForegroundColor Green }
function Write-Info { param($Message) Write-Host "[INFO] $Message" -ForegroundColor Cyan }
function Write-Warn { param($Message) Write-Host "[WARN] $Message" -ForegroundColor Yellow }
function Write-Err { param($Message) Write-Host "[ERROR] $Message" -ForegroundColor Red }

# Main function
function Initialize-AutoClaudeProject {
    param([string]$ProjectPath)

    $ProjectPath = [System.IO.Path]::GetFullPath($ProjectPath)
    Write-Info "Initializing AutoClaude project: $ProjectPath"

    # Check if directory exists
    if (-not (Test-Path $ProjectPath)) {
        Write-Err "Directory does not exist: $ProjectPath"
        exit 1
    }

    # Check if already initialized
    $CollabDir = Join-Path $ProjectPath "collaboration"
    if (Test-Path $CollabDir) {
        Write-Warn "Project already initialized. Reinitialize? (y/N)"
        $response = Read-Host
        if ($response -ne "y" -and $response -ne "Y") {
            Write-Info "Operation cancelled"
            exit 0
        }
    }

    # Create directory structure
    Write-Info "Creating directory structure..."

    $directories = @(
        "collaboration",
        "collaboration\queue",
        "collaboration\executing",
        "collaboration\completed",
        "collaboration\.autoclaude",
        "collaboration\.autoclaude\lock",
        "collaboration\.autoclaude\logs",
        ".claude"
    )

    foreach ($dir in $directories) {
        $fullPath = Join-Path $ProjectPath $dir
        if (-not (Test-Path $fullPath)) {
            New-Item -ItemType Directory -Path $fullPath -Force | Out-Null
            Write-Success "Created directory: $dir"
        }
    }

    # Copy template files
    Write-Info "Copying template files..."

    $templateMappings = @{
        "SUPERVISOR_GUIDE.md" = "collaboration\SUPERVISOR_GUIDE.md"
        "EXECUTOR_GUIDE.md" = "collaboration\EXECUTOR_GUIDE.md"
        "CLAUDE.md" = "CLAUDE.md"
        "config.json" = "collaboration\.autoclaude\config.json"
    }

    foreach ($template in $templateMappings.GetEnumerator()) {
        $sourcePath = Join-Path $TemplatesDir $template.Key
        $destPath = Join-Path $ProjectPath $template.Value

        if (Test-Path $sourcePath) {
            Copy-Item -Path $sourcePath -Destination $destPath -Force
            Write-Success "Copied: $($template.Key) -> $($template.Value)"
        } else {
            Write-Warn "Template file not found: $($template.Key)"
        }
    }

    # Create project_plan.md
    $projectPlanPath = Join-Path $ProjectPath "collaboration\project_plan.md"
    if (-not (Test-Path $projectPlanPath)) {
        $projectName = Split-Path -Leaf $ProjectPath
        $content = @"
# $projectName Project Plan

## Project Overview
(Describe project goals and scope here)

## Current Status
- Created: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
- Status: Initialization complete

## Milestones
- [ ] Milestone 1
- [ ] Milestone 2

## Task Statistics
- Pending: 0
- Executing: 0
- Completed: 0

## Update Log
- $(Get-Date -Format "yyyy-MM-dd"): Project initialized
"@
        Set-Content -Path $projectPlanPath -Value $content -Encoding UTF8
        Write-Success "Created: project_plan.md"
    }

    # Create inbox.md
    $inboxPath = Join-Path $ProjectPath "collaboration\inbox.md"
    if (-not (Test-Path $inboxPath)) {
        $content = @"
# Requirements Inbox

Write new requirements here, Supervisor will automatically process and convert to tasks.

---

"@
        Set-Content -Path $inboxPath -Value $content -Encoding UTF8
        Write-Success "Created: inbox.md"
    }

    # Register project to global config
    Register-Project -ProjectPath $ProjectPath

    Write-Host ""
    Write-Success "AutoClaude project initialization complete!"
    Write-Host ""
    Write-Info "Next steps:"
    Write-Host "  1. Edit collaboration/project_plan.md to describe project goals"
    Write-Host "  2. Open Claude in this directory, say 'continuous task' to add tasks"
    Write-Host "  3. Or write requirements directly in collaboration/inbox.md"
    Write-Host ""
}

# Register project to global config
function Register-Project {
    param([string]$ProjectPath)

    # Ensure AppData directory exists
    if (-not (Test-Path $AppDataDir)) {
        New-Item -ItemType Directory -Path $AppDataDir -Force | Out-Null
    }

    # Read or create projects.json
    $projects = @{ projects = @() }
    if (Test-Path $ProjectsFile) {
        try {
            $projects = Get-Content $ProjectsFile -Raw | ConvertFrom-Json
        } catch {
            Write-Warn "Cannot read projects.json, will recreate"
            $projects = @{ projects = @() }
        }
    }

    # Convert to modifiable array
    $projectList = @($projects.projects)

    # Check if already registered
    $existingIndex = -1
    for ($i = 0; $i -lt $projectList.Count; $i++) {
        if ($projectList[$i].path -eq $ProjectPath) {
            $existingIndex = $i
            break
        }
    }

    $projectName = Split-Path -Leaf $ProjectPath
    $newProject = @{
        path = $ProjectPath
        name = $projectName
        enabled = $true
        last_activity = (Get-Date -Format "o")
    }

    if ($existingIndex -ge 0) {
        $projectList[$existingIndex] = $newProject
        Write-Info "Updated project registration: $projectName"
    } else {
        $projectList += $newProject
        Write-Success "Registered new project: $projectName"
    }

    # Save
    $projects.projects = $projectList
    $projects | ConvertTo-Json -Depth 10 | Set-Content $ProjectsFile -Encoding UTF8
}

# Execute
Initialize-AutoClaudeProject -ProjectPath $Path
