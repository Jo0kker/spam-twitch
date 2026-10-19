$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$fixtureRoot = [IO.Path]::GetFullPath((Join-Path $projectRoot ('.runtime\installer-test-' + [Guid]::NewGuid().ToString('N'))))
$runtimeRoot = [IO.Path]::GetFullPath((Join-Path $projectRoot '.runtime'))
if (!$fixtureRoot.StartsWith($runtimeRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe fixture path.' }
New-Item -ItemType Directory -Path $fixtureRoot | Out-Null
$installRoot = Join-Path $fixtureRoot 'Application avec espaces'
function Assert-Installer($condition, $message) { if (!$condition) { throw $message } }
function Install-TestBuild {
    $process = Start-Process -FilePath (Join-Path $projectRoot 'dist\SPAM-Twitch-Setup-Test.exe') -ArgumentList @('/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/SP-', ('/DIR="' + $installRoot + '"'), ('/LOG="' + (Join-Path $fixtureRoot 'setup.log') + '"')) -WindowStyle Hidden -Wait -PassThru
    Assert-Installer ($process.ExitCode -eq 0) "Installer exit code $($process.ExitCode)."
}
& (Join-Path $projectRoot 'tools\Build-Installer.ps1') -TestBuild
Install-TestBuild
foreach ($file in @('SpamCardInspector.exe', 'resources\app\main.cjs', 'resources\app\updater.cjs', 'server\local.mjs', 'connector\SpamTwitchPlugin.cs', 'tools\Build-Connector.ps1', 'THIRD-PARTY-NOTICES.md', 'unins000.exe')) {
    Assert-Installer (Test-Path -LiteralPath (Join-Path $installRoot $file)) "Missing installed file: $file"
}
$privateFile = Join-Path $installRoot '.runtime\companion.json'
Assert-Installer (!(Test-Path -LiteralPath $privateFile)) 'Installer distributed private configuration.'
$shortcut = Join-Path ([Environment]::GetFolderPath('Programs')) 'SPAM Twitch Installer Test\SPAM Twitch Installer Test.lnk'
Assert-Installer (Test-Path -LiteralPath $shortcut) 'Start menu shortcut missing.'
$shell = New-Object -ComObject WScript.Shell
$link = $shell.CreateShortcut($shortcut)
Assert-Installer ($link.TargetPath -eq (Join-Path $installRoot 'SpamCardInspector.exe')) 'Shortcut does not start the desktop app directly.'
New-Item -ItemType Directory -Path (Split-Path -Parent $privateFile) | Out-Null
$fixtureConfig = '{"channelId":"123","publisherToken":"installer-fixture-only"}'
[IO.File]::WriteAllText($privateFile, $fixtureConfig)
Install-TestBuild
Assert-Installer ([IO.File]::ReadAllText($privateFile) -eq $fixtureConfig) 'Upgrade lost existing association.'
$testInstaller = Join-Path $projectRoot 'dist\SPAM-Twitch-Setup-Test.exe'
$updateHelper = Join-Path $fixtureRoot 'Apply-Update.ps1'
Copy-Item -LiteralPath (Join-Path $projectRoot 'tools\Apply-Update.ps1') -Destination $updateHelper
$cachedInstaller = Join-Path $fixtureRoot 'Update.exe'
Copy-Item -LiteralPath $testInstaller -Destination $cachedInstaller
$installerHash = (Get-FileHash -LiteralPath $cachedInstaller -Algorithm SHA256).Hash.ToLowerInvariant()
$helperProcess = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $updateHelper + '"'), '-Installer', ('"' + $cachedInstaller + '"'), '-InstallDirectory', ('"' + $installRoot + '"'), '-Sha256', $installerHash, '-ParentId', '2147483647') -WindowStyle Hidden -Wait -PassThru
Assert-Installer ($helperProcess.ExitCode -eq 0) 'Automatic update helper failed.'
Assert-Installer (!(Test-Path -LiteralPath $cachedInstaller)) 'Successful update left cached installer.'
Assert-Installer ([IO.File]::ReadAllText($privateFile) -eq $fixtureConfig) 'Automatic update lost association.'
$uninstall = Start-Process -FilePath (Join-Path $installRoot 'unins000.exe') -ArgumentList @('/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART') -WindowStyle Hidden -Wait -PassThru
Assert-Installer ($uninstall.ExitCode -eq 0) 'Uninstall failed.'
Assert-Installer (!(Test-Path -LiteralPath (Join-Path $installRoot 'runtime\node.exe'))) 'Uninstall left tracked runtime.'
Assert-Installer (!(Test-Path -LiteralPath (Join-Path $installRoot 'SpamCardInspector.exe'))) 'Uninstall left desktop executable.'
Assert-Installer (!(Test-Path -LiteralPath $shortcut)) 'Uninstall left start menu shortcut.'
Assert-Installer ([IO.File]::ReadAllText($privateFile) -eq $fixtureConfig) 'Uninstall removed retained user configuration.'
Write-Output 'PASS: fresh install, shortcuts, upgrade and automatic update preserving association, uninstall preserving user data. Existing game and companion untouched.'
# Only this uniquely-created and checked fixture tree is removed.
Remove-Item -LiteralPath $fixtureRoot -Recurse -Force
