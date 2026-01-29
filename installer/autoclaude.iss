; AutoClaude Inno Setup Installation Script
; Requires Inno Setup 6.0+

#define MyAppName "AutoClaude"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "AutoClaude"
#define MyAppURL "https://github.com/AcePeak/AutoClaude"
#define MyAppExeName "autoclaude-tray.ps1"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
LicenseFile=
OutputDir=..\dist
OutputBaseFilename=AutoClaude_Setup_{#MyAppVersion}
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "startupicon"; Description: "Start automatically at login"; GroupDescription: "Startup options:"
Name: "contextmenu"; Description: "Add context menu items"; GroupDescription: "System integration:"; Flags: checkedonce

[Files]
; Script files
Source: "..\scripts\*"; DestDir: "{app}\scripts"; Flags: ignoreversion recursesubdirs
Source: "..\tray\*"; DestDir: "{app}\tray"; Flags: ignoreversion recursesubdirs
Source: "..\templates\*"; DestDir: "{app}\templates"; Flags: ignoreversion recursesubdirs
Source: "..\docs\*"; DestDir: "{app}\docs"; Flags: ignoreversion recursesubdirs

; Icon file (if exists)
Source: "assets\autoclaude.ico"; DestDir: "{app}\installer\assets"; Flags: ignoreversion skipifsourcedoesntexist

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "wscript.exe"; Parameters: """{app}\tray\start-hidden.vbs"""; IconFilename: "{app}\installer\assets\autoclaude.ico"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "wscript.exe"; Parameters: """{app}\tray\start-hidden.vbs"""; IconFilename: "{app}\installer\assets\autoclaude.ico"; Tasks: desktopicon

[Registry]
; Context menu - Directory background
Root: HKCU; Subkey: "Software\Classes\Directory\Background\shell\AutoClaudeInit"; ValueType: string; ValueName: ""; ValueData: "Initialize AutoClaude Project"; Tasks: contextmenu; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\Directory\Background\shell\AutoClaudeInit"; ValueType: string; ValueName: "Icon"; ValueData: "{app}\installer\assets\autoclaude.ico"; Tasks: contextmenu
Root: HKCU; Subkey: "Software\Classes\Directory\Background\shell\AutoClaudeInit\command"; ValueType: string; ValueName: ""; ValueData: "powershell.exe -ExecutionPolicy Bypass -File ""{app}\scripts\init-project.ps1"" -Path ""%V"""; Tasks: contextmenu

Root: HKCU; Subkey: "Software\Classes\Directory\Background\shell\AutoClaudeOpen"; ValueType: string; ValueName: ""; ValueData: "Open Claude"; Tasks: contextmenu; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\Directory\Background\shell\AutoClaudeOpen"; ValueType: string; ValueName: "Icon"; ValueData: "{app}\installer\assets\autoclaude.ico"; Tasks: contextmenu
Root: HKCU; Subkey: "Software\Classes\Directory\Background\shell\AutoClaudeOpen\command"; ValueType: string; ValueName: ""; ValueData: "powershell.exe -ExecutionPolicy Bypass -File ""{app}\scripts\open-claude.ps1"" -Path ""%V"""; Tasks: contextmenu

Root: HKCU; Subkey: "Software\Classes\Directory\Background\shell\AutoClaudeDashboard"; ValueType: string; ValueName: ""; ValueData: "View AutoClaude Dashboard"; Tasks: contextmenu; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\Directory\Background\shell\AutoClaudeDashboard"; ValueType: string; ValueName: "Icon"; ValueData: "{app}\installer\assets\autoclaude.ico"; Tasks: contextmenu
Root: HKCU; Subkey: "Software\Classes\Directory\Background\shell\AutoClaudeDashboard\command"; ValueType: string; ValueName: ""; ValueData: "powershell.exe -ExecutionPolicy Bypass -File ""{app}\scripts\view-dashboard.ps1"" -Path ""%V"""; Tasks: contextmenu

; Context menu - Folder
Root: HKCU; Subkey: "Software\Classes\Directory\shell\AutoClaudeInit"; ValueType: string; ValueName: ""; ValueData: "Initialize AutoClaude Project"; Tasks: contextmenu; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\Directory\shell\AutoClaudeInit"; ValueType: string; ValueName: "Icon"; ValueData: "{app}\installer\assets\autoclaude.ico"; Tasks: contextmenu
Root: HKCU; Subkey: "Software\Classes\Directory\shell\AutoClaudeInit\command"; ValueType: string; ValueName: ""; ValueData: "powershell.exe -ExecutionPolicy Bypass -File ""{app}\scripts\init-project.ps1"" -Path ""%1"""; Tasks: contextmenu

Root: HKCU; Subkey: "Software\Classes\Directory\shell\AutoClaudeOpen"; ValueType: string; ValueName: ""; ValueData: "Open Claude"; Tasks: contextmenu; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\Directory\shell\AutoClaudeOpen"; ValueType: string; ValueName: "Icon"; ValueData: "{app}\installer\assets\autoclaude.ico"; Tasks: contextmenu
Root: HKCU; Subkey: "Software\Classes\Directory\shell\AutoClaudeOpen\command"; ValueType: string; ValueName: ""; ValueData: "powershell.exe -ExecutionPolicy Bypass -File ""{app}\scripts\open-claude.ps1"" -Path ""%1"""; Tasks: contextmenu

Root: HKCU; Subkey: "Software\Classes\Directory\shell\AutoClaudeDashboard"; ValueType: string; ValueName: ""; ValueData: "View AutoClaude Dashboard"; Tasks: contextmenu; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\Directory\shell\AutoClaudeDashboard"; ValueType: string; ValueName: "Icon"; ValueData: "{app}\installer\assets\autoclaude.ico"; Tasks: contextmenu
Root: HKCU; Subkey: "Software\Classes\Directory\shell\AutoClaudeDashboard\command"; ValueType: string; ValueName: ""; ValueData: "powershell.exe -ExecutionPolicy Bypass -File ""{app}\scripts\view-dashboard.ps1"" -Path ""%1"""; Tasks: contextmenu

; Auto-start at login
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "AutoClaude"; ValueData: "wscript.exe ""{app}\tray\start-hidden.vbs"""; Tasks: startupicon; Flags: uninsdeletevalue

[Run]
Filename: "wscript.exe"; Parameters: """{app}\tray\start-hidden.vbs"""; Description: "Start AutoClaude"; Flags: nowait postinstall skipifsilent
Filename: "https://paypal.me/AceLiatus"; Description: "Support the project - Donate via PayPal"; Flags: postinstall skipifsilent shellexec unchecked

[UninstallRun]
; Stop tray application before uninstall
Filename: "taskkill"; Parameters: "/F /IM powershell.exe /FI ""WINDOWTITLE eq AutoClaude*"""; Flags: runhidden; RunOnceId: "StopTray"

[UninstallDelete]
; Clean up AppData directory (optional)
Type: filesandordirs; Name: "{userappdata}\AutoClaude"

[Code]
// Confirm before uninstall
function InitializeUninstall(): Boolean;
begin
  Result := MsgBox('Are you sure you want to uninstall AutoClaude?' + #13#10 + #13#10 +
    'Note: Initialized project directories will not be deleted.', mbConfirmation, MB_YESNO) = IDYES;
end;

// Post-installation instructions
procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    MsgBox('AutoClaude installation complete!' + #13#10 + #13#10 +
      'Usage:' + #13#10 +
      '1. Right-click in any folder' + #13#10 +
      '2. Select "Initialize AutoClaude Project"' + #13#10 +
      '3. Select "Open Claude" to start' + #13#10 + #13#10 +
      'System tray icon is now active. Right-click to manage projects.' + #13#10 + #13#10 +
      'If you find AutoClaude useful, please consider supporting the project!',
      mbInformation, MB_OK);
  end;
end;
