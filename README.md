# AutoClaude

[![GitHub Sponsors](https://img.shields.io/github/sponsors/AcePeak?style=flat-square&logo=github&label=Sponsors)](https://github.com/sponsors/AcePeak)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/autoclaude.svg?style=flat-square)](https://www.npmjs.com/package/autoclaude)

**AutoClaude** is a cross-platform tool that enables multi-AI agent collaboration through a file-based task system, supporting 24/7 continuous development with automatic quality control.

## What is AutoClaude?

AutoClaude creates a collaboration system where multiple AI agents work together:

```
┌─────────────────────────────────────────────────────────────────┐
│  You: Write requirements in collaboration/inbox.md             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Supervisor: Analyzes requirements → Creates task files        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Executor: Picks up task → Writes code → Runs tests → Submit   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Supervisor: Reviews critically → Approves or requests changes │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Final: High-quality, tested, well-structured code              │
└─────────────────────────────────────────────────────────────────┘
```

## Key Features

### 🌍 Cross-Platform
- **Windows, macOS, Linux**: Native support for all platforms
- **Node.js powered**: No PowerShell or shell script dependencies
- **npm installable**: Global CLI tool available anywhere

### 🚀 Easy to Start
```bash
# Install globally
npm install -g autoclaude

# Initialize any project
cd your-project
autoclaude init

# Start the watcher
autoclaude start
```

### 🔄 Intelligent Agent System
- **Supervisor**: Breaks down requirements into actionable tasks
- **Executor**: Implements tasks with testing and documentation
- **Watcher**: Monitors files and coordinates agent interactions
- **Quality Control**: Multiple review cycles ensure high-quality output

### 📋 Simple Task Management
```bash
# Create a task from command line
autoclaude task "Build a user authentication system"

# Check project status
autoclaude status

# View dashboard
autoclaude dashboard
```

### 🧪 Automatic Testing
- **Self-testing**: Executors write tests for every implementation
- **Continuous validation**: Test suite runs automatically
- **Coverage tracking**: Monitors test coverage and quality

## Installation

### Global Installation (Recommended)
```bash
npm install -g autoclaude
```

### Local Installation
```bash
npm install autoclaude
npx autoclaude init
```

### From Source
```bash
git clone https://github.com/AcePeak/AutoClaude.git
cd AutoClaude
npm install
npm link  # Makes `autoclaude` available globally
```

## Quick Start

### 1. Initialize a Project
```bash
cd your-project
autoclaude init
```

This creates:
- `collaboration/` directory with task management structure
- `collaboration/inbox.md` for writing requirements
- Configuration files and templates

### 2. Write Requirements
Edit `collaboration/inbox.md` and describe what you want built:
```markdown
# Requirements

Build a todo application with the following features:
- Add, edit, and delete tasks
- Mark tasks as complete
- Filter by status (all, active, completed)
- Persist data to localStorage
```

### 3. Start AutoClaude
```bash
autoclaude start
```

The watcher will:
1. Detect new requirements in inbox.md
2. Trigger the Supervisor to create task files
3. Executors will implement each task
4. Supervisor will review and approve completed work

## Commands

### Project Management
```bash
autoclaude init [directory]    # Initialize a project
autoclaude start [directory]   # Start the watcher
autoclaude stop                # Stop the watcher daemon
autoclaude status [directory]  # Show project status
```

### Task Management
```bash
autoclaude task "description"  # Create a new task
autoclaude dashboard           # Open project dashboard
autoclaude projects            # List all registered projects
```

### Development
```bash
autoclaude watch --once       # Run one check cycle
npm test                      # Run tests
npm run test:coverage         # Run tests with coverage
```

## Project Structure

After initialization, your project will have:

```
your-project/
├── collaboration/
│   ├── inbox.md              # Write requirements here
│   ├── queue/                # Tasks waiting to be executed
│   ├── executing/            # Tasks currently being worked on
│   ├── completed/            # Finished tasks
│   ├── SUPERVISOR_GUIDE.md   # Instructions for the Supervisor
│   ├── EXECUTOR_GUIDE.md     # Instructions for Executors
│   └── .autoclaude/
│       ├── config.json       # Project configuration
│       ├── logs/             # Execution logs
│       └── lock/             # Process lock files
├── src/                      # Your source code
└── tests/                    # Generated tests
```

## Configuration

### Project Configuration
Edit `collaboration/.autoclaude/config.json`:
```json
{
  "name": "My Project",
  "max_executors": 2,
  "check_interval_seconds": 60,
  "claude_path": "claude"
}
```

### Global Settings
AutoClaude stores global settings in your OS-appropriate config directory:
- **Windows**: `%APPDATA%\\AutoClaude\\settings.json`
- **macOS**: `~/Library/Application Support/AutoClaude/settings.json`
- **Linux**: `~/.config/autoclaude/settings.json`

## How It Works

### File-Based Communication
AutoClaude uses a file-based system for agent communication:

1. **Requirements** → `collaboration/inbox.md`
2. **Task Queue** → `collaboration/queue/*.md`
3. **In Progress** → `collaboration/executing/*.md`
4. **Completed** → `collaboration/completed/*.md`

### Agent Roles

#### Watcher
- Monitors file changes
- Triggers Supervisor when inbox has content
- Triggers Executors when queue has tasks
- Manages orphaned tasks and cleanup

#### Supervisor
- Analyzes requirements in inbox.md
- Breaks down complex requirements into specific tasks
- Reviews completed work for quality
- Decides approval/rejection with feedback

#### Executor
- Claims tasks from the queue
- Implements features with proper testing
- Submits completed work for review
- Handles task recovery and resumption

## Advanced Usage

### Multiple Projects
```bash
# List all registered projects
autoclaude projects

# Work with specific project
autoclaude status /path/to/project
autoclaude start /path/to/project
```

### Custom Task Templates
You can customize task templates by modifying the Supervisor guide:
```bash
vim collaboration/SUPERVISOR_GUIDE.md
vim collaboration/EXECUTOR_GUIDE.md
```

### Daemon Mode
```bash
# Start as background daemon
autoclaude start --daemon

# Check if running
ps aux | grep autoclaude
```

## Testing

AutoClaude includes a comprehensive test suite:

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific tests
npm test -- tests/core/watcher.test.js

# Watch mode during development
npm run test:watch
```

## Development

### Contributing
1. Fork the repository
2. Create a feature branch
3. Write tests for your changes
4. Ensure all tests pass
5. Submit a pull request

### Building
```bash
git clone https://github.com/AcePeak/AutoClaude.git
cd AutoClaude
npm install
npm test
```

### Architecture
- **src/core/**: Core agent implementations (Watcher, Supervisor, Executor)
- **src/cli/**: Command-line interface
- **src/utils/**: Utility functions and helpers
- **tests/**: Comprehensive test suite

## Troubleshooting

### Common Issues

#### "Claude not found"
Ensure the Claude CLI is installed and available in your PATH:
```bash
which claude  # Should return a path
claude --version  # Should show version
```

#### Permission Denied
On Unix systems, ensure the CLI script is executable:
```bash
chmod +x node_modules/.bin/autoclaude
```

#### Tasks Stuck
Check for orphaned lock files:
```bash
autoclaude status  # Shows current task states
```

### Logs
Check execution logs for detailed information:
```bash
ls collaboration/.autoclaude/logs/
tail -f collaboration/.autoclaude/logs/supervisor_*.log
```

## Migration from v2.x

AutoClaude v3.x is fully cross-platform and doesn't require PowerShell. Existing Windows projects should continue working, but for best compatibility:

1. Install via npm: `npm install -g autoclaude`
2. Use `autoclaude start` instead of PowerShell scripts
3. Update any custom scripts to use Node.js instead of PowerShell

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- 🐛 [Issues](https://github.com/AcePeak/AutoClaude/issues)
- 💡 [Discussions](https://github.com/AcePeak/AutoClaude/discussions)
- 💖 [Sponsor](https://github.com/sponsors/AcePeak)

---

**AutoClaude**: Where AI agents collaborate to build software, so you don't have to.