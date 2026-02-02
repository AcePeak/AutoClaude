const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Get Node.js full path
function getNodePath() {
  try {
    if (process.platform === 'win32') {
      return execSync('where node', { encoding: 'utf8' }).trim().split('\n')[0];
    } else {
      return execSync('which node', { encoding: 'utf8' }).trim();
    }
  } catch (error) {
    return 'node';
  }
}

// Get AutoClaude installation directory
function getInstallDir() {
  const candidates = [
    path.resolve(__dirname, '..', '..'),
    path.resolve(__dirname, '..', '..', '..')
  ];

  for (const testPath of candidates) {
    try {
      const pkgPath = path.join(testPath, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.name === 'autoclaude') return testPath;
      }
    } catch (e) { continue; }
  }

  return path.resolve(__dirname, '..', '..');
}

// ──────────────────────────────────────────
//  Cross-platform dispatcher
// ──────────────────────────────────────────

function registerContextMenu() {
  if (process.platform === 'win32') return registerWindows();
  return {
    success: false,
    message: 'Context menu is only supported on Windows. On macOS/Linux, use the CLI: autoclaude init, autoclaude start, etc.'
  };
}

function unregisterContextMenu() {
  if (process.platform === 'win32') return unregisterWindows();
  return {
    success: false,
    message: 'Context menu is only supported on Windows. Nothing to unregister.'
  };
}

// ──────────────────────────────────────────
//  Windows: Registry context menu
// ──────────────────────────────────────────

function registerWindows() {
  try {
    const nodePath = getNodePath();
    const installDir = getInstallDir();
    const iconPath = path.join(installDir, 'assets', 'icon.ico');

    const initScript = path.join(installDir, 'src', 'actions', 'init-project.js');
    const openScript = path.join(installDir, 'src', 'actions', 'open-claude.js');
    const dashboardScript = path.join(installDir, 'src', 'actions', 'view-dashboard.js');

    const regCommands = [
      // Directory background (right-click empty space in folder)
      `reg add "HKCU\\Software\\Classes\\Directory\\Background\\shell\\AutoClaudeInit" /ve /d "Initialize AutoClaude Project" /f`,
      `reg add "HKCU\\Software\\Classes\\Directory\\Background\\shell\\AutoClaudeInit" /v "Icon" /d "${iconPath}" /f`,
      `reg add "HKCU\\Software\\Classes\\Directory\\Background\\shell\\AutoClaudeInit\\command" /ve /d "\\"${nodePath}\\" \\"${initScript}\\" --path \\"%V\\"" /f`,

      `reg add "HKCU\\Software\\Classes\\Directory\\Background\\shell\\AutoClaudeOpen" /ve /d "Open Claude" /f`,
      `reg add "HKCU\\Software\\Classes\\Directory\\Background\\shell\\AutoClaudeOpen" /v "Icon" /d "${iconPath}" /f`,
      `reg add "HKCU\\Software\\Classes\\Directory\\Background\\shell\\AutoClaudeOpen\\command" /ve /d "\\"${nodePath}\\" \\"${openScript}\\" --path \\"%V\\"" /f`,

      `reg add "HKCU\\Software\\Classes\\Directory\\Background\\shell\\AutoClaudeDashboard" /ve /d "View AutoClaude Dashboard" /f`,
      `reg add "HKCU\\Software\\Classes\\Directory\\Background\\shell\\AutoClaudeDashboard" /v "Icon" /d "${iconPath}" /f`,
      `reg add "HKCU\\Software\\Classes\\Directory\\Background\\shell\\AutoClaudeDashboard\\command" /ve /d "\\"${nodePath}\\" \\"${dashboardScript}\\" --path \\"%V\\"" /f`,

      // Directory (right-click on folder)
      `reg add "HKCU\\Software\\Classes\\Directory\\shell\\AutoClaudeInit" /ve /d "Initialize AutoClaude Project" /f`,
      `reg add "HKCU\\Software\\Classes\\Directory\\shell\\AutoClaudeInit" /v "Icon" /d "${iconPath}" /f`,
      `reg add "HKCU\\Software\\Classes\\Directory\\shell\\AutoClaudeInit\\command" /ve /d "\\"${nodePath}\\" \\"${initScript}\\" --path \\"%1\\"" /f`,

      `reg add "HKCU\\Software\\Classes\\Directory\\shell\\AutoClaudeOpen" /ve /d "Open Claude" /f`,
      `reg add "HKCU\\Software\\Classes\\Directory\\shell\\AutoClaudeOpen" /v "Icon" /d "${iconPath}" /f`,
      `reg add "HKCU\\Software\\Classes\\Directory\\shell\\AutoClaudeOpen\\command" /ve /d "\\"${nodePath}\\" \\"${openScript}\\" --path \\"%1\\"" /f`,

      `reg add "HKCU\\Software\\Classes\\Directory\\shell\\AutoClaudeDashboard" /ve /d "View AutoClaude Dashboard" /f`,
      `reg add "HKCU\\Software\\Classes\\Directory\\shell\\AutoClaudeDashboard" /v "Icon" /d "${iconPath}" /f`,
      `reg add "HKCU\\Software\\Classes\\Directory\\shell\\AutoClaudeDashboard\\command" /ve /d "\\"${nodePath}\\" \\"${dashboardScript}\\" --path \\"%1\\"" /f`,
    ];

    for (const cmd of regCommands) {
      execSync(cmd, { stdio: 'ignore' });
    }

    return { success: true, message: 'Context menu registered successfully' };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function unregisterWindows() {
  try {
    const keys = [
      'AutoClaudeInit', 'AutoClaudeOpen', 'AutoClaudeDashboard'
    ];
    for (const key of keys) {
      for (const root of ['Directory\\Background\\shell', 'Directory\\shell']) {
        try {
          execSync(`reg delete "HKCU\\Software\\Classes\\${root}\\${key}" /f`, { stdio: 'ignore' });
        } catch (e) { /* key might not exist */ }
      }
    }
    return { success: true, message: 'Context menu unregistered successfully' };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

module.exports = {
  registerContextMenu,
  unregisterContextMenu
};
