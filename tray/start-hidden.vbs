' AutoClaude - Hidden Launcher
' This VBS script launches PowerShell completely hidden (no console window)

On Error Resume Next

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Log file for debugging
logDir = WshShell.ExpandEnvironmentStrings("%APPDATA%") & "\AutoClaude"
If Not fso.FolderExists(logDir) Then
    fso.CreateFolder(logDir)
End If
logFile = logDir & "\vbs_launcher.log"

' Log function
Sub WriteLog(msg)
    Set logStream = fso.OpenTextFile(logFile, 8, True)
    logStream.WriteLine Now & " - " & msg
    logStream.Close
End Sub

WriteLog "VBS Launcher starting..."

' Get the directory where this script is located
scriptPath = fso.GetParentFolderName(WScript.ScriptFullName)
trayScript = scriptPath & "\autoclaude-tray.ps1"

WriteLog "Script path: " & scriptPath
WriteLog "Tray script: " & trayScript

' Check if tray script exists
If Not fso.FileExists(trayScript) Then
    WriteLog "ERROR: Tray script not found!"
    MsgBox "AutoClaude tray script not found:" & vbCrLf & trayScript, vbCritical, "AutoClaude Error"
    WScript.Quit 1
End If

WriteLog "Tray script exists, launching..."

' Build the PowerShell command
psCommand = "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & trayScript & """ -Hidden"

WriteLog "Command: " & psCommand

' Run completely hidden (0 = hide window, False = don't wait)
errCode = WshShell.Run(psCommand, 0, False)

If Err.Number <> 0 Then
    WriteLog "ERROR: " & Err.Description
    MsgBox "Failed to start AutoClaude:" & vbCrLf & Err.Description, vbCritical, "AutoClaude Error"
Else
    WriteLog "Launched successfully"
End If
