' Starts Bird (database, server, dev server and the app) with no console window.
' Double-click this file, or use the Desktop shortcut made by make-shortcut.ps1.
' Output is written to the logs folder.
Option Explicit
Dim shell, fso, root
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
If Not fso.FolderExists(root & "\logs") Then fso.CreateFolder(root & "\logs")
shell.CurrentDirectory = root
shell.Run "cmd /c node scripts\launch.mjs >> logs\launch-console.log 2>&1", 0, False
