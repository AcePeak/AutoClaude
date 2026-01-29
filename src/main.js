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
    width: 400,
    height: 300,
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
  return loadSettings();
});

ipcMain.handle('save-settings', (event, settings) => {
  saveSettings(settings);
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

// App events
app.whenReady().then(() => {
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
app.on('second-instance', () => {
  // Show notification that app is already running
  if (tray) {
    tray.showNotification('AutoClaude', 'Application is already running');
  }
});
