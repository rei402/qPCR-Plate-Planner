# 在工具目录创建带自定义图标的快捷方式；移动文件夹后重新运行即可。
$ErrorActionPreference = 'Stop'
$toolRoot = $PSScriptRoot
$entryPath = Join-Path $toolRoot 'qPCR Plate Planner.exe'
$htmlPath = Join-Path $toolRoot 'qPCR Plate Planner.html'
$iconPath = Join-Path $toolRoot 'icons\qPCR Plate Planner.ico'
if (!(Test-Path -LiteralPath $entryPath) -or !(Test-Path -LiteralPath $htmlPath) -or !(Test-Path -LiteralPath $iconPath)) {
    throw '请在完整解压后的工具文件夹中运行。'
}
$shortcutPath = Join-Path $toolRoot 'qPCR Plate Planner.lnk'
$shortcutShell = New-Object -ComObject WScript.Shell
$toolShortcut = $shortcutShell.CreateShortcut($shortcutPath)
$toolShortcut.TargetPath = $entryPath
$toolShortcut.WorkingDirectory = $toolRoot
$toolShortcut.IconLocation = "$entryPath,0"
$toolShortcut.Description = 'qPCR Plate Planner v2.1.2 · 离线孔板设计与加样助手'
$toolShortcut.Save()
Write-Output "快捷方式已创建：$shortcutPath"
