const fs = require('fs');
const path = require('path');
const Watcher = require('../../src/core/watcher');

describe('Watcher', () => {
  let testProject;
  let watcher;
  
  beforeEach(() => {
    testProject = createTestProject(path.join(global.TEST_TEMP_DIR, 'test-project'));
    watcher = new Watcher();
  });
  
  afterEach(() => {
    if (watcher.running) {
      watcher.stop();
    }
  });

  describe('checkProject', () => {
    test('should return false for non-existent project', () => {
      const result = watcher.checkProject('/non/existent/path');
      expect(result.error).toBeTruthy();
      expect(result.needsSupervisor).toBe(false);
      expect(result.needsExecutor).toBe(false);
    });

    test('should return false for uninitialized project', () => {
      const uninitializedPath = path.join(global.TEST_TEMP_DIR, 'uninit');
      fs.mkdirSync(uninitializedPath, { recursive: true });
      
      const result = watcher.checkProject(uninitializedPath);
      expect(result.needsSupervisor).toBe(false);
      expect(result.needsExecutor).toBe(false);
    });

    test('should detect inbox.md content and trigger supervisor', () => {
      const inboxPath = path.join(testProject.collabDir, 'inbox.md');
      fs.writeFileSync(inboxPath, 'New requirement: Build a calculator app');
      
      const result = watcher.checkProject(testProject.projectPath);
      expect(result.needsSupervisor).toBe(true);
      expect(result.reason).toContain('inbox.md has new content');
    });

    test('should ignore empty inbox.md with only template content', () => {
      const inboxPath = path.join(testProject.collabDir, 'inbox.md');
      const templateContent = `# Requirements
---
Write new requirements here:`;
      fs.writeFileSync(inboxPath, templateContent);
      
      const result = watcher.checkProject(testProject.projectPath);
      expect(result.needsSupervisor).toBe(false);
    });

    test('should detect queued tasks and trigger executor', () => {
      const queueDir = path.join(testProject.collabDir, 'queue');
      fs.writeFileSync(path.join(queueDir, 'task-001.md'), 'Task content');
      fs.writeFileSync(path.join(queueDir, 'task-002.md'), 'Another task');
      
      const result = watcher.checkProject(testProject.projectPath);
      expect(result.needsExecutor).toBe(true);
      expect(result.reason).toContain('queue/ has 2 pending task(s)');
    });

    test('should detect tasks pending review', () => {
      const executingDir = path.join(testProject.collabDir, 'executing');
      const taskContent = `---
status: REVIEW
---
Task completed, needs review`;
      fs.writeFileSync(path.join(executingDir, 'task-review.md'), taskContent);
      
      const result = watcher.checkProject(testProject.projectPath);
      expect(result.needsSupervisor).toBe(true);
      expect(result.reason).toContain('task(s) pending review');
    });
  });

  describe('getRunningExecutorCount', () => {
    test('should return 0 for project without lock directory', () => {
      const count = watcher.getRunningExecutorCount(testProject.projectPath);
      expect(count).toBe(0);
    });

    test('should count valid lock files with running processes', () => {
      const lockDir = path.join(testProject.configDir, 'lock');
      fs.mkdirSync(lockDir, { recursive: true });
      
      // Create lock file with current process PID
      const lockFile = {
        pid: process.pid,
        taskId: 'test-task',
        timestamp: Date.now()
      };
      fs.writeFileSync(path.join(lockDir, 'test-task.lock'), JSON.stringify(lockFile));
      
      const count = watcher.getRunningExecutorCount(testProject.projectPath);
      expect(count).toBe(1);
    });

    test('should ignore lock files with dead processes', () => {
      const lockDir = path.join(testProject.configDir, 'lock');
      fs.mkdirSync(lockDir, { recursive: true });
      
      // Create lock file with non-existent PID
      const lockFile = {
        pid: 999999,
        taskId: 'dead-task',
        timestamp: Date.now()
      };
      fs.writeFileSync(path.join(lockDir, 'dead-task.lock'), JSON.stringify(lockFile));
      
      const count = watcher.getRunningExecutorCount(testProject.projectPath);
      expect(count).toBe(0);
    });
  });

  describe('initialization', () => {
    test('should initialize with correct defaults', () => {
      expect(watcher.running).toBe(false);
      expect(watcher.interval).toBe(null);
      expect(watcher.supervisorProcesses).toBeInstanceOf(Map);
      expect(watcher.executorProcesses).toBeInstanceOf(Map);
    });
  });
});