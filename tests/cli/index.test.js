const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

describe('CLI', () => {
  let testProject;
  let cliPath;

  beforeEach(() => {
    testProject = createTestProject(path.join(global.TEST_TEMP_DIR, 'cli-test-project'));
    cliPath = path.resolve(__dirname, '../../src/cli/index.js');
  });

  describe('init command', () => {
    test('should initialize a new project', async () => {
      const newProjectPath = path.join(require('os').tmpdir(), 'autoclaude-init-' + Date.now());
      fs.mkdirSync(newProjectPath, { recursive: true });

      const { stdout } = await execAsync(`node "${cliPath}" init "${newProjectPath}"`);

      expect(stdout).toContain('AutoClaude initialized');
      expect(fs.existsSync(path.join(newProjectPath, 'collaboration'))).toBe(true);
      expect(fs.existsSync(path.join(newProjectPath, 'collaboration', 'inbox.md'))).toBe(true);
    });

    test('should initialize current directory when no path given', async () => {
      const cwd = testProject.projectPath;
      const { stdout } = await execAsync(`node "${cliPath}" init`, { cwd });

      expect(stdout).toContain('AutoClaude initialized');
      expect(fs.existsSync(path.join(cwd, 'collaboration'))).toBe(true);
    });
  });

  describe('status command', () => {
    test('should show project status', async () => {
      const { stdout } = await execAsync(`node "${cliPath}" status "${testProject.projectPath}"`);

      expect(stdout).toContain('Queue:');
      expect(stdout).toContain('Executing:');
      expect(stdout).toContain('Completed:');
    });

    test('should fail for uninitialized project', async () => {
      const uninitPath = path.join(global.TEST_TEMP_DIR, 'uninit');
      fs.mkdirSync(uninitPath, { recursive: true });

      try {
        await execAsync(`node "${cliPath}" status "${uninitPath}"`);
        fail('Should have failed for uninitialized project');
      } catch (error) {
        expect(error.stderr || error.stdout).toContain('not initialized');
      }
    });
  });

  describe('task command', () => {
    test('should create a new task', async () => {
      const taskDescription = 'Build a calculator component';
      const { stdout } = await execAsync(
        `node "${cliPath}" task "${taskDescription}"`,
        { cwd: testProject.projectPath }
      );

      expect(stdout).toContain('Task created:');
      expect(stdout).toContain('Task ID:');

      // Check if task file was created
      const queueDir = path.join(testProject.collabDir, 'queue');
      const files = fs.readdirSync(queueDir);
      expect(files.length).toBe(1);
      expect(files[0]).toMatch(/\.md$/);

      // Check task content
      const taskContent = fs.readFileSync(path.join(queueDir, files[0]), 'utf8');
      expect(taskContent).toContain(taskDescription);
      expect(taskContent).toContain('status: PENDING');
    });

    test('should create task with specified priority', async () => {
      const { stdout } = await execAsync(
        `node "${cliPath}" task "High priority task" --priority high`,
        { cwd: testProject.projectPath }
      );

      expect(stdout).toContain('Task created:');

      const queueDir = path.join(testProject.collabDir, 'queue');
      const files = fs.readdirSync(queueDir);
      const taskContent = fs.readFileSync(path.join(queueDir, files[0]), 'utf8');
      expect(taskContent).toContain('priority: high');
    });
  });

  describe('watch command', () => {
    test('should run once and exit', async () => {
      const { stdout } = await execAsync(
        `node "${cliPath}" watch --once`,
        { cwd: testProject.projectPath }
      );

      expect(stdout).toContain('Single check complete');
    }, 10000); // Longer timeout for this test
  });
});