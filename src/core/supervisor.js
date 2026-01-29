const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { getCollabDir, getConfigDir, getLogsDir, ensureDir } = require('../utils/paths');
const Logger = require('../utils/logger');

const logger = new Logger('supervisor');

class Supervisor {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.collabDir = getCollabDir(projectPath);
    this.logsDir = getLogsDir(projectPath);

    ensureDir(this.logsDir);
  }

  /**
   * Read inbox content
   */
  readInbox() {
    const inboxPath = path.join(this.collabDir, 'inbox.md');
    if (!fs.existsSync(inboxPath)) {
      return null;
    }

    const content = fs.readFileSync(inboxPath, 'utf8');
    const lines = content.split('\n').filter(line => {
      const trimmed = line.trim();
      return trimmed &&
             !trimmed.startsWith('#') &&
             !trimmed.startsWith('---') &&
             !trimmed.includes('Write new requirements');
    });

    if (lines.length === 0) {
      return null;
    }

    return content;
  }

  /**
   * Clear inbox after processing
   */
  clearInbox() {
    const inboxPath = path.join(this.collabDir, 'inbox.md');
    const template = `# Inbox

Write new requirements here. The Supervisor will process them.

---

`;
    fs.writeFileSync(inboxPath, template, 'utf8');
  }

  /**
   * Get tasks pending review
   */
  getReviewTasks() {
    const executingDir = path.join(this.collabDir, 'executing');
    if (!fs.existsSync(executingDir)) {
      return [];
    }

    const tasks = [];
    const files = fs.readdirSync(executingDir).filter(f => f.endsWith('.md'));

    for (const file of files) {
      const taskPath = path.join(executingDir, file);
      const content = fs.readFileSync(taskPath, 'utf8');

      if (/status:\s*REVIEW/i.test(content)) {
        tasks.push({
          taskId: path.basename(file, '.md'),
          taskPath,
          content
        });
      }
    }

    return tasks;
  }

  /**
   * Move reviewed task to completed or back to queue
   */
  moveTask(taskPath, taskId, approved) {
    const destDir = approved
      ? path.join(this.collabDir, 'completed')
      : path.join(this.collabDir, 'queue');

    ensureDir(destDir);

    let content = fs.readFileSync(taskPath, 'utf8');
    const newStatus = approved ? 'COMPLETED' : 'PENDING';
    content = content.replace(/status:\s*\w+/i, `status: ${newStatus}`);

    if (approved) {
      content = content.replace(/---\n/, `---\ncompleted: ${new Date().toISOString()}\n`);
    } else {
      content += `\n## Rejected\n- Time: ${new Date().toISOString()}\n- Reason: Review failed, needs rework\n`;
    }

    const destPath = path.join(destDir, `${taskId}.md`);
    fs.writeFileSync(destPath, content, 'utf8');
    fs.unlinkSync(taskPath);
  }

  /**
   * Process inbox - create tasks from requirements
   */
  async processInbox(inboxContent) {
    const logFile = path.join(this.logsDir, `supervisor_inbox_${Date.now()}.log`);

    const supervisorGuide = path.join(this.collabDir, 'SUPERVISOR_GUIDE.md');
    let guideContent = '';
    if (fs.existsSync(supervisorGuide)) {
      guideContent = fs.readFileSync(supervisorGuide, 'utf8');
    }

    const queueDir = path.join(this.collabDir, 'queue');
    ensureDir(queueDir);

    const prompt = `You are a Supervisor agent responsible for task planning and distribution.

${guideContent}

## New Requirements from Inbox
${inboxContent}

## Instructions
1. Analyze the requirements
2. Break them down into specific, actionable tasks
3. Create task files in the queue directory

For each task, create a file in ${queueDir} with this format:
- Filename: task_<timestamp>_<short-description>.md
- Content:
\`\`\`markdown
---
id: <unique-id>
status: PENDING
priority: normal
created: <ISO-timestamp>
source: inbox
---
## Task Description
<clear description of what needs to be done>

## Acceptance Criteria
<specific criteria for task completion>

## Notes
<any additional context or constraints>
\`\`\`

Create the task files now. Each task should be independently executable.`;

    logger.info('Processing inbox requirements');

    // Timeout: 15 minutes max for inbox processing
    const INBOX_TIMEOUT = 15 * 60 * 1000;

    return new Promise((resolve) => {
      const claude = spawn('claude', ['-p', prompt, '--dangerously-skip-permissions'], {
        cwd: this.projectPath,
        shell: true,
        env: { ...process.env }
      });

      const logStream = fs.createWriteStream(logFile);
      let output = '';
      let timedOut = false;

      // Set timeout
      const timeoutId = setTimeout(() => {
        timedOut = true;
        logger.warn('Inbox processing timed out');
        logStream.write('\n\n[TIMEOUT] Inbox processing exceeded maximum time\n');
        claude.kill('SIGTERM');
        setTimeout(() => {
          try { claude.kill('SIGKILL'); } catch (e) {}
        }, 10000);
      }, INBOX_TIMEOUT);

      claude.stdout.on('data', (data) => {
        output += data.toString();
        logStream.write(data);
      });

      claude.stderr.on('data', (data) => {
        logStream.write(data);
      });

      claude.on('close', (code) => {
        clearTimeout(timeoutId);
        logStream.end();
        if (!timedOut) {
          this.clearInbox();
        }
        logger.info(`Inbox processing completed with code ${code}${timedOut ? ' (timed out)' : ''}`);
        resolve({ success: !timedOut && code === 0, output, timedOut });
      });

      claude.on('error', (err) => {
        clearTimeout(timeoutId);
        logStream.end();
        logger.error(`Inbox processing failed: ${err.message}`);
        resolve({ success: false, error: err.message });
      });
    });
  }

  /**
   * Review a completed task
   */
  async reviewTask(task) {
    const logFile = path.join(this.logsDir, `supervisor_review_${task.taskId}_${Date.now()}.log`);

    const supervisorGuide = path.join(this.collabDir, 'SUPERVISOR_GUIDE.md');
    let guideContent = '';
    if (fs.existsSync(supervisorGuide)) {
      guideContent = fs.readFileSync(supervisorGuide, 'utf8');
    }

    const prompt = `You are a Supervisor agent reviewing a completed task.

${guideContent}

## Task to Review
${task.content}

## Instructions
1. Review the task completion status
2. Check if the acceptance criteria were met
3. Verify the work was done correctly

Based on your review, you must decide:
- APPROVE: Task is complete and meets criteria
- REJECT: Task needs more work

Output your decision as a single word on the last line: APPROVE or REJECT

If rejecting, explain what needs to be fixed before the decision.`;

    logger.info(`Reviewing task ${task.taskId}`);

    // Timeout: 10 minutes max for review
    const REVIEW_TIMEOUT = 10 * 60 * 1000;

    return new Promise((resolve) => {
      const claude = spawn('claude', ['-p', prompt, '--dangerously-skip-permissions'], {
        cwd: this.projectPath,
        shell: true,
        env: { ...process.env }
      });

      const logStream = fs.createWriteStream(logFile);
      let output = '';
      let timedOut = false;

      // Set timeout
      const timeoutId = setTimeout(() => {
        timedOut = true;
        logger.warn(`Review of task ${task.taskId} timed out`);
        logStream.write('\n\n[TIMEOUT] Review exceeded maximum time\n');
        claude.kill('SIGTERM');
        setTimeout(() => {
          try { claude.kill('SIGKILL'); } catch (e) {}
        }, 10000);
      }, REVIEW_TIMEOUT);

      claude.stdout.on('data', (data) => {
        output += data.toString();
        logStream.write(data);
      });

      claude.stderr.on('data', (data) => {
        logStream.write(data);
      });

      claude.on('close', (code) => {
        clearTimeout(timeoutId);
        logStream.end();

        // Parse decision from output (default to reject if timed out)
        const approved = !timedOut && /APPROVE/i.test(output) && !/REJECT/i.test(output.slice(-100));

        this.moveTask(task.taskPath, task.taskId, approved);
        logger.info(`Task ${task.taskId} ${approved ? 'approved' : 'rejected'}${timedOut ? ' (review timed out)' : ''}`);
        resolve({ success: !timedOut && code === 0, approved, output, timedOut });
      });

      claude.on('error', (err) => {
        clearTimeout(timeoutId);
        logStream.end();
        logger.error(`Review failed: ${err.message}`);
        resolve({ success: false, error: err.message });
      });
    });
  }

  /**
   * Run the supervisor
   */
  async run() {
    logger.info(`Supervisor started for: ${this.projectPath}`);

    // Process inbox first
    const inboxContent = this.readInbox();
    if (inboxContent) {
      await this.processInbox(inboxContent);
    }

    // Then review completed tasks
    const reviewTasks = this.getReviewTasks();
    for (const task of reviewTasks) {
      await this.reviewTask(task);
    }

    logger.ok('Supervisor cycle completed');
    return { processed: !!inboxContent, reviewed: reviewTasks.length };
  }
}

// If run directly
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node supervisor.js <project-path>');
    process.exit(1);
  }

  const projectPath = args[0];
  const supervisor = new Supervisor(projectPath);

  supervisor.run()
    .then((result) => {
      logger.ok(`Supervisor done: processed inbox=${result.processed}, reviewed=${result.reviewed}`);
      process.exit(0);
    })
    .catch((err) => {
      logger.error(`Supervisor error: ${err.message}`);
      process.exit(1);
    });
}

module.exports = Supervisor;
