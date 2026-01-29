const { Tray, Menu, nativeImage, Notification, shell } = require('electron');
const path = require('path');
const EventEmitter = require('events');
const { loadProjects, getEnabledProjects, toggleProject, removeProject } = require('./utils/projects');
const { getCollabDir } = require('./utils/paths');
const fs = require('fs');

class TrayManager extends EventEmitter {
  constructor() {
    super();
    this.tray = null;
    this.createTray();
  }

  /**
   * Get icon path based on platform
   */
  getIconPath() {
    const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
    // Try multiple locations
    const locations = [
      path.join(__dirname, '..', 'assets', iconName),
      path.join(__dirname, 'assets', iconName),
      path.join(process.resourcesPath || '', 'assets', iconName)
    ];

    for (const loc of locations) {
      if (fs.existsSync(loc)) {
        return loc;
      }
    }

    // Return default icon if not found
    return null;
  }

  /**
   * Create the system tray
   */
  createTray() {
    const iconPath = this.getIconPath();
    let icon;

    if (iconPath) {
      icon = nativeImage.createFromPath(iconPath);
    } else {
      // Create a simple default icon
      icon = nativeImage.createEmpty();
    }

    this.tray = new Tray(icon);
    this.tray.setToolTip('AutoClaude');
    this.updateMenu();

    // Double-click to show menu on Windows
    if (process.platform === 'win32') {
      this.tray.on('double-click', () => {
        this.tray.popUpContextMenu();
      });
    }
  }

  /**
   * Update the tray menu
   */
  updateMenu() {
    const projects = loadProjects();
    const projectMenuItems = [];

    if (projects.length === 0) {
      projectMenuItems.push({
        label: 'No projects registered',
        enabled: false
      });
    } else {
      for (const project of projects) {
        const status = this.getProjectStatus(project.path);
        projectMenuItems.push({
          label: `${project.enabled ? '[ON]' : '[OFF]'} ${project.name} ${status}`,
          submenu: [
            {
              label: project.enabled ? 'Disable' : 'Enable',
              click: () => {
                toggleProject(project.path, !project.enabled);
                this.updateMenu();
              }
            },
            {
              label: 'Open Dashboard',
              click: () => this.openDashboard(project.path)
            },
            {
              label: 'Open Folder',
              click: () => shell.openPath(project.path)
            },
            { type: 'separator' },
            {
              label: 'Remove from list',
              click: () => {
                removeProject(project.path);
                this.updateMenu();
              }
            }
          ]
        });
      }
    }

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'AutoClaude',
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Projects',
        submenu: projectMenuItems
      },
      { type: 'separator' },
      {
        label: 'Stop All Tasks',
        click: () => this.stopAllTasks()
      },
      {
        label: 'Settings...',
        click: () => this.emit('show-settings')
      },
      { type: 'separator' },
      {
        label: 'View Logs',
        click: () => this.openLogs()
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => this.emit('quit')
      }
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  /**
   * Get project status string
   */
  getProjectStatus(projectPath) {
    const collabDir = getCollabDir(projectPath);

    if (!fs.existsSync(collabDir)) {
      return '(not initialized)';
    }

    let executing = 0;
    let queued = 0;

    const queueDir = path.join(collabDir, 'queue');
    const executingDir = path.join(collabDir, 'executing');

    if (fs.existsSync(queueDir)) {
      queued = fs.readdirSync(queueDir).filter(f => f.endsWith('.md')).length;
    }

    if (fs.existsSync(executingDir)) {
      executing = fs.readdirSync(executingDir).filter(f => f.endsWith('.md')).length;
    }

    if (executing > 0 || queued > 0) {
      return `(${executing} running, ${queued} queued)`;
    }

    return '(idle)';
  }

  /**
   * Open dashboard for a project
   */
  openDashboard(projectPath) {
    const dashboardPath = path.join(getCollabDir(projectPath), 'dashboard.html');
    if (fs.existsSync(dashboardPath)) {
      shell.openPath(dashboardPath);
    } else {
      this.showNotification('AutoClaude', 'Dashboard not found. Initialize the project first.');
    }
  }

  /**
   * Open logs directory
   */
  openLogs() {
    const { getAppDataDir } = require('./utils/paths');
    const logsDir = path.join(getAppDataDir(), 'logs');
    if (fs.existsSync(logsDir)) {
      shell.openPath(logsDir);
    }
  }

  /**
   * Stop all running tasks
   */
  stopAllTasks() {
    const { execSync } = require('child_process');

    try {
      if (process.platform === 'win32') {
        // Kill supervisor and executor node processes
        // Look for processes with our script names in command line
        execSync('wmic process where "commandline like \'%supervisor.js%\'" delete', { stdio: 'ignore' });
        execSync('wmic process where "commandline like \'%executor.js%\'" delete', { stdio: 'ignore' });
      } else {
        // macOS/Linux
        execSync("pkill -f 'supervisor.js'", { stdio: 'ignore' });
        execSync("pkill -f 'executor.js'", { stdio: 'ignore' });
      }

      this.showNotification('AutoClaude', 'All tasks stopped');
    } catch (err) {
      // No processes found or error - that's ok
    }

    this.updateMenu();
  }

  /**
   * Show a system notification
   */
  showNotification(title, body) {
    if (Notification.isSupported()) {
      const notification = new Notification({
        title,
        body,
        silent: false
      });
      notification.show();
    }
  }

  /**
   * Update status from watcher
   */
  updateStatus(watcher) {
    this.updateMenu();
  }

  /**
   * Destroy the tray
   */
  destroy() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}

module.exports = TrayManager;
