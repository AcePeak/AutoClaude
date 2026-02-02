const path = require('path');
const fs = require('fs');
const os = require('os');

// Mock the CLI init module
jest.mock('../../src/cli/init', () => ({
  initProjectSync: jest.fn()
}));

// Mock child_process.spawn
jest.mock('child_process', () => ({
  spawn: jest.fn()
}));

describe('init-project action', () => {
  let tempDir;
  let mockInitProjectSync;

  beforeEach(() => {
    jest.clearAllMocks();
    tempDir = path.join(os.tmpdir(), 'autoclaude-test-' + Date.now());
    fs.mkdirSync(tempDir, { recursive: true });

    mockInitProjectSync = require('../../src/cli/init').initProjectSync;

    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(process, 'exit').mockImplementation();
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    jest.restoreAllMocks();
  });

  test('should initialize project successfully', () => {
    const { main } = require('../../src/actions/init-project');

    mockInitProjectSync.mockReturnValue(true);
    main(tempDir);

    expect(mockInitProjectSync).toHaveBeenCalledWith(tempDir, { name: path.basename(tempDir) });
    expect(console.log).toHaveBeenCalledWith(`[OK] AutoClaude project initialized: ${tempDir}`);
  });

  test('should handle directory not exists error', () => {
    const { main } = require('../../src/actions/init-project');
    const fakePath = path.join(os.tmpdir(), 'nonexistent-' + Date.now());

    main(fakePath);

    expect(console.error).toHaveBeenCalledWith(`[ERROR] Directory does not exist: ${fakePath}`);
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  test('should handle already initialized project', () => {
    const { main } = require('../../src/actions/init-project');

    // Create collaboration dir to simulate initialized project
    fs.mkdirSync(path.join(tempDir, 'collaboration'), { recursive: true });

    main(tempDir);

    expect(console.log).toHaveBeenCalledWith('[INFO] Project already initialized');
    expect(mockInitProjectSync).not.toHaveBeenCalled();
  });

  test('should handle missing path argument', () => {
    const { main } = require('../../src/actions/init-project');

    main(null);

    expect(console.error).toHaveBeenCalledWith('[ERROR] --path argument is required');
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  test('should handle initialization error', () => {
    const { main } = require('../../src/actions/init-project');

    mockInitProjectSync.mockImplementation(() => {
      throw new Error('Initialization failed');
    });

    main(tempDir);

    expect(console.error).toHaveBeenCalledWith('[ERROR] Initialization failed');
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  test('should parse --path from argv', () => {
    const { parsePath } = require('../../src/actions/init-project');

    expect(parsePath(['--path', '/some/dir'])).toBe(path.resolve('/some/dir'));
    expect(parsePath(['--other'])).toBeNull();
    expect(parsePath([])).toBeNull();
  });
});
