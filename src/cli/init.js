#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { getCollabDir, getConfigDir, ensureDir } = require('../utils/paths');
const { registerProject } = require('../utils/projects');
const Logger = require('../utils/logger');

const logger = new Logger('init');

/**
 * Initialize a project for AutoClaude
 */
function initProject(projectPath, options = {}) {
  const collabDir = getCollabDir(projectPath);
  const configDir = getConfigDir(projectPath);

  // Create directory structure
  const dirs = [
    collabDir,
    path.join(collabDir, 'queue'),
    path.join(collabDir, 'executing'),
    path.join(collabDir, 'completed'),
    configDir,
    path.join(configDir, 'lock'),
    path.join(configDir, 'logs')
  ];

  for (const dir of dirs) {
    ensureDir(dir);
  }

  // Create inbox.md
  const inboxPath = path.join(collabDir, 'inbox.md');
  if (!fs.existsSync(inboxPath)) {
    fs.writeFileSync(inboxPath, `# Inbox

Write new requirements here. The Supervisor will process them.

---

`, 'utf8');
  }

  // Create project_plan.md
  const planPath = path.join(collabDir, 'project_plan.md');
  if (!fs.existsSync(planPath)) {
    fs.writeFileSync(planPath, `# Project Plan

## Overview
Describe your project goals and architecture here.

## Current Status
- [ ] Initial setup

## Notes
Add any important notes for the AI agents.
`, 'utf8');
  }

  // Copy templates - check multiple possible locations
  const possibleTemplateDirs = [
    path.join(__dirname, '..', '..', 'templates'),
    path.join(process.resourcesPath || '', 'templates'),
    path.join(__dirname, '..', '..', '..', 'templates')
  ];

  let templatesDir = possibleTemplateDirs[0];
  for (const dir of possibleTemplateDirs) {
    if (fs.existsSync(dir)) {
      templatesDir = dir;
      break;
    }
  }

  // SUPERVISOR_GUIDE.md
  const supervisorGuide = path.join(collabDir, 'SUPERVISOR_GUIDE.md');
  if (!fs.existsSync(supervisorGuide)) {
    const templatePath = path.join(templatesDir, 'SUPERVISOR_GUIDE.md');
    if (fs.existsSync(templatePath)) {
      fs.copyFileSync(templatePath, supervisorGuide);
    } else {
      fs.writeFileSync(supervisorGuide, getDefaultSupervisorGuide(), 'utf8');
    }
  }

  // EXECUTOR_GUIDE.md
  const executorGuide = path.join(collabDir, 'EXECUTOR_GUIDE.md');
  if (!fs.existsSync(executorGuide)) {
    const templatePath = path.join(templatesDir, 'EXECUTOR_GUIDE.md');
    if (fs.existsSync(templatePath)) {
      fs.copyFileSync(templatePath, executorGuide);
    } else {
      fs.writeFileSync(executorGuide, getDefaultExecutorGuide(), 'utf8');
    }
  }

  // config.json
  const configPath = path.join(configDir, 'config.json');
  if (!fs.existsSync(configPath)) {
    const config = {
      version: '2.0.0',
      created: new Date().toISOString(),
      allowed_tools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep']
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  }

  // Create CLAUDE.md for user interaction rules
  const claudeMdPath = path.join(projectPath, 'CLAUDE.md');
  if (!fs.existsSync(claudeMdPath)) {
    const templatePath = path.join(templatesDir, 'CLAUDE.md');
    if (fs.existsSync(templatePath)) {
      fs.copyFileSync(templatePath, claudeMdPath);
    } else {
      fs.writeFileSync(claudeMdPath, getDefaultClaudeMd(), 'utf8');
    }
  }

  // Register project
  const projectName = options.name || path.basename(projectPath);
  registerProject(projectPath, projectName);

  // Generate initial dashboard
  try {
    const dashboard = require('../core/dashboard');
    dashboard.generate(projectPath);
  } catch (e) {
    // Dashboard generation optional
  }

  logger.ok(`Project initialized: ${projectPath}`);
  return true;
}

function getDefaultSupervisorGuide() {
  return `# Supervisor Guide

You are the Supervisor agent. Your responsibilities:

## Task Planning
1. Read requirements from inbox.md
2. Break down into specific, actionable tasks
3. Create task files in queue/

## Task Review
1. Review completed tasks in executing/ with status: REVIEW
2. Check acceptance criteria
3. Approve (move to completed/) or reject (back to queue/)

## Task File Format
\`\`\`markdown
---
id: task_<timestamp>
status: PENDING
priority: normal
created: <ISO-timestamp>
---
## Task Description
<what needs to be done>

## Acceptance Criteria
<how to verify completion>
\`\`\`

## Guidelines
- Keep tasks focused and specific
- One task = one logical unit of work
- Include clear acceptance criteria
- Consider dependencies between tasks
`;
}

function getDefaultExecutorGuide() {
  return `# Executor Guide

You are an Executor agent. Your responsibilities:

## Task Execution
1. Pick up tasks from queue/
2. Implement the required changes
3. Test your changes
4. Mark task for review

## Guidelines
- Work only on the assigned task
- Follow the project's coding standards
- Write tests when appropriate
- Document significant changes
- Don't modify unrelated files

## When Done
- Update task status to REVIEW
- Provide a summary of changes made
- List any issues encountered
`;
}

function getDefaultClaudeMd() {
  return `# AutoClaude Integration

This project uses AutoClaude for continuous development.

## Creating Tasks

When you say any of these phrases, I'll create a task for the Supervisor:
- "continuous task" / "background task"
- "auto execute" / "let supervisor handle"
- "add to queue"

## Task Format

I'll create tasks in \`collaboration/queue/\` with:
- Clear description of requirements
- Acceptance criteria
- Priority level

## Collaboration Directory

- \`collaboration/inbox.md\` - Write requirements here
- \`collaboration/queue/\` - Pending tasks
- \`collaboration/executing/\` - Tasks in progress
- \`collaboration/completed/\` - Finished tasks
- \`collaboration/dashboard.html\` - Status overview
`;
}

// If run directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const projectPath = args[0] || process.cwd();

  if (!fs.existsSync(projectPath)) {
    console.error(`Directory not found: ${projectPath}`);
    process.exit(1);
  }

  initProject(projectPath);
  console.log(`AutoClaude initialized in: ${projectPath}`);
  console.log('');
  console.log('Next steps:');
  console.log('1. Write requirements in collaboration/inbox.md');
  console.log('2. Start AutoClaude tray app to begin processing');
}

module.exports = { initProject };
