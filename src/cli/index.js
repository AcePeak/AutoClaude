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

    const { initProject } = require('./init');
    initProject(projectPath, { name: options.name });

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

program.parse();
