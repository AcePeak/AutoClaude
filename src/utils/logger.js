const fs = require('fs');
const path = require('path');
const { getLogFile, ensureDir, getAppDataDir } = require('./paths');

class Logger {
  constructor(name = 'app') {
    this.name = name;
    this.logDir = path.join(getAppDataDir(), 'logs');
    ensureDir(this.logDir);
  }

  _getTimestamp() {
    return new Date().toISOString().replace('T', ' ').split('.')[0];
  }

  _write(level, message) {
    const timestamp = this._getTimestamp();
    const logLine = `[${timestamp}] [${level}] ${message}\n`;

    // Console output with colors
    const colors = {
      INFO: '\x1b[36m',    // Cyan
      OK: '\x1b[32m',      // Green
      WARN: '\x1b[33m',    // Yellow
      ERROR: '\x1b[31m',   // Red
      RESET: '\x1b[0m'
    };

    console.log(`${colors[level] || ''}${logLine.trim()}${colors.RESET}`);

    // File output
    try {
      const logFile = getLogFile(this.name);
      fs.appendFileSync(logFile, logLine, 'utf8');
    } catch (err) {
      console.error('Failed to write log:', err.message);
    }
  }

  info(message) {
    this._write('INFO', message);
  }

  ok(message) {
    this._write('OK', message);
  }

  warn(message) {
    this._write('WARN', message);
  }

  error(message) {
    this._write('ERROR', message);
  }
}

module.exports = Logger;
