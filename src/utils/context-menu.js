const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

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
  if (process.platform === 'darwin') return registerMacOS();
  return { success: false, message: `Context menu not supported on ${process.platform}` };
}

function unregisterContextMenu() {
  if (process.platform === 'win32') return unregisterWindows();
  if (process.platform === 'darwin') return unregisterMacOS();
  return { success: false, message: `Context menu not supported on ${process.platform}` };
}

// ──────────────────────────────────────────
//  macOS: Finder Quick Actions (.workflow)
// ──────────────────────────────────────────

const MACOS_SERVICES_DIR = path.join(os.homedir(), 'Library', 'Services');

const MACOS_ACTIONS = [
  {
    name: 'AutoClaude - Initialize Project',
    script: 'init-project.js',
  },
  {
    name: 'AutoClaude - Open Claude',
    script: 'open-claude.js',
  },
  {
    name: 'AutoClaude - View Dashboard',
    script: 'view-dashboard.js',
  },
];

function buildWorkflowPlist(shellCommand) {
  // document.wflow — Automator "Run Shell Script" action
  // inputMethod 1 = "as arguments" (folders passed as $@)
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>AMApplicationBuild</key>
	<string>523</string>
	<key>AMApplicationVersion</key>
	<string>2.10</string>
	<key>AMDocumentVersion</key>
	<integer>2</integer>
	<key>actions</key>
	<array>
		<dict>
			<key>action</key>
			<dict>
				<key>AMAccepts</key>
				<dict>
					<key>Container</key>
					<string>List</string>
					<key>Optional</key>
					<true/>
					<key>Types</key>
					<array>
						<string>com.apple.cocoa.string</string>
						<string>com.apple.cocoa.attributed-string</string>
						<string>public.file-url</string>
					</array>
				</dict>
				<key>AMActionVersion</key>
				<string>2.0.3</string>
				<key>AMApplication</key>
				<array>
					<string>Automator</string>
				</array>
				<key>AMCategory</key>
				<string>AMCategoryUtilities</string>
				<key>AMIconName</key>
				<string>Automator</string>
				<key>AMParameterProperties</key>
				<dict>
					<key>COMMAND_STRING</key>
					<dict/>
					<key>CheckedForUserDefaultShell</key>
					<dict/>
					<key>inputMethod</key>
					<dict/>
					<key>shell</key>
					<dict/>
					<key>source</key>
					<dict/>
				</dict>
				<key>AMProvides</key>
				<dict>
					<key>Container</key>
					<string>List</string>
					<key>Types</key>
					<array>
						<string>com.apple.cocoa.string</string>
					</array>
				</dict>
				<key>ActionBundlePath</key>
				<string>/System/Library/Automator/Run Shell Script.action</string>
				<key>ActionName</key>
				<string>Run Shell Script</string>
				<key>ActionParameters</key>
				<dict>
					<key>COMMAND_STRING</key>
					<string>${escapeXml(shellCommand)}</string>
					<key>CheckedForUserDefaultShell</key>
					<true/>
					<key>inputMethod</key>
					<integer>1</integer>
					<key>shell</key>
					<string>/bin/zsh</string>
					<key>source</key>
					<string></string>
				</dict>
				<key>BundleIdentifier</key>
				<string>com.apple.RunShellScript</string>
				<key>CFBundleVersion</key>
				<string>2.0.3</string>
				<key>CanShowSelectedItemsWhenRun</key>
				<false/>
				<key>CanShowWhenRun</key>
				<true/>
				<key>Category</key>
				<array>
					<string>AMCategoryUtilities</string>
				</array>
				<key>Class Name</key>
				<string>RunShellScriptAction</string>
				<key>InputUUID</key>
				<string>A1B2C3D4-E5F6-7890-ABCD-EF1234567890</string>
				<key>Keywords</key>
				<array>
					<string>Shell</string>
					<string>Script</string>
					<string>Command</string>
					<string>Run</string>
				</array>
				<key>OutputUUID</key>
				<string>F6E5D4C3-B2A1-0987-6543-210FEDCBA987</string>
				<key>UUID</key>
				<string>12345678-ABCD-EF01-2345-6789ABCDEF01</string>
				<key>UnlocalizedApplications</key>
				<array>
					<string>Automator</string>
				</array>
				<key>arguments</key>
				<dict>
					<key>0</key>
					<dict>
						<key>default value</key>
						<integer>1</integer>
						<key>name</key>
						<string>inputMethod</string>
						<key>required</key>
						<string>0</string>
						<key>type</key>
						<string>0</string>
						<key>uuid</key>
						<string>0</string>
					</dict>
					<key>1</key>
					<dict>
						<key>default value</key>
						<string></string>
						<key>name</key>
						<string>source</string>
						<key>required</key>
						<string>0</string>
						<key>type</key>
						<string>0</string>
						<key>uuid</key>
						<string>1</string>
					</dict>
					<key>2</key>
					<dict>
						<key>default value</key>
						<false/>
						<key>name</key>
						<string>CheckedForUserDefaultShell</string>
						<key>required</key>
						<string>0</string>
						<key>type</key>
						<string>0</string>
						<key>uuid</key>
						<string>2</string>
					</dict>
					<key>3</key>
					<dict>
						<key>default value</key>
						<string></string>
						<key>name</key>
						<string>COMMAND_STRING</string>
						<key>required</key>
						<string>0</string>
						<key>type</key>
						<string>0</string>
						<key>uuid</key>
						<string>3</string>
					</dict>
					<key>4</key>
					<dict>
						<key>default value</key>
						<string>/bin/zsh</string>
						<key>name</key>
						<string>shell</string>
						<key>required</key>
						<string>0</string>
						<key>type</key>
						<string>0</string>
						<key>uuid</key>
						<string>4</string>
					</dict>
				</dict>
				<key>isViewVisible</key>
				<integer>1</integer>
				<key>location</key>
				<string>449.000000:305.000000</string>
				<key>nibPath</key>
				<string>/System/Library/Automator/Run Shell Script.action/Contents/Resources/Base.lproj/main.nib</string>
			</dict>
			<key>isViewVisible</key>
			<integer>1</integer>
		</dict>
	</array>
	<key>connectors</key>
	<dict/>
	<key>workflowMetaData</key>
	<dict>
		<key>workflowTypeIdentifier</key>
		<string>com.apple.Automator.servicesMenu</string>
	</dict>
</dict>
</plist>`;
}

function buildInfoPlist(serviceName) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>NSServices</key>
	<array>
		<dict>
			<key>NSMenuItem</key>
			<dict>
				<key>default</key>
				<string>${escapeXml(serviceName)}</string>
			</dict>
			<key>NSMessage</key>
			<string>runWorkflowAsService</string>
			<key>NSRequiredContext</key>
			<dict>
				<key>NSApplicationIdentifier</key>
				<string>com.apple.finder</string>
			</dict>
			<key>NSSendFileTypes</key>
			<array>
				<string>public.folder</string>
			</array>
		</dict>
	</array>
</dict>
</plist>`;
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function registerMacOS() {
  try {
    const nodePath = getNodePath();
    const installDir = getInstallDir();
    const installed = [];

    if (!fs.existsSync(MACOS_SERVICES_DIR)) {
      fs.mkdirSync(MACOS_SERVICES_DIR, { recursive: true });
    }

    for (const action of MACOS_ACTIONS) {
      const scriptPath = path.join(installDir, 'src', 'actions', action.script);
      const workflowDir = path.join(MACOS_SERVICES_DIR, `${action.name}.workflow`);
      const contentsDir = path.join(workflowDir, 'Contents');

      // Remove existing workflow if present
      if (fs.existsSync(workflowDir)) {
        fs.rmSync(workflowDir, { recursive: true, force: true });
      }

      fs.mkdirSync(contentsDir, { recursive: true });

      // Shell command that the Quick Action runs
      const shellCommand = `"${nodePath}" "${scriptPath}" --path "$@"`;

      fs.writeFileSync(
        path.join(contentsDir, 'document.wflow'),
        buildWorkflowPlist(shellCommand),
        'utf8'
      );

      fs.writeFileSync(
        path.join(contentsDir, 'Info.plist'),
        buildInfoPlist(action.name),
        'utf8'
      );

      installed.push(action.name);
    }

    // Flush services cache so Finder picks them up
    try {
      execSync('/System/Library/CoreServices/pbs -flush', { stdio: 'ignore' });
    } catch (e) { /* ok if pbs not available */ }

    return {
      success: true,
      message: `Installed ${installed.length} Quick Actions: ${installed.join(', ')}. Right-click a folder in Finder → Quick Actions to use them.`
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function unregisterMacOS() {
  try {
    let removed = 0;
    for (const action of MACOS_ACTIONS) {
      const workflowDir = path.join(MACOS_SERVICES_DIR, `${action.name}.workflow`);
      if (fs.existsSync(workflowDir)) {
        fs.rmSync(workflowDir, { recursive: true, force: true });
        removed++;
      }
    }

    try {
      execSync('/System/Library/CoreServices/pbs -flush', { stdio: 'ignore' });
    } catch (e) { /* ok */ }

    return {
      success: true,
      message: removed > 0
        ? `Removed ${removed} Quick Action(s)`
        : 'No AutoClaude Quick Actions found to remove'
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
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
      // Directory background
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
