#!/usr/bin/env node

const { program } = require('commander');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Setup command line arguments
program
  .option('--path <directory>', 'Directory to open Claude in')
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
      const script = `
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.MessageBox]::Show('${message.replace(/'/g, "''")}', '${title}', 'OK', '${isError ? 'Error' : 'Information'}')
      `;
      spawn('powershell', ['-Command', script], { stdio: 'ignore' });
    } else if (process.platform === 'darwin') {
      // macOS notification
      spawn('osascript', ['-e', `display notification "${message}" with title "${title}"`], { stdio: 'ignore' });
    } else {
      // Linux notification
      spawn('notify-send', [title, message], { stdio: 'ignore' });
    }
  } catch (error) {
    // Fallback to console output
    console.log(`[${isError ? 'ERROR' : 'INFO'}] ${title}: ${message}`);
  }
}

// Check if command exists
function commandExists(command) {
  try {
    const { execSync } = require('child_process');
    if (process.platform === 'win32') {
      execSync(`where ${command}`, { stdio: 'ignore' });
    } else {
      execSync(`which ${command}`, { stdio: 'ignore' });
    }
    return true;
  } catch {
    return false;
  }
}

// Main function
function main() {
  try {
    console.log(`[INFO] Opening Claude in directory: ${targetPath}`);
    
    // Check if directory exists
    if (!fs.existsSync(targetPath)) {
      throw new Error(`Directory does not exist: ${targetPath}`);
    }

    if (!fs.statSync(targetPath).isDirectory()) {
      throw new Error(`Path is not a directory: ${targetPath}`);
    }

    // Check if claude command is available
    if (!commandExists('claude')) {
      throw new Error('claude command not found. Please install Claude CLI: npm install -g @anthropic-ai/claude-code');
    }

    // Start Claude in new terminal window
    let command, args;
    
    if (process.platform === 'win32') {
      // Windows: Start new cmd window with Claude
      command = 'cmd';
      args = ['/c', 'start', 'cmd', '/k', `cd /d "${targetPath}" && claude`];
    } else if (process.platform === 'darwin') {
      // macOS: Use Terminal.app
      const script = `tell application "Terminal" to do script "cd '${targetPath}' && claude"`;
      command = 'osascript';
      args = ['-e', script];
    } else {
      // Linux: Try common terminal emulators
      const terminals = ['x-terminal-emulator', 'gnome-terminal', 'konsole', 'xterm'];
      let terminalFound = false;
      
      for (const terminal of terminals) {
        if (commandExists(terminal)) {
          if (terminal === 'gnome-terminal') {
            command = terminal;
            args = ['--', 'bash', '-c', `cd "${targetPath}" && claude; exec bash`];
          } else if (terminal === 'konsole') {
            command = terminal;
            args = ['-e', 'bash', '-c', `cd "${targetPath}" && claude; exec bash`];
          } else {
            command = terminal;
            args = ['-e', 'bash', '-c', `cd "${targetPath}" && claude; exec bash`];
          }
          terminalFound = true;
          break;
        }
      }
      
      if (!terminalFound) {
        throw new Error('No suitable terminal emulator found');
      }
    }

    // Launch the terminal
    const childProcess = spawn(command, args, {
      detached: true,
      stdio: 'ignore'
    });

    childProcess.unref();

    // Success notification
    showNotification('AutoClaude', 'Claude opened in new terminal window!');
    console.log('[OK] Claude started in new window');

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