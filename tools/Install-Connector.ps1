param([string]$GamePath = 'F:\SteamLibrary\steamapps\common\SPAM', [switch]$Uninstall, [switch]$Update)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$resolvedGame = (Resolve-Path -LiteralPath $GamePath).Path
if (!(Test-Path -LiteralPath (Join-Path $resolvedGame 'SPAM.exe'))) { throw 'Ce dossier ne contient pas SPAM.exe.' }
$manifestPath = Join-Path $resolvedGame 'BepInEx\spam-twitch-install.json'
if ($Uninstall -and $Update) { throw 'Choisir Update ou Uninstall.' }
if ($Update) {
    if (!(Test-Path -LiteralPath $manifestPath)) { throw 'Aucune installation SPAM Twitch suivie à mettre à jour.' }
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    $pluginRelativePath = 'BepInEx\plugins\SpamTwitchConnector\SpamTwitchConnector.dll'
    $entries = @($manifest.files | Where-Object path -EQ $pluginRelativePath)
    if ($entries.Count -ne 1) { throw 'Le manifeste ne contient pas un unique connecteur suivi.' }
    $destination = Join-Path $resolvedGame $pluginRelativePath
    $source = Join-Path $projectRoot 'connector\bin\SpamTwitchConnector.dll'
    $sourceHash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
    $installedHash = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash
    if ($installedHash -eq $sourceHash) { Write-Output 'Le connecteur est à jour. Relance SPAM pour le charger.'; exit }
    if ($installedHash -ne $entries[0].hash) { throw 'Le connecteur installé a été modifié. Fichier préservé.' }
    $updateId = [Guid]::NewGuid().ToString('N')
    $stagedPlugin = $destination + '.update-' + $updateId
    $previousPlugin = $destination + '.previous-' + $updateId
    $stagedManifest = $manifestPath + '.update-' + $updateId
    $replaced = $false
    $committed = $false
    try {
        Copy-Item -LiteralPath $source -Destination $stagedPlugin
        $entries[0].hash = $sourceHash
        $manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $stagedManifest -Encoding utf8
        # Replace atomically: never overwrite bytes of an assembly currently mapped by Unity.
        [IO.File]::Replace($stagedPlugin, $destination, $previousPlugin)
        $replaced = $true
        [IO.File]::Replace($stagedManifest, $manifestPath, [NullString]::Value)
        $committed = $true
    } catch {
        if ($replaced -and !$committed) { [IO.File]::Replace($previousPlugin, $destination, [NullString]::Value) }
        throw "Mise à jour non appliquée. Si SPAM est ouvert, ferme-le puis réessaie. $($_.Exception.Message)"
    } finally {
        foreach ($temporaryFile in @($stagedPlugin, $stagedManifest)) {
            if (Test-Path -LiteralPath $temporaryFile) { Remove-Item -LiteralPath $temporaryFile }
        }
        if ($committed -and (Test-Path -LiteralPath $previousPlugin)) { Remove-Item -LiteralPath $previousPlugin }
    }
    Write-Output 'Connecteur mis à jour. Ferme puis relance SPAM pour charger cette version.'
    exit
}
if ($Uninstall) {
    if (!(Test-Path -LiteralPath $manifestPath)) { throw "Aucun manifeste d'installation SPAM Twitch trouvé." }
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    foreach ($entry in $manifest.files) {
        $target = [IO.Path]::GetFullPath((Join-Path $resolvedGame $entry.path))
        if (!$target.StartsWith($resolvedGame + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Chemin hors du dossier du jeu.' }
        if ((Test-Path -LiteralPath $target) -and (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -eq $entry.hash) { Remove-Item -LiteralPath $target }
    }
    Remove-Item -LiteralPath $manifestPath
    Write-Output 'Connecteur retiré. Les configurations et les fichiers modifiés ont été conservés.'
    exit
}
if (Test-Path -LiteralPath $manifestPath) { Write-Output 'Le connecteur est déjà installé. Relance le jeu pour le charger.'; exit }
$plugin = Join-Path $projectRoot 'connector\bin\SpamTwitchConnector.dll'
if (!(Test-Path -LiteralPath $plugin)) { & (Join-Path $PSScriptRoot 'Build-Connector.ps1') -GamePath $resolvedGame }
$loader = Join-Path $projectRoot '.tools\bepinex'
$files = @()
if (!(Test-Path -LiteralPath (Join-Path $resolvedGame 'BepInEx\core\BepInEx.dll'))) {
    foreach ($loaderFile in Get-ChildItem -LiteralPath $loader -Recurse -File) {
        if ($loaderFile.Name -in @('changelog.txt')) { continue }
        $relative = $loaderFile.FullName.Substring($loader.Length + 1)
        $files += @{ source = $loaderFile.FullName; path = $relative }
    }
}
$files += @{ source = $plugin; path = 'BepInEx\plugins\SpamTwitchConnector\SpamTwitchConnector.dll' }
# Validate every collision before changing the installation.
foreach ($file in $files) {
    $destination = Join-Path $resolvedGame $file.path
    if (Test-Path -LiteralPath $destination) { throw "Fichier existant préservé : $destination. Installation interrompue." }
}
$installed = @()
foreach ($file in $files) {
    $destination = Join-Path $resolvedGame $file.path
    New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
    Copy-Item -LiteralPath $file.source -Destination $destination
    $installed += @{ path = $file.path; hash = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash }
}
@{ version = 1; files = $installed } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifestPath -Encoding utf8
Write-Output 'Connecteur installé. Ferme puis relance SPAM pour le charger.'
