const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

// Get PID file path
function getPidFilePath() {
  const appDataDir = process.platform === 'win32' 
    ? path.join(os.homedir(), 'AppData', 'Roaming', 'AutoClaude')
    : path.join(os.homedir(), '.config', 'autoclaude');
  
  if (!fs.existsSync(appDataDir)) {
    fs.mkdirSync(appDataDir, { recursive: true });
  }
  
  return path.join(appDataDir, 'daemon.pid');
}

// Check if a process is running
function isProcessRunning(pid) {
  try {
    // Sending signal 0 checks if process exists without actually signaling it
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return false;
  }
}

// Start daemon
function startDaemon(projectPath) {
  const pidFile = getPidFilePath();
  
  // Check if daemon is already running
  if (fs.existsSync(pidFile)) {
    try {
      const pidData = JSON.parse(fs.readFileSync(pidFile, 'utf8'));
      const existingPid = pidData.pid;
      if (existingPid && isProcessRunning(existingPid)) {
        throw new Error(`AutoClaude daemon already running (PID: ${existingPid})`);
      } else {
        // Clean up stale PID file
        fs.unlinkSync(pidFile);
      }
    } catch (error) {
      if (error.message.includes('already running')) {
        throw error;
      }
      // Ignore other errors (corrupt PID file, etc.) and continue
      try { fs.unlinkSync(pidFile); } catch (e) {}
    }
  }
  
  // Spawn the daemon process
  const scriptPath = path.resolve(__dirname, '../cli/index.js');
  const child = spawn(process.argv[0], [
    scriptPath,
    'start',
    projectPath || process.cwd()
  ], {
    detached: true,
    stdio: 'ignore'
  });
  
  child.unref();
  
  // Write PID file
  const pidData = {
    pid: child.pid,
    startTime: new Date().toISOString(),
    projectPath: projectPath || process.cwd()
  };
  
  fs.writeFileSync(pidFile, JSON.stringify(pidData, null, 2), 'utf8');
  
  return { success: true, pid: child.pid };
}

// Stop daemon
function stopDaemon() {
  const pidFile = getPidFilePath();
  
  if (!fs.existsSync(pidFile)) {
    return { success: false, message: 'No daemon PID file found' };
  }
  
  try {
    const pidData = JSON.parse(fs.readFileSync(pidFile, 'utf8'));
    const pid = pidData.pid;
    
    if (!isProcessRunning(pid)) {
      // Clean up stale PID file
      fs.unlinkSync(pidFile);
      return { success: false, message: 'Daemon process not found' };
    }
    
    // Try graceful termination first
    try {
      process.kill(pid, 'SIGTERM');
      
      // Wait a bit and check if it's still running
      setTimeout(() => {
        if (isProcessRunning(pid)) {
          // Force kill if still running
          try {
            process.kill(pid, 'SIGKILL');
          } catch (e) {
            // Process might have already terminated
          }
        }
      }, 2000);
      
    } catch (killError) {
      // Process might have already terminated
    }
    
    // Clean up PID file
    if (fs.existsSync(pidFile)) {
      fs.unlinkSync(pidFile);
    }
    
    return { success: true, pid: pid };
    
  } catch (error) {
    return { success: false, message: `Error reading PID file: ${error.message}` };
  }
}

// Get daemon status
function getDaemonStatus() {
  const pidFile = getPidFilePath();
  
  if (!fs.existsSync(pidFile)) {
    return { running: false, message: 'No daemon PID file found' };
  }
  
  try {
    const pidData = JSON.parse(fs.readFileSync(pidFile, 'utf8'));
    const pid = pidData.pid;
    
    if (!isProcessRunning(pid)) {
      // Clean up stale PID file
      fs.unlinkSync(pidFile);
      return { running: false, message: 'Daemon process not found' };
    }
    
    return {
      running: true,
      pid: pid,
      startTime: pidData.startTime,
      projectPath: pidData.projectPath
    };
    
  } catch (error) {
    return { running: false, message: `Error reading PID file: ${error.message}` };
  }
}

module.exports = {
  startDaemon,
  stopDaemon,
  getDaemonStatus
};