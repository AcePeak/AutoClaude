' AutoClaude - Hidden Launcher
' This VBS script launches PowerShell completely hidden (no console window)

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get the directory where this script is located
scriptPath = fso.GetParentFolderName(WScript.ScriptFullName)
trayScript = scriptPath & "\autoclaude-tray.ps1"

' Build the PowerShell command
psCommand = "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & trayScript & """ -Hidden"

' Run completely hidden (0 = hide window, False = don't wait)
WshShell.Run psCommand, 0, False
