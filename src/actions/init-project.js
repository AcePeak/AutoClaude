#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const { initProjectSync } = require('../cli/init');

// Show system notification function
function showNotification(title, message, isError = false) {
  try {
    const { spawn } = require('child_process');
    if (process.platform === 'win32') {
      const script = `
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.MessageBox]::Show('${message.replace(/'/g, "''")}', '${title}', 'OK', '${isError ? 'Error' : 'Information'}')
      `;
      spawn('powershell', ['-Command', script], { stdio: 'ignore' });
    } else if (process.platform === 'darwin') {
      spawn('osascript', ['-e', `display notification "${message}" with title "${title}"`], { stdio: 'ignore' });
    } else {
      spawn('notify-send', [title, message], { stdio: 'ignore' });
    }
  } catch (error) {
    console.log(`[${isError ? 'ERROR' : 'INFO'}] ${title}: ${message}`);
  }
}

// Parse --path from argv
function parsePath(argv) {
  const args = argv || process.argv.slice(2);
  const idx = args.indexOf('--path');
  if (idx !== -1 && args[idx + 1]) {
    return path.resolve(args[idx + 1]);
  }
  return null;
}

// Main function
function main(overridePath) {
  const targetPath = overridePath || parsePath();

  if (!targetPath) {
    console.error('[ERROR] --path argument is required');
    process.exit(1);
    return;
  }

  try {
    console.log(`[INFO] Initializing AutoClaude project: ${targetPath}`);

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

if (require.main === module) {
  main();
}

module.exports = { main, parsePath };