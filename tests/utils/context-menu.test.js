const { registerContextMenu, unregisterContextMenu } = require('../../src/utils/context-menu');

// Mock child_process
jest.mock('child_process', () => ({
  execSync: jest.fn()
}));

const mockFs = require('fs');

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  rmSync: jest.fn(),
}));

describe('context-menu utils', () => {
  let originalPlatform;
  let mockExecSync;

  beforeEach(() => {
    jest.clearAllMocks();
    originalPlatform = process.platform;
    mockExecSync = require('child_process').execSync;
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    jest.restoreAllMocks();
  });

  // ── Windows ──

  describe('registerContextMenu (Windows)', () => {
    test('should register context menu successfully', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });

      mockExecSync
        .mockReturnValueOnce('C:\\Program Files\\nodejs\\node.exe\n')
        .mockReturnValue('');
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({ name: 'autoclaude' }));

      const result = registerContextMenu();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Context menu registered successfully');
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('reg add'),
        expect.objectContaining({ stdio: 'ignore' })
      );
    });

    test('should handle registry errors', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });

      mockExecSync.mockReturnValueOnce('node')
        .mockImplementation(() => { throw new Error('Registry access denied'); });
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({ name: 'autoclaude' }));

      const result = registerContextMenu();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Registry access denied');
    });
  });

  describe('unregisterContextMenu (Windows)', () => {
    test('should unregister successfully', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      mockExecSync.mockReturnValue('');

      const result = unregisterContextMenu();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Context menu unregistered successfully');
    });

    test('should still succeed even if individual deletes fail', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      mockExecSync.mockImplementation(() => { throw new Error('Not found'); });

      const result = unregisterContextMenu();

      expect(result.success).toBe(true);
    });
  });

  // ── Non-Windows (macOS, Linux) ──

  describe('non-Windows platforms', () => {
    test('should return not supported on macOS', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      const reg = registerContextMenu();
      expect(reg.success).toBe(false);
      expect(reg.message).toContain('only supported on Windows');

      const unreg = unregisterContextMenu();
      expect(unreg.success).toBe(false);
      expect(unreg.message).toContain('only supported on Windows');
    });

    test('should return not supported on Linux', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });

      expect(registerContextMenu().success).toBe(false);
      expect(unregisterContextMenu().success).toBe(false);
    });
  });
});
