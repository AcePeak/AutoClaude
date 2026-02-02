const { registerContextMenu, unregisterContextMenu } = require('../../src/utils/context-menu');

// Mock child_process
jest.mock('child_process', () => ({
  execSync: jest.fn()
}));

// Mock path and fs for installation directory detection
const mockPath = require('path');
const mockFs = require('fs');

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn()
}));

describe('context-menu utils', () => {
  let originalPlatform;
  let mockExecSync;

  beforeEach(() => {
    jest.clearAllMocks();
    originalPlatform = process.platform;
    
    // Get the mocked function
    mockExecSync = require('child_process').execSync;
    
    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    jest.restoreAllMocks();
  });

  describe('registerContextMenu', () => {
    test('should register context menu successfully on Windows', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      
      // Mock node path detection
      mockExecSync
        .mockReturnValueOnce('C:\\Program Files\\nodejs\\node.exe\n') // where node
        .mockReturnValue(''); // Registry commands

      // Mock file system checks for installation directory
      mockFs.existsSync.mockImplementation((path) => {
        return path.includes('package.json');
      });

      // Mock require to return autoclaude package
      const mockPackageJson = { name: 'autoclaude' };
      jest.doMock(mockPath.join(process.cwd(), 'package.json'), () => mockPackageJson, { virtual: true });

      const result = registerContextMenu();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Context menu registered successfully');
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('reg add'),
        expect.objectContaining({ stdio: 'ignore' })
      );
    });

    test('should fail on non-Windows platforms', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      const result = registerContextMenu();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Only available on Windows');
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    test('should handle registry command errors', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      
      // Mock node path detection
      mockExecSync.mockReturnValueOnce('C:\\Program Files\\nodejs\\node.exe\n');
      
      // Mock file system checks
      mockFs.existsSync.mockImplementation((path) => {
        return path.includes('package.json');
      });

      // Mock package.json
      const mockPackageJson = { name: 'autoclaude' };
      jest.doMock(mockPath.join(process.cwd(), 'package.json'), () => mockPackageJson, { virtual: true });

      // Mock registry command failure
      mockExecSync.mockImplementationOnce(() => 'node path') // Node detection succeeds
        .mockImplementation(() => {
          throw new Error('Registry access denied');
        });

      const result = registerContextMenu();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Registry access denied');
    });

    test('should handle missing node executable', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      
      // Mock node path detection failure
      mockExecSync.mockImplementation((cmd) => {
        if (cmd.includes('where node')) {
          throw new Error('Command not found');
        }
        return ''; // Registry commands succeed
      });

      // Mock file system checks
      mockFs.existsSync.mockImplementation((path) => {
        return path.includes('package.json');
      });

      // Mock package.json
      const mockPackageJson = { name: 'autoclaude' };
      jest.doMock(mockPath.join(process.cwd(), 'package.json'), () => mockPackageJson, { virtual: true });

      const result = registerContextMenu();

      // Should still succeed with fallback 'node' command
      expect(result.success).toBe(true);
    });
  });

  describe('unregisterContextMenu', () => {
    test('should unregister context menu successfully on Windows', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      
      mockExecSync.mockReturnValue(''); // All registry delete commands succeed

      const result = unregisterContextMenu();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Context menu unregistered successfully');
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('reg delete'),
        expect.objectContaining({ stdio: 'ignore' })
      );
    });

    test('should fail on non-Windows platforms', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });

      const result = unregisterContextMenu();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Only available on Windows');
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    test('should handle registry deletion errors gracefully', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      
      // Mock registry deletion - some succeed, some fail (key doesn't exist)
      mockExecSync.mockImplementation((cmd) => {
        if (cmd.includes('AutoClaudeInit')) {
          throw new Error('Registry key not found');
        }
        return ''; // Other commands succeed
      });

      const result = unregisterContextMenu();

      // Should still return success even if some keys don't exist
      expect(result.success).toBe(true);
      expect(result.message).toBe('Context menu unregistered successfully');
    });

    test('should still succeed even if individual deletes fail', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });

      // Individual errors are swallowed (keys might not exist)
      mockExecSync.mockImplementation(() => {
        throw new Error('Access denied');
      });

      const result = unregisterContextMenu();

      // Inner try/catch swallows per-key errors, so overall still succeeds
      expect(result.success).toBe(true);
      expect(result.message).toBe('Context menu unregistered successfully');
    });
  });
});