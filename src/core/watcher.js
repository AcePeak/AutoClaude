const fs = require('fs');
const path = require('path');
const { spawn, fork } = require('child_process');
const { getCollabDir, getConfigDir, getLockDir, ensureDir } = require('../utils/paths');
const { getEnabledProjects, loadSettings } = require('../utils/projects');
const Logger = require('../utils/logger');

const logger = new Logger('watcher');

/**
 * Get the correct Node.js executable path
 * In packaged Electron app, we need to use the bundled Node
 */
function getNodePath() {
  // Check if we're in a packaged Electron app
  if (process.versions && process.versions.electron) {
    // In Electron, we can use fork() which uses process.execPath internally
    // Or we can use the electron executable with --no-sandbox
    return null; // Signal to use fork() instead of spawn('node', ...)
  }
  return 'node';
}

class Watcher {
  constructor() {
    this.running = false;
    this.interval = null;
    this.supervisorProcesses = new Map();
    this.executorProcesses = new Map();
  }

  /**
   * Check if a project needs supervisor or executor
   */
  checkProject(projectPath) {
    const result = {
      needsSupervisor: false,
      needsExecutor: false,
      orphanedTasks: [],
      reason: '',
      error: null
    };

    // Validate project path exists
    if (!fs.existsSync(projectPath)) {
      result.error = 'Project directory does not exist';
      return result;
    }

    const collabDir = getCollabDir(projectPath);
    if (!fs.existsSync(collabDir)) {
      return result;
    }

    // Check inbox.md
    const inboxPath = path.join(collabDir, 'inbox.md');
    if (fs.existsSync(inboxPath)) {
      const content = fs.readFileSync(inboxPath, 'utf8');
      const lines = content.split('\n').filter(line => {
        const trimmed = line.trim();
        return trimmed &&
               !trimmed.startsWith('#') &&
               !trimmed.startsWith('---') &&
               !trimmed.includes('Write new requirements');
      });
      if (lines.length > 0) {
        result.needsSupervisor = true;
        result.reason = 'inbox.md has new content';
      }
    }

    // Check queue/ directory
    const queueDir = path.join(collabDir, 'queue');
    if (fs.existsSync(queueDir)) {
      const pendingTasks = fs.readdirSync(queueDir).filter(f => f.endsWith('.md'));
      if (pendingTasks.length > 0) {
        result.needsExecutor = true;
        if (result.reason) result.reason += '; ';
        result.reason += `queue/ has ${pendingTasks.length} pending task(s)`;
      }
    }

    // Check executing/ directory for REVIEW status or orphaned tasks
    const executingDir = path.join(collabDir, 'executing');
    const lockDir = getLockDir(projectPath);

    if (fs.existsSync(executingDir)) {
      const executingTasks = fs.readdirSync(executingDir).filter(f => f.endsWith('.md'));

      for (const taskFile of executingTasks) {
        const taskPath = path.join(executingDir, taskFile);
        const content = fs.readFileSync(taskPath, 'utf8');

        // Check for REVIEW status
        if (/status:\s*REVIEW/i.test(content)) {
          result.needsSupervisor = true;
          if (result.reason) result.reason += '; ';
          result.reason += 'task(s) pending review';
        }

        // Check for orphaned EXECUTING tasks
        if (/status:\s*EXECUTING/i.test(content)) {
          const taskId = path.basename(taskFile, '.md');
          const lockFile = path.join(lockDir, `${taskId}.lock`);

          let isOrphaned = false;
          if (!fs.existsSync(lockFile)) {
            isOrphaned = true;
          } else {
            try {
              const lockContent = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
              const pid = lockContent.pid;
              // Check if process is alive
              try {
                process.kill(pid, 0);
              } catch (e) {
                isOrphaned = true;
              }
            } catch (e) {
              isOrphaned = true;
            }
          }

          if (isOrphaned) {
            result.needsExecutor = true;
            result.orphanedTasks.push(taskId);
            if (result.reason) result.reason += '; ';
            result.reason += `orphaned task: ${taskId}`;
          }
        }
      }
    }

    return result;
  }

  /**
   * Get count of running executors for a project
   */
  getRunningExecutorCount(projectPath) {
    const lockDir = getLockDir(projectPath);
    let count = 0;

    if (!fs.existsSync(lockDir)) {
      return 0;
    }

    const lockFiles = fs.readdirSync(lockDir).filter(f => f.endsWith('.lock'));
    for (const lockFile of lockFiles) {
      try {
        const lockPath = path.join(lockDir, lockFile);
        const lockContent = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
        const pid = lockContent.pid;
        // Check if process is alive
        try {
          process.kill(pid, 0);
          count++;
        } catch (e) {
          // Process not running
        }
      } catch (e) {
        // Invalid lock file
      }
    }

    return count;
  }

  /**
   * Trigger supervisor for a project
   */
  triggerSupervisor(projectPath) {
    logger.info(`Triggering Supervisor: ${projectPath}`);

    const supervisorPath = path.join(__dirname, 'supervisor.js');

    try {
      // Use fork() which works in both Node.js and Electron
      const child = fork(supervisorPath, [projectPath], {
        detached: true,
        stdio: 'ignore',
        // Ensure child runs independently
        env: { ...process.env }
      });
      child.unref();

      this.supervisorProcesses.set(projectPath, child.pid);
      logger.info(`Supervisor started with PID: ${child.pid}`);
      return true;
    } catch (err) {
      logger.error(`Failed to start Supervisor: ${err.message}`);
      return false;
    }
  }

  /**
   * Trigger executor for a project
   */
  triggerExecutor(projectPath, resumeTask = null) {
    const logMsg = resumeTask
      ? `Triggering Executor to resume: ${resumeTask}`
      : `Triggering Executor: ${projectPath}`;
    logger.info(logMsg);

    const executorPath = path.join(__dirname, 'executor.js');
    const args = [projectPath];
    if (resumeTask) {
      args.push('--resume', resumeTask);
    }

    try {
      // Use fork() which works in both Node.js and Electron
      const child = fork(executorPath, args, {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env }
      });
      child.unref();

      this.executorProcesses.set(projectPath, child.pid);
      logger.info(`Executor started with PID: ${child.pid}`);
      return true;
    } catch (err) {
      logger.error(`Failed to start Executor: ${err.message}`);
      return false;
    }
  }

  /**
   * Generate dashboard for a project
   */
  generateDashboard(projectPath) {
    try {
      const dashboardGenerator = require('./dashboard');
      dashboardGenerator.generate(projectPath);
    } catch (err) {
      logger.warn(`Failed to generate dashboard: ${err.message}`);
    }
  }

  /**
   * Run one check cycle
   */
  async runOnce() {
    const projects = getEnabledProjects();
    const settings = loadSettings();

    if (projects.length === 0) {
      logger.warn('No enabled projects');
      return;
    }

    for (const project of projects) {
      const projectName = project.name || path.basename(project.path);

      if (!fs.existsSync(project.path)) {
        logger.warn(`[${projectName}] Project directory not found: ${project.path}`);
        continue;
      }

      const checkResult = this.checkProject(project.path);

      // Handle check errors
      if (checkResult.error) {
        logger.error(`[${projectName}] Check failed: ${checkResult.error}`);
        continue;
      }

      if (checkResult.needsSupervisor || checkResult.needsExecutor) {
        logger.info(`[${projectName}] ${checkResult.reason}`);

        if (checkResult.needsSupervisor) {
          this.triggerSupervisor(project.path);
        }

        if (checkResult.needsExecutor) {
          const runningCount = this.getRunningExecutorCount(project.path);
          const maxExecutors = settings.max_executors;

          if (runningCount >= maxExecutors) {
            logger.warn(`[${projectName}] Executor limit reached (${runningCount}/${maxExecutors})`);
          } else {
            if (checkResult.orphanedTasks.length > 0) {
              for (const taskId of checkResult.orphanedTasks) {
                if (this.getRunningExecutorCount(project.path) < maxExecutors) {
                  this.triggerExecutor(project.path, taskId);
                }
              }
            } else {
              this.triggerExecutor(project.path);
            }
          }
        }
      } else {
        logger.info(`[${projectName}] No changes`);
      }

      // Update dashboard
      this.generateDashboard(project.path);
    }
  }

  /**
   * Start the watcher loop
   */
  start() {
    if (this.running) {
      logger.warn('Watcher already running');
      return;
    }

    logger.ok('Watcher started');
    this.running = true;

    const settings = loadSettings();
    const intervalMs = (settings.check_interval_seconds || 60) * 1000;

    // Run immediately
    this.runOnce();

    // Then run on interval
    this.interval = setInterval(() => {
      this.runOnce();
    }, intervalMs);
  }

  /**
   * Stop the watcher
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.running = false;
    logger.ok('Watcher stopped');
  }
}

// If run directly
if (require.main === module) {
  const watcher = new Watcher();

  const args = process.argv.slice(2);
  if (args.includes('--once')) {
    watcher.runOnce().then(() => {
      logger.ok('Single check complete');
    });
  } else {
    watcher.start();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      watcher.stop();
      process.exit(0);
    });
    process.on('SIGTERM', () => {
      watcher.stop();
      process.exit(0);
    });
  }
}

module.exports = Watcher;
