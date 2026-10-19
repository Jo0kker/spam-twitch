$ErrorActionPreference = 'Stop'
try {
    $projectRoot = Split-Path -Parent $PSScriptRoot
    $desktopExecutable = Join-Path $projectRoot 'SpamCardInspector.exe'
    if (!(Test-Path -LiteralPath $desktopExecutable)) { throw 'Application de bureau absente. Réinstallez SPAM Card Inspector.' }
    Start-Process -FilePath $desktopExecutable -WorkingDirectory $projectRoot
} catch {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show("Le compagnon n'a pas pu démarrer.`n`n$($_.Exception.Message)", 'SPAM Card Inspector', 'OK', 'Error') | Out-Null
    exit 1
}
