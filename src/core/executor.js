const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const { getCollabDir, getConfigDir, getLockDir, getLogsDir, ensureDir } = require('../utils/paths');
const Logger = require('../utils/logger');

const logger = new Logger('executor');

class Executor {
  constructor(projectPath, options = {}) {
    this.projectPath = projectPath;
    this.resumeTaskId = options.resumeTaskId || null;
    this.collabDir = getCollabDir(projectPath);
    this.lockDir = getLockDir(projectPath);
    this.logsDir = getLogsDir(projectPath);
    this.currentTaskId = null;
    this.lockFile = null;

    ensureDir(this.lockDir);
    ensureDir(this.logsDir);
  }

  /**
   * Acquire lock for a task
   */
  acquireLock(taskId) {
    const lockFile = path.join(this.lockDir, `${taskId}.lock`);

    try {
      // Try to create lock file exclusively
      const fd = fs.openSync(lockFile, 'wx');
      const lockData = {
        pid: process.pid,
        startTime: new Date().toISOString(),
        taskId
      };
      fs.writeSync(fd, JSON.stringify(lockData, null, 2));
      fs.closeSync(fd);

      this.lockFile = lockFile;
      this.currentTaskId = taskId;
      return true;
    } catch (err) {
      if (err.code === 'EEXIST') {
        // Lock already exists - check if process is alive
        try {
          const lockData = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
          process.kill(lockData.pid, 0);
          // Process is alive, lock is valid
          return false;
        } catch (e) {
          // Process is dead, remove stale lock
          fs.unlinkSync(lockFile);
          return this.acquireLock(taskId);
        }
      }
      return false;
    }
  }

  /**
   * Release lock for current task
   */
  releaseLock() {
    if (this.lockFile && fs.existsSync(this.lockFile)) {
      fs.unlinkSync(this.lockFile);
      this.lockFile = null;
    }
  }

  /**
   * Find a task to execute
   */
  findTask() {
    // If resuming specific task
    if (this.resumeTaskId) {
      const executingDir = path.join(this.collabDir, 'executing');
      const taskPath = path.join(executingDir, `${this.resumeTaskId}.md`);
      if (fs.existsSync(taskPath)) {
        return { taskId: this.resumeTaskId, taskPath, isResume: true };
      }
    }

    // Look for pending tasks in queue
    const queueDir = path.join(this.collabDir, 'queue');
    if (!fs.existsSync(queueDir)) {
      return null;
    }

    const tasks = fs.readdirSync(queueDir)
      .filter(f => f.endsWith('.md'))
      .sort(); // Process in order

    for (const taskFile of tasks) {
      const taskId = path.basename(taskFile, '.md');
      const taskPath = path.join(queueDir, taskFile);

      // Try to acquire lock
      if (this.acquireLock(taskId)) {
        return { taskId, taskPath, isResume: false };
      }
    }

    return null;
  }

  /**
   * Move task to executing directory
   */
  moveToExecuting(taskPath, taskId) {
    const executingDir = path.join(this.collabDir, 'executing');
    ensureDir(executingDir);

    const destPath = path.join(executingDir, `${taskId}.md`);

    // Read and update status
    let content = fs.readFileSync(taskPath, 'utf8');
    content = content.replace(/status:\s*\w+/i, 'status: EXECUTING');

    // Add executor info
    if (!content.includes('executor:')) {
      content = content.replace(
        /---\n/,
        `---\nexecutor: ${process.pid}\nexecutor_start: ${new Date().toISOString()}\n`
      );
    }

    fs.writeFileSync(destPath, content, 'utf8');
    fs.unlinkSync(taskPath);

    return destPath;
  }

  /**
   * Update task status to REVIEW
   */
  markForReview(taskPath, success, summary) {
    let content = fs.readFileSync(taskPath, 'utf8');
    content = content.replace(/status:\s*\w+/i, 'status: REVIEW');

    // Add completion info
    const completionInfo = `
## Execution Result
- Completed: ${new Date().toISOString()}
- Success: ${success}
- Summary: ${summary}
`;
    content += completionInfo;

    fs.writeFileSync(taskPath, content, 'utf8');
  }

  /**
   * Execute a task using Claude CLI
   */
  async executeTask(taskPath, taskId) {
    const content = fs.readFileSync(taskPath, 'utf8');
    const logFile = path.join(this.logsDir, `${taskId}_${Date.now()}.log`);

    // Build prompt for Claude
    const executorGuide = path.join(this.collabDir, 'EXECUTOR_GUIDE.md');
    let guideContent = '';
    if (fs.existsSync(executorGuide)) {
      guideContent = fs.readFileSync(executorGuide, 'utf8');
    }

    const prompt = `You are an Executor agent working on a specific task.

${guideContent}

## Current Task
${content}

## Instructions
1. Read and understand the task requirements
2. Implement the required changes
3. Test your changes if possible
4. When done, create a summary of what you did

IMPORTANT: Work only on this specific task. Do not modify unrelated files.
Start working on the task now.`;

    logger.info(`Executing task ${taskId}`);

    return new Promise((resolve) => {
      const args = ['-p', prompt, '--dangerously-skip-permissions'];

      // Add allowedTools if available
      const configPath = path.join(this.collabDir, '.autoclaude', 'config.json');
      if (fs.existsSync(configPath)) {
        try {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          if (config.allowed_tools) {
            args.push('--allowedTools', config.allowed_tools.join(','));
          }
        } catch (e) {
          // Ignore config errors
        }
      }

      const claude = spawn('claude', args, {
        cwd: this.projectPath,
        shell: true
      });

      let output = '';
      const logStream = fs.createWriteStream(logFile);

      claude.stdout.on('data', (data) => {
        output += data.toString();
        logStream.write(data);
      });

      claude.stderr.on('data', (data) => {
        logStream.write(data);
      });

      claude.on('close', (code) => {
        logStream.end();

        const success = code === 0;
        const summary = output.slice(-500); // Last 500 chars as summary

        this.markForReview(taskPath, success, summary);
        this.releaseLock();

        logger.info(`Task ${taskId} completed with code ${code}`);
        resolve({ success, code, output });
      });

      claude.on('error', (err) => {
        logStream.end();
        logger.error(`Task ${taskId} failed: ${err.message}`);
        this.markForReview(taskPath, false, err.message);
        this.releaseLock();
        resolve({ success: false, error: err.message });
      });
    });
  }

  /**
   * Run the executor
   */
  async run() {
    logger.info(`Executor started for: ${this.projectPath}`);

    const task = this.findTask();
    if (!task) {
      logger.info('No tasks available');
      return { executed: false };
    }

    const { taskId, taskPath, isResume } = task;

    let executingPath = taskPath;
    if (!isResume) {
      executingPath = this.moveToExecuting(taskPath, taskId);
    }

    const result = await this.executeTask(executingPath, taskId);
    return { executed: true, taskId, ...result };
  }
}

// If run directly
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node executor.js <project-path> [--resume <taskId>]');
    process.exit(1);
  }

  const projectPath = args[0];
  const resumeIndex = args.indexOf('--resume');
  const resumeTaskId = resumeIndex >= 0 ? args[resumeIndex + 1] : null;

  const executor = new Executor(projectPath, { resumeTaskId });
  executor.run()
    .then((result) => {
      if (result.executed) {
        logger.ok(`Task ${result.taskId} completed`);
      } else {
        logger.info('No tasks to execute');
      }
      process.exit(0);
    })
    .catch((err) => {
      logger.error(`Executor error: ${err.message}`);
      process.exit(1);
    });
}

module.exports = Executor;
