# AutoClaude

[![GitHub Sponsors](https://img.shields.io/github/sponsors/AcePeak?style=flat-square&logo=github&label=Sponsors)](https://github.com/sponsors/AcePeak)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

**AutoClaude** is a Windows tool that enables multi-AI agent collaboration through a file-based task system, supporting 24/7 continuous development with automatic quality control.

## What is AutoClaude?

AutoClaude creates a collaboration system where multiple AI agents work together:

```
┌─────────────────────────────────────────────────────────────────┐
│  You: "This is a continuous task: build a login system"        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Claude recognizes keyword → Creates task file in queue/        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Executor: Picks up task → Writes code → Runs tests → Submit   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Supervisor: Reviews critically → Requests improvements         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    (Iterate 2-3 times)
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Final: High-quality, tested, well-structured code              │
└─────────────────────────────────────────────────────────────────┘
```

## Key Features

### 🚀 Easy to Start
- **Right-click integration**: Initialize any folder as an AutoClaude project
- **Natural language**: Just say "continuous task" in Claude to create tasks
- **System tray**: Manage all projects from one place

### 🔄 Iterative Quality Control
- **Critical Supervisor**: Reviews from multiple user perspectives (perfectionist, beginner, security auditor, etc.)
- **Customizable iterations**: Choose 1 (quick), 3 (default), or infinite refinement
- **Stop anytime**: Approve tasks via tray menu when satisfied

### 🧪 Automatic Testing
- **Self-testing**: Executor writes tests for every change
- **Cumulative tests**: Test suite grows with your project
- **Project-aware**: Different testing for software, business, or documentation projects

### 🏗️ Architecture Evolution
- **Light refactoring**: Every 5 tasks - clean up code, improve naming
- **Heavy refactoring**: Every 15 tasks - reassess architecture, apply design patterns
- **First principles**: Regular checks to ensure code matches requirements

### 📊 Visual Dashboard
- **Real-time overview**: HTML dashboard showing all tasks at a glance
- **Task history**: View pending, executing, and completed tasks
- **Quick actions**: View task details, logs, and executor info
- **Auto-refresh**: Dashboard updates every 30 seconds

### 🛡️ Reliability
- **Crash recovery**: If executor dies, another picks up the task
- **Per-task logs**: Full execution history for every task
- **No token waste**: Watcher only triggers AI when changes detected

## Quick Start

### Installation

1. Download the latest installer from [Releases](https://github.com/AcePeak/AutoClaude/releases)
2. Run `AutoClaude_Setup_x.x.x.exe`
3. Choose to add context menu items (recommended)
4. Done! The tray icon should appear

### Initialize a Project

1. **Right-click** in any folder
2. Select **"Initialize AutoClaude Project"**
3. A `collaboration/` folder will be created with all necessary files

### Create Your First Task

1. **Right-click** in the initialized folder
2. Select **"Open Claude"**
3. Tell Claude:
   ```
   This is a continuous task: Create a hello world web page
   ```
4. Claude will ask about iteration count:
   - Enter `3` for standard (recommended for first try)
   - Enter `0` for infinite refinement
   - Enter `1` for quick mode
5. Watch the magic happen! Check progress in the tray menu.

## How It Works

### Task Lifecycle

```
PENDING → EXECUTING → REVIEW → APPROVED
    ↑                    │
    └── REJECTED ←───────┘
        (iterate)
```

1. **PENDING**: Task waiting in queue
2. **EXECUTING**: Executor working on it
3. **REVIEW**: Waiting for Supervisor review
4. **REJECTED**: Needs improvements, back to queue
5. **APPROVED**: Done, moved to completed/

### Directory Structure

After initialization, your project will have:

```
your-project/
├── CLAUDE.md                    # Rules for recognizing continuous tasks
└── collaboration/
    ├── queue/                   # Pending tasks
    ├── executing/               # Tasks being worked on
    ├── completed/               # Finished tasks
    ├── inbox.md                 # Write requirements here
    ├── project_plan.md          # Project overview
    ├── dashboard.html           # Visual task dashboard
    ├── SUPERVISOR_GUIDE.md      # How Supervisor reviews
    ├── EXECUTOR_GUIDE.md        # How Executor works
    └── .autoclaude/
        ├── config.json          # Project settings
        ├── metrics.md           # Iteration tracking
        ├── logs/                # Execution logs
        │   └── tasks/           # Per-task logs
        └── tests/               # Test registry
            └── test_registry.md # All tests index
```

### Iteration Control

| Setting | Behavior |
|---------|----------|
| `max_iterations: 0` | Infinite - keeps improving until you manually approve |
| `max_iterations: 1` | Quick - approve if basics work |
| `max_iterations: 3` | Default - 2-3 rounds of refinement |
| `max_iterations: 5+` | Thorough - multiple polish rounds |

#### Stopping Infinite Iterations

From the **tray menu**:
1. Click on your project
2. Go to **Manage Tasks**
3. Find your task
4. Choose:
   - **Stop After Current Review**: Approve on next review
   - **Approve Now**: Immediately complete

## Tray Menu Guide

```
AutoClaude (right-click)
├── [Project Name] (Queue:2 Exec:1)
│   ├── Open Directory          # Open in Explorer
│   ├── Open Claude             # Start Claude CLI here
│   ├── Open Dashboard          # View task dashboard in browser
│   ├── Manage Tasks            # View/control active tasks
│   │   └── task_xxx [STATUS] (iter: N/M)
│   │       ├── View Task File
│   │       ├── View Task Log
│   │       ├── Stop After Current Review
│   │       └── Approve Now
│   ├── Pause Monitoring        # Temporarily disable
│   └── Remove Project          # Unregister project
├── Start/Stop Monitoring       # Control watcher
├── View Logs                   # Access all logs
│   ├── Tray Application Log
│   └── [Project] Logs
│       ├── Open Logs Folder
│       ├── View Task Logs
│       ├── Today's Executor Log
│       └── Today's Supervisor Log
└── Exit
```

## Configuration

Edit `collaboration/.autoclaude/config.json`:

```json
{
  "check_interval_seconds": 60,    // How often to check for changes
  "max_executors": 5,              // Max parallel executors
  "task_timeout_minutes": 30,      // Task timeout
  "supervisor": {
    "max_iterations": 3,           // Default max iterations
    "review_strictness": "high"    // How critical supervisor is
  }
}
```

## Trigger Keywords

Say these in Claude to create a continuous task:

**English:**
- "continuous task", "background task", "async task"
- "let supervisor handle", "add to queue"

**Chinese:**
- "不间断任务", "持续任务", "后台任务"
- "让supervisor处理", "加入队列"

## Advanced Usage

### Alternative: Using inbox.md

Instead of talking to Claude, you can write directly to `collaboration/inbox.md`:

```markdown
# Requirements Inbox

---

Please create a REST API with the following endpoints:
- GET /users - list all users
- POST /users - create a user
- GET /users/:id - get user by id

Use Express.js and include proper error handling.
```

The Supervisor will automatically convert this to task files.

### Viewing Logs

**Command line:**
```powershell
# View all logs overview
.\scripts\view-logs.ps1 -ProjectPath "C:\MyProject"

# View specific task log
.\scripts\view-logs.ps1 -ProjectPath "C:\MyProject" -TaskId task_xxx

# Follow log in real-time
.\scripts\view-logs.ps1 -ProjectPath "C:\MyProject" -TaskId task_xxx -Follow
```

**From tray:**
- Right-click → View Logs → [Project] Logs

### Viewing Dashboard

The dashboard provides a visual overview of all tasks:

**Access methods:**
1. **Right-click menu**: In any initialized folder, right-click → "View AutoClaude Dashboard"
2. **Tray menu**: Right-click tray → [Project Name] → Open Dashboard
3. **Direct**: Open `collaboration/dashboard.html` in your browser

**Dashboard features:**
- Task counts by status (pending, executing, completed)
- Detailed task cards with status, iteration progress, and description
- Click any task to view full task content
- Executor PID display for executing tasks
- Auto-refresh every 30 seconds

### Manual Testing

```powershell
# Run watcher once (no loop)
.\scripts\watcher.ps1 -ProjectPath "C:\MyProject" -Once

# Manually trigger supervisor
.\scripts\supervisor.ps1 -ProjectPath "C:\MyProject"

# Manually trigger executor
.\scripts\executor.ps1 -ProjectPath "C:\MyProject"
```

## Requirements

- Windows 10/11
- [Claude CLI](https://www.npmjs.com/package/@anthropic-ai/claude-code) installed
- PowerShell 5.1+

## Building from Source

```powershell
# Clone
git clone https://github.com/AcePeak/AutoClaude.git
cd AutoClaude

# Build installer (requires Inno Setup 6)
.\build.ps1
```

The installer will be at `dist/AutoClaude_Setup_x.x.x.exe`

## Creating a Release

Automated release to GitHub with version bumping:

```powershell
# Prerequisites: Install GitHub CLI and authenticate
# https://cli.github.com/
# gh auth login

# Patch release (1.0.0 -> 1.0.1)
.\release.ps1

# Minor release (1.0.1 -> 1.1.0)
.\release.ps1 -BumpType minor

# Major release (1.1.0 -> 2.0.0)
.\release.ps1 -BumpType major

# With custom release notes
.\release.ps1 -Message "Fixed critical bug in executor"
```

The release script will:
1. Bump version in `version.json` and `autoclaude.iss`
2. Build the installer
3. Commit and tag the version
4. Push to GitHub
5. Create GitHub Release with installer attached

## Troubleshooting

### Tray icon doesn't appear
- Check if `wscript.exe` is allowed by your antivirus
- Try running `tray\start-hidden.vbs` manually

### Tasks not being picked up
- Ensure watcher is running (check tray menu)
- Check `collaboration/.autoclaude/logs/` for errors
- Verify Claude CLI is installed: `claude --version`

### Task stuck in EXECUTING
- The executor may have crashed
- Watcher will detect orphaned tasks and restart them automatically
- Or manually restart via tray: Manage Tasks → Approve Now

## Support the Project

If you find AutoClaude useful, consider supporting its development:

[![Sponsor](https://img.shields.io/badge/Sponsor-%E2%9D%A4-pink?style=for-the-badge&logo=github)](https://github.com/sponsors/AcePeak)
[![PayPal](https://img.shields.io/badge/PayPal-Donate-blue?style=for-the-badge&logo=paypal)](https://paypal.me/AceLiatus)

## License

MIT License - see [LICENSE](LICENSE) for details.

---

**AutoClaude** - Let AI agents handle the heavy lifting while you focus on what matters.
