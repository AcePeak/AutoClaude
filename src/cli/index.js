#!/usr/bin/env node

const { program } = require('commander');
const path = require('path');
const fs = require('fs');

// Define package info
const packageJson = require('../../package.json');

program
  .name('autoclaude')
  .description('AutoClaude - Multi-AI agent collaboration tool')
  .version(packageJson.version);

// Init command
program
  .command('init [directory]')
  .description('Initialize a directory for AutoClaude')
  .option('-n, --name <name>', 'Project name')
  .action((directory, options) => {
    const projectPath = directory ? path.resolve(directory) : process.cwd();

    if (!fs.existsSync(projectPath)) {
      console.error(`Directory not found: ${projectPath}`);
      process.exit(1);
    }

    const { initProjectSync } = require('./init');
    initProjectSync(projectPath, { name: options.name });

    console.log(`\nAutoClaude initialized in: ${projectPath}`);
    console.log('\nNext steps:');
    console.log('1. Write requirements in collaboration/inbox.md');
    console.log('2. Start AutoClaude to begin processing');
  });

// Status command
program
  .command('status [directory]')
  .description('Show task status for a project')
  .action((directory) => {
    const projectPath = directory ? path.resolve(directory) : process.cwd();
    const { getCollabDir } = require('../utils/paths');
    const collabDir = getCollabDir(projectPath);

    if (!fs.existsSync(collabDir)) {
      console.error('Project not initialized. Run: autoclaude init');
      process.exit(1);
    }

    const dashboard = require('../core/dashboard');
    const tasks = dashboard.getAllTasks(projectPath);

    console.log(`\nProject: ${path.basename(projectPath)}`);
    console.log('─'.repeat(40));
    console.log(`Queue:     ${tasks.queue.length} tasks`);
    console.log(`Executing: ${tasks.executing.length} tasks`);
    console.log(`Completed: ${tasks.completed.length} tasks`);

    if (tasks.executing.length > 0) {
      console.log('\nCurrently executing:');
      for (const task of tasks.executing) {
        console.log(`  - ${task.id}: ${task.description || '(no description)'}`);
      }
    }

    if (tasks.queue.length > 0) {
      console.log('\nIn queue:');
      for (const task of tasks.queue.slice(0, 5)) {
        console.log(`  - ${task.id}: ${task.description || '(no description)'}`);
      }
      if (tasks.queue.length > 5) {
        console.log(`  ... and ${tasks.queue.length - 5} more`);
      }
    }
  });

// Watcher command
program
  .command('watch')
  .description('Start the watcher (checks for tasks)')
  .option('--once', 'Run once and exit')
  .action((options) => {
    const Watcher = require('../core/watcher');
    const watcher = new Watcher();

    if (options.once) {
      watcher.runOnce().then(() => {
        console.log('Single check complete');
        process.exit(0);
      });
    } else {
      watcher.start();
      console.log('Watcher started. Press Ctrl+C to stop.');

      process.on('SIGINT', () => {
        watcher.stop();
        process.exit(0);
      });
    }
  });

// Start command (daemon mode)
program
  .command('start [directory]')
  .description('Start the watcher daemon')
  .option('-d, --daemon', 'Run as daemon in background')
  .action((directory, options) => {
    const projectPath = directory ? path.resolve(directory) : process.cwd();
    const { getCollabDir } = require('../utils/paths');
    const collabDir = getCollabDir(projectPath);

    if (!fs.existsSync(collabDir)) {
      console.error('Project not initialized. Run: autoclaude init');
      process.exit(1);
    }

    const Watcher = require('../core/watcher');
    const watcher = new Watcher();

    if (options.daemon) {
      const { startDaemon } = require('../utils/daemon');
      
      try {
        const result = startDaemon(projectPath);
        console.log(`AutoClaude watcher started as daemon (PID: ${result.pid})`);
        console.log(`Project: ${projectPath}`);
      } catch (error) {
        console.error(`Failed to start daemon: ${error.message}`);
        process.exit(1);
      }
    } else {
      watcher.start();
      console.log('AutoClaude watcher started. Press Ctrl+C to stop.');

      process.on('SIGINT', () => {
        watcher.stop();
        console.log('\nWatcher stopped.');
        process.exit(0);
      });
    }
  });

// Stop command
program
  .command('stop')
  .description('Stop the watcher daemon')
  .action(() => {
    const { stopDaemon } = require('../utils/daemon');
    
    try {
      const result = stopDaemon();
      if (result.success) {
        console.log(`AutoClaude daemon stopped (PID: ${result.pid})`);
      } else {
        console.log('No AutoClaude daemon found running');
      }
    } catch (error) {
      console.error(`Failed to stop daemon: ${error.message}`);
      process.exit(1);
    }
  });

// Task command
program
  .command('task <description>')
  .description('Create a new task')
  .option('-p, --priority <priority>', 'Task priority (low|normal|high)', 'normal')
  .action((description, options) => {
    const projectPath = process.cwd();
    const { getCollabDir } = require('../utils/paths');
    const collabDir = getCollabDir(projectPath);

    if (!fs.existsSync(collabDir)) {
      console.error('Project not initialized. Run: autoclaude init');
      process.exit(1);
    }

    const queueDir = path.join(collabDir, 'queue');
    if (!fs.existsSync(queueDir)) {
      fs.mkdirSync(queueDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const shortDesc = description.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '-').toLowerCase().slice(0, 30);
    const filename = `task_${timestamp}_${shortDesc}.md`;
    const taskPath = path.join(queueDir, filename);

    const taskId = `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const taskContent = `---
id: ${taskId}
status: PENDING
priority: ${options.priority}
created: ${new Date().toISOString()}
source: cli
---
## Task Description
${description}

## Acceptance Criteria
- Task completion requirements to be defined
- Verify functionality works as expected
- Code follows project standards

## Notes
Task created via CLI command.
`;

    fs.writeFileSync(taskPath, taskContent, 'utf8');
    console.log(`Task created: ${filename}`);
    console.log(`Task ID: ${taskId}`);
  });

// Dashboard command
program
  .command('dashboard [directory]')
  .description('Generate and open the dashboard')
  .action((directory) => {
    const projectPath = directory ? path.resolve(directory) : process.cwd();
    const { getCollabDir } = require('../utils/paths');
    const collabDir = getCollabDir(projectPath);

    if (!fs.existsSync(collabDir)) {
      console.error('Project not initialized. Run: autoclaude init');
      process.exit(1);
    }

    const dashboard = require('../core/dashboard');
    const dashboardPath = dashboard.generate(projectPath);
    console.log(`Dashboard generated: ${dashboardPath}`);

    // Try to open in browser
    const { exec } = require('child_process');
    const platform = process.platform;

    if (platform === 'win32') {
      exec(`start "" "${dashboardPath}"`);
    } else if (platform === 'darwin') {
      exec(`open "${dashboardPath}"`);
    } else {
      exec(`xdg-open "${dashboardPath}"`);
    }
  });

// Projects command
program
  .command('projects')
  .description('List registered projects')
  .action(() => {
    const { loadProjects } = require('../utils/projects');
    const projects = loadProjects();

    if (projects.length === 0) {
      console.log('No projects registered.');
      console.log('Run "autoclaude init <directory>" to register a project.');
      return;
    }

    console.log('\nRegistered projects:');
    console.log('─'.repeat(60));

    for (const project of projects) {
      const status = project.enabled ? '[ON]' : '[OFF]';
      console.log(`${status} ${project.name}`);
      console.log(`    Path: ${project.path}`);
      console.log(`    Last activity: ${project.last_activity || 'Never'}`);
    }
  });

// Context menu command
program
  .command('context-menu')
  .description('Manage Windows context menu integration')
  .addCommand(
    program.createCommand('install')
      .description('Install context menu entries (Windows only)')
      .action(() => {
        if (process.platform !== 'win32') {
          console.error('Context menu integration is only available on Windows');
          process.exit(1);
        }

        const { registerContextMenu } = require('../utils/context-menu');
        
        try {
          const result = registerContextMenu();
          if (result.success) {
            console.log('✓ Context menu entries installed successfully');
            console.log('');
            console.log('You can now right-click on any folder and use:');
            console.log('  • Initialize AutoClaude Project');
            console.log('  • Open Claude');
            console.log('  • View AutoClaude Dashboard');
          } else {
            console.error(`Failed to install context menu: ${result.message}`);
            process.exit(1);
          }
        } catch (error) {
          console.error(`Error installing context menu: ${error.message}`);
          process.exit(1);
        }
      })
  )
  .addCommand(
    program.createCommand('uninstall')
      .description('Remove context menu entries (Windows only)')
      .action(() => {
        if (process.platform !== 'win32') {
          console.error('Context menu integration is only available on Windows');
          process.exit(1);
        }

        const { unregisterContextMenu } = require('../utils/context-menu');
        
        try {
          const result = unregisterContextMenu();
          if (result.success) {
            console.log('✓ Context menu entries removed successfully');
          } else {
            console.error(`Failed to remove context menu: ${result.message}`);
            process.exit(1);
          }
        } catch (error) {
          console.error(`Error removing context menu: ${error.message}`);
          process.exit(1);
        }
      })
  );

program.parse();
