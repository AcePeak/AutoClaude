const { Tray, Menu, nativeImage, Notification, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');
const EventEmitter = require('events');
const { loadProjects, getEnabledProjects, toggleProject, removeProject } = require('./utils/projects');
const { getCollabDir, getAppDataDir } = require('./utils/paths');

class TrayManager extends EventEmitter {
  constructor() {
    super();
    this.tray = null;
    this.watcherEnabled = true;
    this.createTray();
  }

  /**
   * Get icon path based on platform
   */
  getIconPath() {
    const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.png';

    // Check multiple possible locations
    const locations = [
      // Production: extraResources location
      path.join(process.resourcesPath || '', 'assets', iconName),
      // Development: project root
      path.join(__dirname, '..', 'assets', iconName),
      // Alternative development path
      path.join(process.cwd(), 'assets', iconName),
      // Inside src folder (fallback)
      path.join(__dirname, 'assets', iconName)
    ];

    for (const loc of locations) {
      if (fs.existsSync(loc)) {
        console.log('Found icon at:', loc);
        return loc;
      }
    }

    console.log('Icon not found in any location:', locations);
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
      icon = nativeImage.createEmpty();
    }

    this.tray = new Tray(icon);
    this.tray.setToolTip('AutoClaude');
    this.updateMenu();

    // Double-click to open first project directory
    this.tray.on('double-click', () => {
      const projects = loadProjects();
      if (projects.length > 0) {
        shell.openPath(projects[0].path);
      }
    });
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
          submenu: this.buildProjectSubmenu(project)
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
        label: this.watcherEnabled ? 'Stop Monitoring' : 'Start Monitoring',
        click: () => this.toggleWatcher()
      },
      {
        label: 'Stop All Tasks',
        click: () => this.stopAllTasks()
      },
      { type: 'separator' },
      {
        label: 'View Logs',
        submenu: this.buildLogsSubmenu(projects)
      },
      {
        label: 'Settings...',
        click: () => this.emit('show-settings')
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => this.emit('quit')
      }
    ]);

    this.tray.setContextMenu(contextMenu);
    this.updateTooltip();
  }

  /**
   * Build submenu for a project
   */
  buildProjectSubmenu(project) {
    const items = [
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
      {
        label: 'Open Claude',
        click: () => this.openClaude(project.path)
      },
      { type: 'separator' },
      {
        label: 'Manage Tasks',
        submenu: this.buildTasksSubmenu(project.path)
      },
      { type: 'separator' },
      {
        label: 'Remove from list',
        click: () => {
          removeProject(project.path);
          this.updateMenu();
        }
      }
    ];

    return items;
  }

  /**
   * Build tasks submenu for a project
   */
  buildTasksSubmenu(projectPath) {
    const tasks = this.getProjectTasks(projectPath);

    if (tasks.length === 0) {
      return [{ label: '(No active tasks)', enabled: false }];
    }

    return tasks.map(task => ({
      label: `${task.id} [${task.status}] (${task.iteration}/${task.maxIterations || 'Inf'})`,
      submenu: [
        {
          label: 'View Task File',
          click: () => this.openFile(task.path)
        },
        {
          label: 'View Task Log',
          click: () => {
            const logFile = path.join(projectPath, 'collaboration', '.autoclaude', 'logs', 'tasks', `${task.id}.log`);
            if (fs.existsSync(logFile)) {
              this.openFile(logFile);
            } else {
              this.showNotification('AutoClaude', 'No log file for this task yet');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Stop After Current Review',
          click: () => this.stopTaskIteration(task, projectPath)
        },
        {
          label: 'Approve Now (Skip Review)',
          click: () => this.approveTask(task, projectPath)
        }
      ]
    }));
  }

  /**
   * Build logs submenu
   */
  buildLogsSubmenu(projects) {
    const items = [
      {
        label: 'Application Log',
        click: () => {
          const logDir = path.join(getAppDataDir(), 'logs');
          if (fs.existsSync(logDir)) {
            shell.openPath(logDir);
          }
        }
      }
    ];

    if (projects.length > 0) {
      items.push({ type: 'separator' });

      for (const project of projects) {
        const projectLogDir = path.join(project.path, 'collaboration', '.autoclaude', 'logs');

        items.push({
          label: `${project.name} Logs`,
          submenu: [
            {
              label: 'Open Logs Folder',
              click: () => {
                if (fs.existsSync(projectLogDir)) {
                  shell.openPath(projectLogDir);
                } else {
                  this.showNotification('AutoClaude', 'No logs yet for this project');
                }
              }
            },
            {
              label: "Today's Executor Log",
              click: () => {
                const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                const logFile = path.join(projectLogDir, `executor_${today}.log`);
                if (fs.existsSync(logFile)) {
                  this.openFile(logFile);
                } else {
                  this.showNotification('AutoClaude', 'No executor log for today');
                }
              }
            },
            {
              label: "Today's Supervisor Log",
              click: () => {
                const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                const logFile = path.join(projectLogDir, `supervisor_${today}.log`);
                if (fs.existsSync(logFile)) {
                  this.openFile(logFile);
                } else {
                  this.showNotification('AutoClaude', 'No supervisor log for today');
                }
              }
            }
          ]
        });
      }
    }

    return items;
  }

  /**
   * Get project tasks
   */
  getProjectTasks(projectPath) {
    const tasks = [];
    const collabDir = getCollabDir(projectPath);

    for (const dir of ['queue', 'executing']) {
      const taskDir = path.join(collabDir, dir);
      if (!fs.existsSync(taskDir)) continue;

      const files = fs.readdirSync(taskDir).filter(f => f.endsWith('.md'));
      for (const file of files) {
        const filePath = path.join(taskDir, file);
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const task = {
            id: path.basename(file, '.md'),
            name: file,
            path: filePath,
            location: dir,
            status: 'UNKNOWN',
            iteration: 1,
            maxIterations: 3
          };

          // Parse YAML frontmatter
          const statusMatch = content.match(/status:\s*(\w+)/);
          if (statusMatch) task.status = statusMatch[1];

          const iterMatch = content.match(/iteration:\s*(\d+)/);
          if (iterMatch) task.iteration = parseInt(iterMatch[1], 10);

          const maxIterMatch = content.match(/max_iterations:\s*(\d+)/);
          if (maxIterMatch) task.maxIterations = parseInt(maxIterMatch[1], 10);

          tasks.push(task);
        } catch (err) {
          // Ignore read errors
        }
      }
    }

    return tasks;
  }

  /**
   * Stop task iteration (approve on next review)
   */
  stopTaskIteration(task, projectPath) {
    try {
      let content = fs.readFileSync(task.path, 'utf8');

      // Set max_iterations to current iteration
      if (content.match(/max_iterations:\s*\d+/)) {
        content = content.replace(/max_iterations:\s*\d+/, `max_iterations: ${task.iteration}`);
      } else if (content.match(/iteration:\s*\d+/)) {
        content = content.replace(/(iteration:\s*\d+)/, `$1\nmax_iterations: ${task.iteration}`);
      }

      fs.writeFileSync(task.path, content, 'utf8');
      this.showNotification('AutoClaude', `Task '${task.id}' will be approved after current review`);
    } catch (err) {
      this.showNotification('AutoClaude', 'Failed to update task');
    }
  }

  /**
   * Approve task immediately
   */
  approveTask(task, projectPath) {
    try {
      let content = fs.readFileSync(task.path, 'utf8');
      const completedDir = path.join(projectPath, 'collaboration', 'completed');

      // Update status to APPROVED
      content = content.replace(/status:\s*\w+/, 'status: APPROVED');

      // Add approval note
      const approvalNote = `\n\n## Manual Approval\n- Approved by: User (via tray menu)\n- Approved at: ${new Date().toISOString()}\n- Note: Task approved by user request\n`;

      if (!content.includes('## Manual Approval')) {
        content += approvalNote;
      }

      // Ensure completed directory exists
      if (!fs.existsSync(completedDir)) {
        fs.mkdirSync(completedDir, { recursive: true });
      }

      // Save and move
      fs.writeFileSync(task.path, content, 'utf8');
      const destPath = path.join(completedDir, task.name);
      fs.renameSync(task.path, destPath);

      this.showNotification('AutoClaude', `Task '${task.id}' approved and moved to completed`);
      this.updateMenu();
    } catch (err) {
      this.showNotification('AutoClaude', 'Failed to approve task');
    }
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
   * Update tooltip with summary
   */
  updateTooltip() {
    const projects = loadProjects();
    const enabledCount = projects.filter(p => p.enabled).length;
    let totalQueue = 0;
    let totalExecuting = 0;

    for (const project of projects) {
      if (project.enabled) {
        const collabDir = getCollabDir(project.path);
        const queueDir = path.join(collabDir, 'queue');
        const executingDir = path.join(collabDir, 'executing');

        if (fs.existsSync(queueDir)) {
          totalQueue += fs.readdirSync(queueDir).filter(f => f.endsWith('.md')).length;
        }
        if (fs.existsSync(executingDir)) {
          totalExecuting += fs.readdirSync(executingDir).filter(f => f.endsWith('.md')).length;
        }
      }
    }

    const status = this.watcherEnabled ? 'Running' : 'Paused';
    const tooltip = `AutoClaude (${status})\nProjects: ${enabledCount}\nQueue: ${totalQueue} | Executing: ${totalExecuting}`;
    this.tray.setToolTip(tooltip.substring(0, 127));
  }

  /**
   * Open dashboard for a project (regenerate first)
   */
  openDashboard(projectPath) {
    const collabDir = getCollabDir(projectPath);
    const dashboardPath = path.join(collabDir, 'dashboard.html');

    // Regenerate dashboard
    try {
      const { generate } = require('./core/dashboard');
      generate(projectPath);
    } catch (err) {
      // Continue even if regeneration fails
    }

    if (fs.existsSync(dashboardPath)) {
      shell.openPath(dashboardPath);
    } else {
      this.showNotification('AutoClaude', 'Dashboard not found. Initialize the project first.');
    }
  }

  /**
   * Open Claude CLI in project directory
   */
  openClaude(projectPath) {
    if (process.platform === 'win32') {
      // Windows: Open cmd with claude command using shell
      const cmdPath = process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe';
      exec(`start "" "${cmdPath}" /k claude`, {
        cwd: projectPath,
        shell: true
      }, (err) => {
        if (err) {
          console.error('Error opening Claude:', err);
        }
      });
    } else if (process.platform === 'darwin') {
      // macOS: Open Terminal with claude command
      const script = `tell application "Terminal"
        do script "cd '${projectPath}' && claude"
        activate
      end tell`;
      spawn('osascript', ['-e', script], { detached: true, stdio: 'ignore' });
    } else {
      // Linux: Try common terminal emulators
      const terminals = ['gnome-terminal', 'konsole', 'xfce4-terminal', 'xterm'];
      for (const term of terminals) {
        try {
          if (term === 'gnome-terminal') {
            spawn(term, ['--', 'bash', '-c', `cd '${projectPath}' && claude; exec bash`], {
              detached: true,
              stdio: 'ignore'
            });
          } else {
            spawn(term, ['-e', `bash -c "cd '${projectPath}' && claude; exec bash"`], {
              detached: true,
              stdio: 'ignore'
            });
          }
          break;
        } catch (err) {
          continue;
        }
      }
    }
  }

  /**
   * Open a file with default application
   */
  openFile(filePath) {
    shell.openPath(filePath);
  }

  /**
   * Toggle watcher on/off
   */
  toggleWatcher() {
    this.watcherEnabled = !this.watcherEnabled;
    this.emit('toggle-watcher', this.watcherEnabled);
    this.showNotification('AutoClaude', `Monitoring ${this.watcherEnabled ? 'started' : 'stopped'}`);
    this.updateMenu();
  }

  /**
   * Stop all running tasks
   */
  stopAllTasks() {
    const { execSync } = require('child_process');
    const projects = loadProjects();
    let killedCount = 0;

    try {
      if (process.platform === 'win32') {
        // Kill supervisor and executor node processes
        try {
          execSync('wmic process where "commandline like \'%supervisor.js%\'" delete', { stdio: 'ignore' });
          killedCount++;
        } catch (e) {}
        try {
          execSync('wmic process where "commandline like \'%executor.js%\'" delete', { stdio: 'ignore' });
          killedCount++;
        } catch (e) {}
      } else {
        // macOS/Linux
        try {
          execSync("pkill -f 'supervisor.js'", { stdio: 'ignore' });
          killedCount++;
        } catch (e) {}
        try {
          execSync("pkill -f 'executor.js'", { stdio: 'ignore' });
          killedCount++;
        } catch (e) {}
      }

      // Clean up lock files
      for (const project of projects) {
        const lockDir = path.join(project.path, 'collaboration', '.autoclaude', 'lock');
        if (fs.existsSync(lockDir)) {
          const lockFiles = fs.readdirSync(lockDir).filter(f => f.endsWith('.lock'));
          for (const lockFile of lockFiles) {
            try {
              fs.unlinkSync(path.join(lockDir, lockFile));
            } catch (e) {}
          }
        }
      }

      this.showNotification('AutoClaude', 'All tasks stopped');
    } catch (err) {
      // No processes found or error
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
   * Set watcher enabled state
   */
  setWatcherEnabled(enabled) {
    this.watcherEnabled = enabled;
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
