#!/usr/bin/env node

const { program } = require('commander');
const path = require('path');
const fs = require('fs');
const { initProjectSync } = require('../cli/init');

// Setup command line arguments
program
  .option('--path <directory>', 'Directory to initialize')
  .parse();

const options = program.opts();

// Determine target directory
let targetPath = options.path;
if (!targetPath) {
  console.error('[ERROR] --path argument is required');
  process.exit(1);
}

targetPath = path.resolve(targetPath);

// Show system notification function
function showNotification(title, message, isError = false) {
  try {
    if (process.platform === 'win32') {
      // Use PowerShell to show Windows toast notification
      const { spawn } = require('child_process');
      const script = `
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.MessageBox]::Show('${message.replace(/'/g, "''")}', '${title}', 'OK', '${isError ? 'Error' : 'Information'}')
      `;
      spawn('powershell', ['-Command', script], { stdio: 'ignore' });
    } else if (process.platform === 'darwin') {
      // macOS notification
      const { spawn } = require('child_process');
      spawn('osascript', ['-e', `display notification "${message}" with title "${title}"`], { stdio: 'ignore' });
    } else {
      // Linux notification
      const { spawn } = require('child_process');
      spawn('notify-send', [title, message], { stdio: 'ignore' });
    }
  } catch (error) {
    // Fallback to console output
    console.log(`[${isError ? 'ERROR' : 'INFO'}] ${title}: ${message}`);
  }
}

// Main function
function main() {
  try {
    console.log(`[INFO] Initializing AutoClaude project: ${targetPath}`);
    
    // Check if directory exists
    if (!fs.existsSync(targetPath)) {
      throw new Error(`Directory does not exist: ${targetPath}`);
    }

    if (!fs.statSync(targetPath).isDirectory()) {
      throw new Error(`Path is not a directory: ${targetPath}`);
    }

    // Check if already initialized
    const collabDir = path.join(targetPath, 'collaboration');
    if (fs.existsSync(collabDir)) {
      showNotification('AutoClaude', 'Project is already initialized!');
      console.log('[INFO] Project already initialized');
      return;
    }

    // Initialize project
    const projectName = path.basename(targetPath);
    initProjectSync(targetPath, { name: projectName });

    // Success
    showNotification('AutoClaude', `Project "${projectName}" initialized successfully!`);
    console.log(`[OK] AutoClaude project initialized: ${targetPath}`);
    console.log('');
    console.log('Next steps:');
    console.log('1. Write requirements in collaboration/inbox.md');
    console.log('2. Start AutoClaude to begin processing');

  } catch (error) {
    const message = error.message || 'Unknown error occurred';
    showNotification('AutoClaude Error', message, true);
    console.error(`[ERROR] ${message}`);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main();
}

module.exports = { main };