const path = require('path');
const { getCollabDir, getConfigDir, getLockDir, ensureDir } = require('../../src/utils/paths');
const fs = require('fs');

describe('paths utils', () => {
  const testProjectPath = path.join(global.TEST_TEMP_DIR, 'test-project');

  describe('getCollabDir', () => {
    test('should return collaboration directory path', () => {
      const result = getCollabDir(testProjectPath);
      expect(result).toBe(path.join(testProjectPath, 'collaboration'));
    });
  });

  describe('getConfigDir', () => {
    test('should return .autoclaude config directory path', () => {
      const result = getConfigDir(testProjectPath);
      expect(result).toBe(path.join(testProjectPath, 'collaboration', '.autoclaude'));
    });
  });

  describe('getLockDir', () => {
    test('should return lock directory path', () => {
      const result = getLockDir(testProjectPath);
      expect(result).toBe(path.join(testProjectPath, 'collaboration', '.autoclaude', 'lock'));
    });
  });

  describe('ensureDir', () => {
    test('should create directory if it does not exist', () => {
      const testDir = path.join(global.TEST_TEMP_DIR, 'new-directory');
      
      expect(fs.existsSync(testDir)).toBe(false);
      ensureDir(testDir);
      expect(fs.existsSync(testDir)).toBe(true);
    });

    test('should not throw error if directory already exists', () => {
      const testDir = path.join(global.TEST_TEMP_DIR, 'existing-directory');
      fs.mkdirSync(testDir, { recursive: true });
      
      expect(() => ensureDir(testDir)).not.toThrow();
    });
  });
});