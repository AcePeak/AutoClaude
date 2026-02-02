const fs = require('fs');
const path = require('path');
const os = require('os');
const { startDaemon, stopDaemon, getDaemonStatus } = require('../../src/utils/daemon');

// Mock child_process
jest.mock('child_process', () => ({
  spawn: jest.fn()
}));

describe('daemon utils', () => {
  let tempDir;
  let originalHomedir;
  let mockSpawn;

  beforeEach(() => {
    jest.clearAllMocks();
    tempDir = path.join(os.tmpdir(), 'autoclaude-daemon-test-' + Date.now());
    fs.mkdirSync(tempDir, { recursive: true });
    
    // Get the mocked function
    mockSpawn = require('child_process').spawn;
    
    // Mock os.homedir to point to our temp directory
    originalHomedir = os.homedir;
    jest.spyOn(os, 'homedir').mockReturnValue(tempDir);
    
    // Mock process.kill
    jest.spyOn(process, 'kill').mockImplementation();
    
    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    jest.restoreAllMocks();
    os.homedir = originalHomedir;
  });

  describe('startDaemon', () => {
    test('should start daemon successfully', () => {
      const mockChildProcess = {
        pid: 12345,
        unref: jest.fn()
      };
      
      mockSpawn.mockReturnValue(mockChildProcess);

      const result = startDaemon('/test/project');

      expect(result).toEqual({ success: true, pid: 12345 });
      expect(mockSpawn).toHaveBeenCalledWith(
        process.argv[0],
        expect.arrayContaining(['start', '/test/project']),
        expect.objectContaining({ detached: true, stdio: 'ignore' })
      );
      expect(mockChildProcess.unref).toHaveBeenCalled();

      // Check PID file was created
      const configDir = process.platform === 'win32' 
        ? path.join(tempDir, 'AppData', 'Roaming', 'AutoClaude')
        : path.join(tempDir, '.config', 'autoclaude');
      const pidFile = path.join(configDir, 'daemon.pid');
      
      expect(fs.existsSync(pidFile)).toBe(true);
      
      const pidData = JSON.parse(fs.readFileSync(pidFile, 'utf8'));
      expect(pidData.pid).toBe(12345);
      expect(pidData.projectPath).toBe('/test/project');
    });

    test('should prevent starting multiple daemons', () => {
      // Create existing PID file
      const configDir = process.platform === 'win32' 
        ? path.join(tempDir, 'AppData', 'Roaming', 'AutoClaude')
        : path.join(tempDir, '.config', 'autoclaude');
      fs.mkdirSync(configDir, { recursive: true });
      
      const pidFile = path.join(configDir, 'daemon.pid');
      fs.writeFileSync(pidFile, JSON.stringify({ pid: 999, projectPath: '/test' }));

      // Mock that process is running
      jest.spyOn(process, 'kill').mockImplementation((pid, signal) => {
        if (pid === 999 && signal === 0) {
          return; // Process exists
        }
        throw new Error('Process not found');
      });

      expect(() => startDaemon('/test/project')).toThrow('AutoClaude daemon already running (PID: 999)');
    });
  });

  describe('stopDaemon', () => {
    test('should stop daemon successfully', () => {
      // Create PID file
      const configDir = process.platform === 'win32' 
        ? path.join(tempDir, 'AppData', 'Roaming', 'AutoClaude')
        : path.join(tempDir, '.config', 'autoclaude');
      fs.mkdirSync(configDir, { recursive: true });
      
      const pidFile = path.join(configDir, 'daemon.pid');
      fs.writeFileSync(pidFile, JSON.stringify({ pid: 999, projectPath: '/test' }));

      // Mock that process is running
      let processExists = true;
      jest.spyOn(process, 'kill').mockImplementation((pid, signal) => {
        if (pid === 999) {
          if (signal === 0) {
            if (!processExists) throw new Error('Process not found');
            return;
          }
          if (signal === 'SIGTERM') {
            processExists = false; // Simulate process termination
            return;
          }
        }
        throw new Error('Process not found');
      });

      const result = stopDaemon();

      expect(result).toEqual({ success: true, pid: 999 });
      expect(process.kill).toHaveBeenCalledWith(999, 'SIGTERM');
      expect(fs.existsSync(pidFile)).toBe(false);
    });

    test('should handle no PID file', () => {
      const result = stopDaemon();
      expect(result).toEqual({ success: false, message: 'No daemon PID file found' });
    });

    test('should handle stale PID file', () => {
      // Create PID file
      const configDir = process.platform === 'win32' 
        ? path.join(tempDir, 'AppData', 'Roaming', 'AutoClaude')
        : path.join(tempDir, '.config', 'autoclaude');
      fs.mkdirSync(configDir, { recursive: true });
      
      const pidFile = path.join(configDir, 'daemon.pid');
      fs.writeFileSync(pidFile, JSON.stringify({ pid: 999, projectPath: '/test' }));

      // Mock that process doesn't exist
      jest.spyOn(process, 'kill').mockImplementation(() => {
        throw new Error('Process not found');
      });

      const result = stopDaemon();

      expect(result).toEqual({ success: false, message: 'Daemon process not found' });
      expect(fs.existsSync(pidFile)).toBe(false); // Stale file should be cleaned up
    });
  });

  describe('getDaemonStatus', () => {
    test('should return running status', () => {
      // Create PID file
      const configDir = process.platform === 'win32' 
        ? path.join(tempDir, 'AppData', 'Roaming', 'AutoClaude')
        : path.join(tempDir, '.config', 'autoclaude');
      fs.mkdirSync(configDir, { recursive: true });
      
      const pidFile = path.join(configDir, 'daemon.pid');
      const pidData = {
        pid: 999,
        projectPath: '/test',
        startTime: '2023-01-01T00:00:00.000Z'
      };
      fs.writeFileSync(pidFile, JSON.stringify(pidData));

      // Mock that process is running
      jest.spyOn(process, 'kill').mockImplementation((pid, signal) => {
        if (pid === 999 && signal === 0) {
          return; // Process exists
        }
        throw new Error('Process not found');
      });

      const result = getDaemonStatus();

      expect(result).toEqual({
        running: true,
        pid: 999,
        startTime: '2023-01-01T00:00:00.000Z',
        projectPath: '/test'
      });
    });

    test('should return not running for no PID file', () => {
      const result = getDaemonStatus();
      expect(result).toEqual({ running: false, message: 'No daemon PID file found' });
    });
  });
});