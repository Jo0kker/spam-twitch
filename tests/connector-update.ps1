$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$testRoot = Join-Path $projectRoot ('.runtime\installer-test-' + [Guid]::NewGuid().ToString('N'))
$gameRoot = Join-Path $testRoot 'SPAM'
$pluginRelativePath = 'BepInEx\plugins\SpamTwitchConnector\SpamTwitchConnector.dll'
$pluginPath = Join-Path $gameRoot $pluginRelativePath
$manifestPath = Join-Path $gameRoot 'BepInEx\spam-twitch-install.json'
$updateScript = Join-Path $projectRoot 'tools\Install-Connector.ps1'
$buildHash = (Get-FileHash -LiteralPath (Join-Path $projectRoot 'connector\bin\SpamTwitchConnector.dll')).Hash
New-Item -ItemType Directory -Path (Split-Path $pluginPath) -Force | Out-Null
[IO.File]::WriteAllBytes((Join-Path $gameRoot 'SPAM.exe'), [byte[]]@())
$untrackedFile = Join-Path (Split-Path $pluginPath) 'user-file.txt'
Set-Content -LiteralPath $untrackedFile -Value 'preserve me'
function Reset-Fixture {
    Set-Content -LiteralPath $pluginPath -Value 'previous connector fixture'
    @{ version = 1; files = @(@{path = $pluginRelativePath; hash = (Get-FileHash -LiteralPath $pluginPath).Hash}) } |
        ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifestPath -Encoding utf8
}
function Invoke-Update {
    $ErrorActionPreference = 'Continue'
    $script:testOutput = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $updateScript -GamePath $gameRoot -Update 2>&1 | Out-String
    return $LASTEXITCODE
}
function Assert-True($condition, $message) { if (!$condition) { throw $message } }
Reset-Fixture
Assert-True ((Invoke-Update) -eq 0) 'Update failed.'
Assert-True ((Get-FileHash -LiteralPath $pluginPath).Hash -eq $buildHash) 'Installed bytes differ from build.'
$updatedManifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
Assert-True ($updatedManifest.files[0].hash -eq $buildHash) 'Manifest hash was not updated.'
Assert-True ((Get-Content -LiteralPath $untrackedFile).Trim() -eq 'preserve me') 'Untracked file changed.'
Assert-True ((Invoke-Update) -eq 0) 'Identical update should succeed.'
Set-Content -LiteralPath $pluginPath -Value 'user modification'
$customHash = (Get-FileHash -LiteralPath $pluginPath).Hash
Assert-True ((Invoke-Update) -ne 0) 'Modified connector should be refused.'
Assert-True ((Get-FileHash -LiteralPath $pluginPath).Hash -eq $customHash) 'User modification was overwritten.'
Reset-Fixture
$previousHash = (Get-FileHash -LiteralPath $pluginPath).Hash
$manifestHash = (Get-FileHash -LiteralPath $manifestPath).Hash
$lockedManifest = [IO.File]::Open($manifestPath, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
try { Assert-True ((Invoke-Update) -ne 0) 'Locked manifest should fail the update.' }
finally { $lockedManifest.Dispose() }
Assert-True ((Get-FileHash -LiteralPath $pluginPath).Hash -eq $previousHash) 'Failed update did not restore the old connector.'
Assert-True ((Get-FileHash -LiteralPath $manifestPath).Hash -eq $manifestHash) 'Failed update changed the manifest.'
Assert-True (@(Get-ChildItem -LiteralPath $gameRoot -Recurse -File | Where-Object Name -Match '\.(update|previous)-').Count -eq 0) 'Temporary update files remain.'
Write-Output 'PASS: update, manifest, idempotence, preservation of modifications, rollback on locked manifest.'
