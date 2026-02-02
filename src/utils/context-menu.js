const { execSync } = require('child_process');
const path = require('path');

// Get Node.js path
function getNodePath() {
  try {
    if (process.platform === 'win32') {
      return execSync('where node', { encoding: 'utf8' }).trim().split('\n')[0];
    } else {
      return execSync('which node', { encoding: 'utf8' }).trim();
    }
  } catch (error) {
    // Fallback to 'node' if can't find full path
    return 'node';
  }
}

// Get AutoClaude installation directory
function getInstallDir() {
  // Try to find the installation directory
  const possiblePaths = [
    // If running from installed package
    path.resolve(__dirname, '..', '..'),
    // If running from development
    path.resolve(__dirname, '..', '..'),
    // If running globally installed
    path.resolve(__dirname, '..', '..', '..')
  ];
  
  // Use the first path that contains package.json
  for (const testPath of possiblePaths) {
    const packagePath = path.join(testPath, 'package.json');
    try {
      const fs = require('fs');
      if (fs.existsSync(packagePath)) {
        const pkg = require(packagePath);
        if (pkg.name === 'autoclaude') {
          return testPath;
        }
      }
    } catch (e) {
      continue;
    }
  }
  
  // Fallback to directory containing this script
  return path.resolve(__dirname, '..', '..');
}

// Register context menu for Windows
function registerContextMenu() {
  if (process.platform !== 'win32') {
    return { success: false, message: 'Only available on Windows' };
  }

  try {
    const nodePath = getNodePath();
    const installDir = getInstallDir();
    const iconPath = path.join(installDir, 'assets', 'icon.ico');
    
    // Node.js script paths
    const initScript = path.join(installDir, 'src', 'actions', 'init-project.js');
    const openScript = path.join(installDir, 'src', 'actions', 'open-claude.js');
    const dashboardScript = path.join(installDir, 'src', 'actions', 'view-dashboard.js');

    // Create registry entries for context menu
    const regCommands = [
      // Directory background - Initialize
      `reg add "HKCU\\Software\\Classes\\Directory\\Background\\shell\\AutoClaudeInit" /ve /d "Initialize AutoClaude Project" /f`,
      `reg add "HKCU\\Software\\Classes\\Directory\\Background\\shell\\AutoClaudeInit" /v "Icon" /d "${iconPath}" /f`,
      `reg add "HKCU\\Software\\Classes\\Directory\\Background\\shell\\AutoClaudeInit\\command" /ve /d "\\"${nodePath}\\" \\"${initScript}\\" --path \\"%V\\"" /f`,

      // Directory background - Open Claude
      `reg add "HKCU\\Software\\Classes\\Directory\\Background\\shell\\AutoClaudeOpen" /ve /d "Open Claude" /f`,
      `reg add "HKCU\\Software\\Classes\\Directory\\Background\\shell\\AutoClaudeOpen" /v "Icon" /d "${iconPath}" /f`,
      `reg add "HKCU\\Software\\Classes\\Directory\\Background\\shell\\AutoClaudeOpen\\command" /ve /d "\\"${nodePath}\\" \\"${openScript}\\" --path \\"%V\\"" /f`,

      // Directory background - View Dashboard
      `reg add "HKCU\\Software\\Classes\\Directory\\Background\\shell\\AutoClaudeDashboard" /ve /d "View AutoClaude Dashboard" /f`,
      `reg add "HKCU\\Software\\Classes\\Directory\\Background\\shell\\AutoClaudeDashboard" /v "Icon" /d "${iconPath}" /f`,
      `reg add "HKCU\\Software\\Classes\\Directory\\Background\\shell\\AutoClaudeDashboard\\command" /ve /d "\\"${nodePath}\\" \\"${dashboardScript}\\" --path \\"%V\\"" /f`,

      // Directory - Initialize
      `reg add "HKCU\\Software\\Classes\\Directory\\shell\\AutoClaudeInit" /ve /d "Initialize AutoClaude Project" /f`,
      `reg add "HKCU\\Software\\Classes\\Directory\\shell\\AutoClaudeInit" /v "Icon" /d "${iconPath}" /f`,
      `reg add "HKCU\\Software\\Classes\\Directory\\shell\\AutoClaudeInit\\command" /ve /d "\\"${nodePath}\\" \\"${initScript}\\" --path \\"%1\\"" /f`,

      // Directory - Open Claude
      `reg add "HKCU\\Software\\Classes\\Directory\\shell\\AutoClaudeOpen" /ve /d "Open Claude" /f`,
      `reg add "HKCU\\Software\\Classes\\Directory\\shell\\AutoClaudeOpen" /v "Icon" /d "${iconPath}" /f`,
      `reg add "HKCU\\Software\\Classes\\Directory\\shell\\AutoClaudeOpen\\command" /ve /d "\\"${nodePath}\\" \\"${openScript}\\" --path \\"%1\\"" /f`,

      // Directory - View Dashboard
      `reg add "HKCU\\Software\\Classes\\Directory\\shell\\AutoClaudeDashboard" /ve /d "View AutoClaude Dashboard" /f`,
      `reg add "HKCU\\Software\\Classes\\Directory\\shell\\AutoClaudeDashboard" /v "Icon" /d "${iconPath}" /f`,
      `reg add "HKCU\\Software\\Classes\\Directory\\shell\\AutoClaudeDashboard\\command" /ve /d "\\"${nodePath}\\" \\"${dashboardScript}\\" --path \\"%1\\"" /f`
    ];

    for (const cmd of regCommands) {
      execSync(cmd, { stdio: 'ignore' });
    }

    return { success: true, message: 'Context menu registered successfully' };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

// Unregister context menu for Windows
function unregisterContextMenu() {
  if (process.platform !== 'win32') {
    return { success: false, message: 'Only available on Windows' };
  }

  try {
    const regCommands = [
      `reg delete "HKCU\\Software\\Classes\\Directory\\Background\\shell\\AutoClaudeInit" /f`,
      `reg delete "HKCU\\Software\\Classes\\Directory\\Background\\shell\\AutoClaudeOpen" /f`,
      `reg delete "HKCU\\Software\\Classes\\Directory\\Background\\shell\\AutoClaudeDashboard" /f`,
      `reg delete "HKCU\\Software\\Classes\\Directory\\shell\\AutoClaudeInit" /f`,
      `reg delete "HKCU\\Software\\Classes\\Directory\\shell\\AutoClaudeOpen" /f`,
      `reg delete "HKCU\\Software\\Classes\\Directory\\shell\\AutoClaudeDashboard" /f`
    ];

    for (const cmd of regCommands) {
      try {
        execSync(cmd, { stdio: 'ignore' });
      } catch (e) {
        // Ignore if key doesn't exist
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