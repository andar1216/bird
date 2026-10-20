# Creates a "Bird" shortcut on the Desktop that starts everything with one click.
# Usage (from the project folder):  powershell -ExecutionPolicy Bypass -File scripts\make-shortcut.ps1
$root = Split-Path -Parent $PSScriptRoot
$vbs = Join-Path $PSScriptRoot 'Bird.vbs'
$icon = Join-Path $root 'node_modules\electron\dist\electron.exe'
$desktop = [Environment]::GetFolderPath('Desktop')

$shell = New-Object -ComObject WScript.Shell
$link = $shell.CreateShortcut((Join-Path $desktop 'Bird.lnk'))
$link.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
$link.Arguments = "`"$vbs`""
$link.WorkingDirectory = $root
$link.Description = 'Bird: unified messenger (starts database, server and app)'
if (Test-Path $icon) { $link.IconLocation = "$icon,0" }
$link.Save()
Write-Host "Created $(Join-Path $desktop 'Bird.lnk')"
