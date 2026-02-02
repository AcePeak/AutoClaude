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

  // ── macOS ──

  describe('registerContextMenu (macOS)', () => {
    test('should install Quick Actions', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      mockExecSync.mockReturnValueOnce('/usr/local/bin/node\n').mockReturnValue('');
      mockFs.existsSync.mockImplementation((p) => {
        if (p.includes('.workflow')) return false; // workflow doesn't exist yet
        return true; // package.json etc. exist
      });
      mockFs.readFileSync.mockReturnValue(JSON.stringify({ name: 'autoclaude' }));

      const result = registerContextMenu();

      expect(result.success).toBe(true);
      expect(result.message).toContain('Installed 3 Quick Actions');
      // 3 Contents dirs (Services dir already exists in this mock)
      expect(mockFs.mkdirSync).toHaveBeenCalledTimes(3);
      expect(mockFs.writeFileSync).toHaveBeenCalledTimes(6); // 3 Info.plist + 3 document.wflow
    });

    test('should overwrite existing workflows', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      mockExecSync.mockReturnValueOnce('/usr/local/bin/node\n').mockReturnValue('');
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({ name: 'autoclaude' }));

      const result = registerContextMenu();

      expect(result.success).toBe(true);
      // Should have called rmSync to remove existing workflows
      expect(mockFs.rmSync).toHaveBeenCalledTimes(3);
    });
  });

  describe('unregisterContextMenu (macOS)', () => {
    test('should remove Quick Actions', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      mockFs.existsSync.mockReturnValue(true);

      const result = unregisterContextMenu();

      expect(result.success).toBe(true);
      expect(result.message).toContain('Removed 3 Quick Action(s)');
      expect(mockFs.rmSync).toHaveBeenCalledTimes(3);
    });

    test('should handle no existing workflows', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      mockFs.existsSync.mockReturnValue(false);

      const result = unregisterContextMenu();

      expect(result.success).toBe(true);
      expect(result.message).toContain('No AutoClaude Quick Actions found');
    });
  });

  // ── Linux ──

  describe('unsupported platform', () => {
    test('should return not supported for Linux', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });

      expect(registerContextMenu().success).toBe(false);
      expect(unregisterContextMenu().success).toBe(false);
    });
  });
});
