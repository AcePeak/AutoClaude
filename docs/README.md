# AutoClaude User Guide

AutoClaude is a Windows tool that enables file-system-based multi-AI agent collaboration, supporting 24/7 continuous development.

## Installation

1. Run `AutoClaude_Setup_x.x.x.exe`
2. Follow the installation wizard
3. Recommended options:
   - Add context menu items
   - Start automatically at login

## Quick Start

### 1. Initialize a Project

**Right-click** in any folder's empty space and select **"Initialize AutoClaude Project"**.

This creates the following directory structure:

```
your-project/
├── collaboration/
│   ├── queue/              # Pending tasks
│   ├── executing/          # Executing tasks
│   ├── completed/          # Completed tasks
│   ├── .autoclaude/        # System config
│   ├── inbox.md            # Requirements inbox
│   ├── project_plan.md     # Project plan
│   ├── SUPERVISOR_GUIDE.md # Supervisor guide
│   └── EXECUTOR_GUIDE.md   # Executor guide
└── .claude/
    └── CLAUDE.md           # Claude interaction rules
```

### 2. Add Tasks

There are two ways to add tasks:

**Method 1: Conversational (Recommended)**

1. Right-click and select **"Open Claude"**
2. In Claude, say something like:
   - "This is a continuous task: implement user login"
   - "Add to queue: optimize database queries"
   - "Background task: write unit tests"

Claude will automatically write the task to the queue.

**Method 2: Direct Edit inbox.md**

Write requirements in `collaboration/inbox.md`, Supervisor will process automatically.

### 3. Automatic Task Execution

The system automatically:
1. **Supervisor** analyzes requirements, creates tasks
2. **Executor** claims and executes tasks
3. **Supervisor** reviews results
4. Completed tasks are archived to `completed/`

### 4. Check Status

- **Tray icon**: Right-click to see all project status
- **collaboration directory**: View task files directly

## System Tray

After installation, AutoClaude icon appears in system tray:

- **Right-click**: View project list, start/stop monitoring, view logs
- **Double-click**: Open first project directory

### Tray Menu Features

| Feature | Description |
|---------|-------------|
| Project list | Shows all registered projects and status |
| Open Directory | Opens project in File Explorer |
| Open Claude | Starts Claude CLI in project directory |
| Pause/Resume Monitoring | Toggle monitoring for individual project |
| Start/Stop Monitoring | Control global Watcher |
| View Logs | Opens tray application log |

## Configuration

Config file location: `collaboration/.autoclaude/config.json`

```json
{
  "check_interval_seconds": 60,    // Check interval (seconds)
  "max_executors": 5,              // Max parallel executors
  "task_timeout_minutes": 30,      // Task timeout
  "notify_on_complete": true,      // Notify on completion
  "notify_on_error": true,         // Notify on error
  "claude_path": "claude",         // Claude CLI path
  "auto_start": true               // Auto-start monitoring
}
```

## Task Status Reference

| Status | Description |
|--------|-------------|
| PENDING | Waiting to be processed |
| ASSIGNED | Assigned to an Executor |
| EXECUTING | Currently being executed |
| REVIEW | Waiting for Supervisor review |
| APPROVED | Review passed, archived |
| REJECTED | Review failed, re-queued |

## Multi-Project Support

You can initialize AutoClaude in multiple directories. The tray application manages all projects centrally.

## Troubleshooting

### Claude command not found

Ensure Claude CLI is installed:
```bash
npm install -g @anthropic-ai/claude-code
```

### Tasks not executing

1. Check if tray application is running
2. Check if project monitoring is enabled
3. View log files to troubleshoot

### Permission issues

Ensure Claude CLI has permissions configured. Edit `~/.claude/settings.json`:

```json
{
  "permissions": {
    "allow": ["Bash", "Read", "Edit", "Write"],
    "defaultMode": "acceptEdits"
  }
}
```

## Uninstallation

1. Control Panel → Programs and Features → AutoClaude → Uninstall
2. Uninstallation does not delete initialized project directories

## Technical Architecture

```
User → Claude conversation → Identifies "continuous task" → Writes to queue/
                                                                    ↓
Tray App ← Watcher (checks every minute) → Discovers new task
                                                                    ↓
                                                           Triggers Executor
                                                                    ↓
                                                      Claude -p executes task
                                                                    ↓
                                                           Submits for review
                                                                    ↓
                                                      Supervisor reviews
                                                                    ↓
                                                    Approved → Archive
                                                    Rejected → Re-queue
```

## Feedback & Support

For issues or suggestions, please submit an Issue on GitHub.
