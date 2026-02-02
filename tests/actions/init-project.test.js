const path = require('path');
const fs = require('fs');
const os = require('os');
const { main } = require('../../src/actions/init-project');

// Mock commander program
jest.mock('commander', () => ({
  program: {
    option: jest.fn().mockReturnThis(),
    parse: jest.fn(),
    opts: jest.fn(() => ({ path: '/test/path' }))
  }
}));

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
    
    // Get the mocked function
    mockInitProjectSync = require('../../src/cli/init').initProjectSync;
    
    // Mock console methods
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
    // Mock fs methods to simulate directory exists
    const existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    const statSyncSpy = jest.spyOn(fs, 'statSync').mockReturnValue({ isDirectory: () => true });

    // Mock commander to return our test path
    const { program } = require('commander');
    program.opts.mockReturnValue({ path: tempDir });

    // Mock successful initialization
    mockInitProjectSync.mockReturnValue(true);

    main();

    expect(mockInitProjectSync).toHaveBeenCalledWith(tempDir, { name: path.basename(tempDir) });
    expect(console.log).toHaveBeenCalledWith(`[OK] AutoClaude project initialized: ${tempDir}`);
    
    existsSyncSpy.mockRestore();
    statSyncSpy.mockRestore();
  });

  test('should handle directory not exists error', () => {
    const existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    
    const { program } = require('commander');
    program.opts.mockReturnValue({ path: '/nonexistent/path' });

    main();

    expect(console.error).toHaveBeenCalledWith('[ERROR] Directory does not exist: /nonexistent/path');
    expect(process.exit).toHaveBeenCalledWith(1);
    
    existsSyncSpy.mockRestore();
  });

  test('should handle already initialized project', () => {
    const existsSyncSpy = jest.spyOn(fs, 'existsSync')
      .mockReturnValueOnce(true) // Directory exists
      .mockReturnValueOnce(true); // collaboration/ exists
    const statSyncSpy = jest.spyOn(fs, 'statSync').mockReturnValue({ isDirectory: () => true });

    const { program } = require('commander');
    program.opts.mockReturnValue({ path: tempDir });

    main();

    expect(console.log).toHaveBeenCalledWith('[INFO] Project already initialized');
    expect(mockInitProjectSync).not.toHaveBeenCalled();
    
    existsSyncSpy.mockRestore();
    statSyncSpy.mockRestore();
  });

  test('should handle missing --path argument', () => {
    const { program } = require('commander');
    program.opts.mockReturnValue({});

    main();

    expect(console.error).toHaveBeenCalledWith('[ERROR] --path argument is required');
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  test('should handle initialization error', () => {
    const existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    const statSyncSpy = jest.spyOn(fs, 'statSync').mockReturnValue({ isDirectory: () => true });

    const { program } = require('commander');
    program.opts.mockReturnValue({ path: tempDir });

    mockInitProjectSync.mockImplementation(() => {
      throw new Error('Initialization failed');
    });

    main();

    expect(console.error).toHaveBeenCalledWith('[ERROR] Initialization failed');
    expect(process.exit).toHaveBeenCalledWith(1);
    
    existsSyncSpy.mockRestore();
    statSyncSpy.mockRestore();
  });
});