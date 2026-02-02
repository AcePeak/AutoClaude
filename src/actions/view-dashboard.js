#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Show system notification function
function showNotification(title, message, isError = false) {
  try {
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

// Open file in default browser/application
function openFile(filePath) {
  let command, args;
  
  if (process.platform === 'win32') {
    // Windows
    command = 'cmd';
    args = ['/c', 'start', '""', `"${filePath}"`];
  } else if (process.platform === 'darwin') {
    // macOS
    command = 'open';
    args = [filePath];
  } else {
    // Linux
    command = 'xdg-open';
    args = [filePath];
  }
  
  const childProcess = spawn(command, args, {
    detached: true,
    stdio: 'ignore'
  });
  
  childProcess.unref();
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
    console.log(`[INFO] Viewing AutoClaude dashboard for: ${targetPath}`);

    if (!fs.existsSync(targetPath)) {
      throw new Error(`Directory does not exist: ${targetPath}`);
    }

    if (!fs.statSync(targetPath).isDirectory()) {
      throw new Error(`Path is not a directory: ${targetPath}`);
    }

    // Check if this is an AutoClaude project
    const collabDir = path.join(targetPath, 'collaboration');
    if (!fs.existsSync(collabDir)) {
      showNotification(
        'AutoClaude', 
        'This directory is not an AutoClaude project.\n\nPlease initialize it first using "Initialize AutoClaude Project" from the context menu.',
        true
      );
      throw new Error('Not an AutoClaude project');
    }

    // Generate dashboard
    try {
      const { generate } = require('../core/dashboard');
      const dashboardPath = generate(targetPath);
      
      console.log(`[INFO] Dashboard generated: ${dashboardPath}`);
      
      // Open dashboard in default browser
      openFile(dashboardPath);
      
      // Success notification
      showNotification('AutoClaude', 'Dashboard opened in your default browser!');
      console.log('[OK] Dashboard opened');
      
    } catch (dashError) {
      throw new Error(`Dashboard generation failed: ${dashError.message}`);
    }

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

module.exports = { main, parsePath };