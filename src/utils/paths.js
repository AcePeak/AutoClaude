const path = require('path');
const os = require('os');
const fs = require('fs');

/**
 * Get platform-specific app data directory
 */
function getAppDataDir() {
  const platform = process.platform;

  if (platform === 'win32') {
    return path.join(process.env.APPDATA, 'AutoClaude');
  } else if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'AutoClaude');
  } else {
    // Linux and others
    return path.join(os.homedir(), '.config', 'autoclaude');
  }
}

/**
 * Get projects file path
 */
function getProjectsFile() {
  return path.join(getAppDataDir(), 'projects.json');
}

/**
 * Get settings file path
 */
function getSettingsFile() {
  return path.join(getAppDataDir(), 'settings.json');
}

/**
 * Get log file path
 */
function getLogFile(name = 'app') {
  const date = new Date().toISOString().split('T')[0];
  return path.join(getAppDataDir(), 'logs', `${name}_${date}.log`);
}

/**
 * Ensure directory exists
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Get collaboration directory for a project
 */
function getCollabDir(projectPath) {
  return path.join(projectPath, 'collaboration');
}

/**
 * Get autoclaude config directory for a project
 */
function getConfigDir(projectPath) {
  return path.join(getCollabDir(projectPath), '.autoclaude');
}

/**
 * Get lock directory for a project
 */
function getLockDir(projectPath) {
  return path.join(getConfigDir(projectPath), 'lock');
}

/**
 * Get logs directory for a project
 */
function getLogsDir(projectPath) {
  return path.join(getConfigDir(projectPath), 'logs');
}

/**
 * Initialize app data directory
 */
function initAppDataDir() {
  const appDataDir = getAppDataDir();
  ensureDir(appDataDir);
  ensureDir(path.join(appDataDir, 'logs'));
  return appDataDir;
}

module.exports = {
  getAppDataDir,
  getProjectsFile,
  getSettingsFile,
  getLogFile,
  ensureDir,
  getCollabDir,
  getConfigDir,
  getLockDir,
  getLogsDir,
  initAppDataDir
};
