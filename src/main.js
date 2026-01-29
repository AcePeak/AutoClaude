const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const Tray = require('./tray');
const Watcher = require('./core/watcher');
const { initAppDataDir } = require('./utils/paths');
const { loadSettings, saveSettings } = require('./utils/projects');
const Logger = require('./utils/logger');

const logger = new Logger('main');

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

let tray = null;
let watcher = null;
let settingsWindow = null;

/**
 * Initialize the application
 */
function initialize() {
  // Initialize app data directory
  initAppDataDir();
  logger.ok('AutoClaude started');

  // Create tray
  tray = new Tray();
  tray.on('show-settings', showSettingsWindow);
  tray.on('quit', () => {
    if (watcher) {
      watcher.stop();
    }
    app.quit();
  });

  // Handle watcher toggle from tray
  tray.on('toggle-watcher', (enabled) => {
    if (enabled) {
      if (watcher) {
        watcher.start();
      }
    } else {
      if (watcher) {
        watcher.stop();
      }
    }
  });

  // Start watcher
  watcher = new Watcher();
  watcher.start();

  // Update tray periodically
  setInterval(() => {
    if (tray) {
      tray.updateStatus(watcher);
    }
  }, 5000);
}

/**
 * Show settings window
 */
function showSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 450,
    height: 380,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: 'AutoClaude Settings',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  settingsWindow.loadFile(path.join(__dirname, 'settings.html'));
  settingsWindow.setMenuBarVisibility(false);

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

// IPC handlers for settings
ipcMain.handle('get-settings', () => {
  const settings = loadSettings();
  // Add auto-start status
  const loginItemSettings = app.getLoginItemSettings();
  settings.auto_start = loginItemSettings.openAtLogin;
  return settings;
});

ipcMain.handle('save-settings', (event, settings) => {
  // Handle auto-start setting
  if (typeof settings.auto_start !== 'undefined') {
    app.setLoginItemSettings({
      openAtLogin: settings.auto_start,
      path: process.execPath,
      args: []
    });
  }

  // Save other settings
  const { auto_start, ...otherSettings } = settings;
  saveSettings(otherSettings);

  // Restart watcher with new settings
  if (watcher) {
    watcher.stop();
    watcher.start();
  }
  return true;
});

ipcMain.handle('get-cpu-count', () => {
  return require('os').cpus().length;
});

ipcMain.handle('get-platform', () => {
  return process.platform;
});

// IPC handler for Windows context menu registration
ipcMain.handle('register-context-menu', async () => {
  if (process.platform !== 'win32') {
    return { success: false, message: 'Only available on Windows' };
  }

  try {
    const { execSync } = require('child_process');
    const appPath = app.isPackaged
      ? path.dirname(process.execPath)
      : path.join(__dirname, '..');

    // Get icon path
    const iconPath = path.join(appPath, 'resources', 'assets', 'icon.ico');

    // Create registry entries for context menu
    const regCommands = [
      // Directory background - Initialize
      `reg add "HKCU\\Software\\Classes\\Directory\\Background\\shell\\AutoClaudeInit" /ve /d "Initialize AutoClaude Project" /f`,
      `reg add "HKCU\\Software\\Classes\\Directory\\Background\\shell\\AutoClaudeInit" /v "Icon" /d "${iconPath}" /f`,
      `reg add "HKCU\\Software\\Classes\\Directory\\Background\\shell\\AutoClaudeInit\\command" /ve /d "\\"${process.execPath}\\" --init \\"%V\\"" /f`,

      // Directory background - Open Claude
      `reg add "HKCU\\Software\\Classes\\Directory\\Background\\shell\\AutoClaudeOpen" /ve /d "Open Claude" /f`,
      `reg add "HKCU\\Software\\Classes\\Directory\\Background\\shell\\AutoClaudeOpen" /v "Icon" /d "${iconPath}" /f`,
      `reg add "HKCU\\Software\\Classes\\Directory\\Background\\shell\\AutoClaudeOpen\\command" /ve /d "\\"${process.execPath}\\" --open-claude \\"%V\\"" /f`,

      // Directory - Initialize
      `reg add "HKCU\\Software\\Classes\\Directory\\shell\\AutoClaudeInit" /ve /d "Initialize AutoClaude Project" /f`,
      `reg add "HKCU\\Software\\Classes\\Directory\\shell\\AutoClaudeInit" /v "Icon" /d "${iconPath}" /f`,
      `reg add "HKCU\\Software\\Classes\\Directory\\shell\\AutoClaudeInit\\command" /ve /d "\\"${process.execPath}\\" --init \\"%1\\"" /f`,

      // Directory - Open Claude
      `reg add "HKCU\\Software\\Classes\\Directory\\shell\\AutoClaudeOpen" /ve /d "Open Claude" /f`,
      `reg add "HKCU\\Software\\Classes\\Directory\\shell\\AutoClaudeOpen" /v "Icon" /d "${iconPath}" /f`,
      `reg add "HKCU\\Software\\Classes\\Directory\\shell\\AutoClaudeOpen\\command" /ve /d "\\"${process.execPath}\\" --open-claude \\"%1\\"" /f`
    ];

    for (const cmd of regCommands) {
      execSync(cmd, { stdio: 'ignore' });
    }

    return { success: true, message: 'Context menu registered successfully' };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('unregister-context-menu', async () => {
  if (process.platform !== 'win32') {
    return { success: false, message: 'Only available on Windows' };
  }

  try {
    const { execSync } = require('child_process');

    const regCommands = [
      `reg delete "HKCU\\Software\\Classes\\Directory\\Background\\shell\\AutoClaudeInit" /f`,
      `reg delete "HKCU\\Software\\Classes\\Directory\\Background\\shell\\AutoClaudeOpen" /f`,
      `reg delete "HKCU\\Software\\Classes\\Directory\\shell\\AutoClaudeInit" /f`,
      `reg delete "HKCU\\Software\\Classes\\Directory\\shell\\AutoClaudeOpen" /f`
    ];

    for (const cmd of regCommands) {
      try {
        execSync(cmd, { stdio: 'ignore' });
      } catch (e) {
        // Ignore if key doesn't exist
      }
    }

    return { success: true, message: 'Context menu unregistered successfully' };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('check-context-menu', async () => {
  if (process.platform !== 'win32') {
    return false;
  }

  try {
    const { execSync } = require('child_process');
    execSync('reg query "HKCU\\Software\\Classes\\Directory\\Background\\shell\\AutoClaudeInit"', { stdio: 'ignore' });
    return true;
  } catch (err) {
    return false;
  }
});

// Handle command line arguments (for context menu integration)
function handleCommandLineArgs() {
  const args = process.argv.slice(app.isPackaged ? 1 : 2);
  const fs = require('fs');

  console.log('Command line args:', args);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--init' && args[i + 1]) {
      let targetPath = args[i + 1];
      // Remove quotes if present
      targetPath = targetPath.replace(/^["']|["']$/g, '');
      // Normalize path
      targetPath = path.normalize(targetPath);

      console.log('Initializing project at:', targetPath);

      // Verify path exists
      if (!fs.existsSync(targetPath)) {
        console.error('Path does not exist:', targetPath);
        app.whenReady().then(() => {
          const { Notification } = require('electron');
          if (Notification.isSupported()) {
            new Notification({
              title: 'AutoClaude Error',
              body: `Path does not exist: ${targetPath}`
            }).show();
          }
        });
        return true;
      }

      // Verify it's a directory
      if (!fs.statSync(targetPath).isDirectory()) {
        console.error('Path is not a directory:', targetPath);
        app.whenReady().then(() => {
          const { Notification } = require('electron');
          if (Notification.isSupported()) {
            new Notification({
              title: 'AutoClaude Error',
              body: `Path is not a directory: ${targetPath}`
            }).show();
          }
        });
        return true;
      }

      // Initialize project
      const { initProjectSync } = require('./cli/init');
      try {
        console.log('Calling initProjectSync with:', targetPath);
        initProjectSync(targetPath);
        console.log('Project initialized successfully');

        // Verify collaboration directory was created
        const collabDir = path.join(targetPath, 'collaboration');
        if (fs.existsSync(collabDir)) {
          console.log('Collaboration directory created:', collabDir);
        } else {
          console.error('Collaboration directory NOT created!');
        }

        app.whenReady().then(() => {
          const { Notification } = require('electron');
          if (Notification.isSupported()) {
            new Notification({
              title: 'AutoClaude',
              body: `Project initialized at ${targetPath}`
            }).show();
          }
          // Don't quit - let the app continue running
        });
      } catch (err) {
        console.error('Init error:', err);
        console.error('Init error stack:', err.stack);
        app.whenReady().then(() => {
          const { Notification } = require('electron');
          if (Notification.isSupported()) {
            new Notification({
              title: 'AutoClaude Error',
              body: err.message
            }).show();
          }
        });
      }
      return true;
    }

    if (arg === '--open-claude' && args[i + 1]) {
      let targetPath = args[i + 1];
      // Remove quotes if present
      targetPath = targetPath.replace(/^["']|["']$/g, '');
      // Normalize path
      targetPath = path.normalize(targetPath);

      // Open Claude in directory using shell
      const { exec } = require('child_process');
      const cmdPath = process.env.ComSpec || 'cmd.exe';
      exec(`start "" "${cmdPath}" /k claude`, {
        cwd: targetPath,
        shell: true
      }, (err) => {
        if (err) {
          console.error('Error opening Claude:', err);
        }
        app.quit();
      });
      return true;
    }
  }

  return false;
}

// App events
app.whenReady().then(() => {
  // Handle command line arguments first
  if (handleCommandLineArgs()) {
    // If we handled a one-shot command, don't start the full app
    return;
  }

  // Hide dock icon on macOS (we only want tray)
  if (process.platform === 'darwin') {
    app.dock.hide();
  }

  initialize();
});

app.on('window-all-closed', (e) => {
  // Don't quit when all windows are closed (we're a tray app)
  e.preventDefault();
});

app.on('before-quit', () => {
  logger.ok('AutoClaude shutting down');
  if (watcher) {
    watcher.stop();
  }
});

// Handle second instance
app.on('second-instance', (event, commandLine, workingDirectory) => {
  // Check if this is a command line invocation
  const args = commandLine.slice(1);
  const fs = require('fs');

  console.log('Second instance args:', args);

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--init' && args[i + 1]) {
      let targetPath = args[i + 1];
      // Remove quotes if present
      targetPath = targetPath.replace(/^["']|["']$/g, '');
      // Normalize path
      targetPath = path.normalize(targetPath);

      console.log('Second instance init at:', targetPath);

      if (!fs.existsSync(targetPath)) {
        if (tray) {
          tray.showNotification('AutoClaude Error', `Path does not exist: ${targetPath}`);
        }
        return;
      }

      if (!fs.statSync(targetPath).isDirectory()) {
        if (tray) {
          tray.showNotification('AutoClaude Error', `Path is not a directory: ${targetPath}`);
        }
        return;
      }

      try {
        const { initProjectSync } = require('./cli/init');
        console.log('Second instance calling initProjectSync with:', targetPath);
        initProjectSync(targetPath);

        // Verify collaboration directory was created
        const collabDir = path.join(targetPath, 'collaboration');
        if (fs.existsSync(collabDir)) {
          console.log('Collaboration directory created:', collabDir);
        } else {
          console.error('Collaboration directory NOT created!');
        }

        if (tray) {
          tray.showNotification('AutoClaude', `Project initialized at ${targetPath}`);
          tray.updateMenu();
        }
      } catch (err) {
        console.error('Second instance init error:', err);
        console.error('Second instance init error stack:', err.stack);
        if (tray) {
          tray.showNotification('AutoClaude Error', err.message);
        }
      }
      return;
    }

    if (args[i] === '--open-claude' && args[i + 1]) {
      let targetPath = args[i + 1];
      targetPath = targetPath.replace(/^["']|["']$/g, '');
      // Normalize path
      targetPath = path.normalize(targetPath);

      // Open Claude in directory using shell
      const { exec } = require('child_process');
      const cmdPath = process.env.ComSpec || 'cmd.exe';
      exec(`start "" "${cmdPath}" /k claude`, {
        cwd: targetPath,
        shell: true
      }, (err) => {
        if (err) {
          console.error('Error opening Claude:', err);
        }
      });
      return;
    }
  }

  // Show notification that app is already running
  if (tray) {
    tray.showNotification('AutoClaude', 'Application is already running');
  }
});
