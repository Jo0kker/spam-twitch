param(
    [Parameter(Mandatory=$true)][string]$Installer,
    [Parameter(Mandatory=$true)][string]$InstallDirectory,
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$Sha256,
    [Parameter(Mandatory=$true)][int]$ParentId
)
$ErrorActionPreference = 'Stop'
try {
    $parent = Get-Process -Id $ParentId -ErrorAction SilentlyContinue
    if ($parent -and !$parent.WaitForExit(30000)) { throw 'Le compagnon est encore ouvert.' }
    if (!(Test-Path -LiteralPath (Join-Path $InstallDirectory 'unins000.exe'))) { throw 'Installation Windows introuvable.' }
    if ((Get-FileHash -LiteralPath $Installer -Algorithm SHA256).Hash.ToLowerInvariant() -ne $Sha256) { throw 'Installateur altéré.' }
    # No automatic restart: closing the application must leave it closed.
    $arguments = '/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP- /DIR="' + $InstallDirectory + '"'
    $process = Start-Process -FilePath $Installer -ArgumentList $arguments -WindowStyle Hidden -PassThru -Wait
    if ($process.ExitCode -ne 0) { throw "Installation interrompue : $($process.ExitCode)" }
    Remove-Item -LiteralPath $Installer
    'ok' | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'last-update.txt')
} catch {
    $_.Exception.Message | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'last-update.txt')
    exit 1
}
