# AutoClaude

[![GitHub Sponsors](https://img.shields.io/github/sponsors/AcePeak?style=flat-square&logo=github&label=Sponsors)](https://github.com/sponsors/AcePeak)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

File-system-based multi-AI agent collaboration tool supporting 24/7 continuous development.

## Features

- **Context menu integration**: Right-click to initialize project or open Claude
- **Natural language trigger**: Say "continuous task" in Claude to auto-create background tasks
- **Multi-agent collaboration**: Supervisor manages tasks, Executor executes tasks
- **Dynamic scaling**: Automatically adjusts Executor count based on task volume
- **System tray**: Centrally manage multiple projects, show status and notifications
- **Token efficient**: Lightweight watcher detects changes, no token consumption when idle

## Directory Structure

```
autoclaude/
├── installer/           # Inno Setup installation script
├── scripts/             # Core PowerShell scripts
│   ├── init-project.ps1    # Initialize project
│   ├── open-claude.ps1     # Open Claude
│   ├── watcher.ps1         # Lightweight watcher
│   ├── supervisor.ps1      # Supervisor script
│   └── executor.ps1        # Executor script
├── tray/                # Tray application
├── templates/           # Project templates
├── docs/                # Documentation
├── build.ps1            # Build script
└── README.md
```

## Building

### Prerequisites

1. Windows 10/11
2. PowerShell 5.1+
3. [Inno Setup 6](https://jrsoftware.org/isdl.php)
4. [Claude CLI](https://www.npmjs.com/package/@anthropic-ai/claude-code)

### Build Steps

```powershell
# 1. Clone project
git clone <repo-url>
cd autoclaude

# 2. (Optional) Add icon file
# Place autoclaude.ico in installer/assets/

# 3. Run build script
.\build.ps1
```

After build, installer is at `dist/AutoClaude_Setup_x.x.x.exe`.

## Development Testing

Test without building installer:

```powershell
# Initialize test project
.\scripts\init-project.ps1 -Path "C:\TestProject"

# Start tray application
.\tray\autoclaude-tray.ps1

# Run Watcher manually (single check)
.\scripts\watcher.ps1 -ProjectPath "C:\TestProject" -Once

# Run Supervisor manually
.\scripts\supervisor.ps1 -ProjectPath "C:\TestProject"

# Run Executor manually
.\scripts\executor.ps1 -ProjectPath "C:\TestProject"
```

## How It Works

```
1. User says "continuous task: xxx" in Claude
2. Claude identifies keyword, writes task to collaboration/queue/
3. Watcher checks queue/ directory every minute
4. Discovers new task → Triggers Executor
5. Executor claims task (file lock mechanism), submits for review when done
6. Supervisor reviews result, archives if approved, re-queues if rejected
```

## Configuration

Global config: `%APPDATA%\AutoClaude\projects.json`

Project config: `collaboration/.autoclaude/config.json`

## Support

If you find AutoClaude useful, consider supporting the project:

[![Sponsor](https://img.shields.io/badge/Sponsor-%E2%9D%A4-pink?style=for-the-badge&logo=github)](https://github.com/sponsors/AcePeak)

Your support helps maintain and improve this project!

## License

MIT
