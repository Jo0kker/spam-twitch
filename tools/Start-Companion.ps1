param([switch]$Stop, [switch]$NoBrowser, [switch]$LegacyOnly)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtime = Join-Path $projectRoot '.runtime'
$processFile = Join-Path $runtime 'companion-process.json'
if ($Stop) {
    $desktopRecordFile = Join-Path $runtime 'desktop-process.json'
    if (!$LegacyOnly -and (Test-Path -LiteralPath $desktopRecordFile)) {
        $desktopRecord = Get-Content -LiteralPath $desktopRecordFile -Raw | ConvertFrom-Json
        $desktopProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $($desktopRecord.processId)" -ErrorAction SilentlyContinue
        $desktopExecutable = Join-Path $projectRoot 'SpamCardInspector.exe'
        if ($desktopRecord.appRoot -eq $projectRoot -and $desktopProcess -and $desktopProcess.ExecutablePath -eq $desktopExecutable) {
            $quitProcess = Start-Process -FilePath $desktopExecutable -ArgumentList '--quit' -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru
            $quitProcess.WaitForExit(5000) | Out-Null
            try { Wait-Process -Id $desktopProcess.ProcessId -Timeout 5 -ErrorAction Stop } catch {
                $remainingProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $($desktopRecord.processId)" -ErrorAction SilentlyContinue
                if ($remainingProcess -and $remainingProcess.ExecutablePath -eq $desktopExecutable) { Stop-Process -Id $remainingProcess.ProcessId }
            }
        }
    }
    if (!(Test-Path -LiteralPath $processFile)) { Write-Output 'Cette application ne possède aucun processus enregistré.'; exit }
    $record = Get-Content -LiteralPath $processFile -Raw | ConvertFrom-Json
    $ownedProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $($record.processId)" -ErrorAction SilentlyContinue
    $expectedScript = Join-Path $projectRoot 'server\local.mjs'
    if ($ownedProcess -and $ownedProcess.CommandLine.Contains($expectedScript) -and $ownedProcess.ExecutablePath -eq $record.executable) { Stop-Process -Id $record.processId }
    Remove-Item -LiteralPath $processFile
    Write-Output 'SPAM Twitch Companion est arrêté.'
    exit
}
try {
    $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8787/health' -TimeoutSec 2
    if ($health.service -ne 'SPAM Twitch Companion') { throw 'Le port 8787 est utilisé par une autre application.' }
    if (!$NoBrowser) { Start-Process 'http://127.0.0.1:8787' }
    exit
} catch { if ($_.Exception.Message -eq 'Le port 8787 est utilisé par une autre application.') { throw } }
$nodeCandidates = @((Join-Path $projectRoot 'runtime\node.exe'))
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCommand) { $nodeCandidates += $nodeCommand.Source }
$nodeCandidates += Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$nodeExecutable = $nodeCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (!$nodeExecutable) { throw 'Node.js 22 ou plus récent est nécessaire. Utilise la version portable fournie ou installe Node.js depuis https://nodejs.org.' }
New-Item -ItemType Directory -Path $runtime -Force | Out-Null
$script = Join-Path $projectRoot 'server\local.mjs'
$startedProcess = Start-Process -FilePath $nodeExecutable -ArgumentList @('"' + $script + '"') -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtime 'companion.log') -RedirectStandardError (Join-Path $runtime 'companion-error.log')
@{ processId = $startedProcess.Id; executable = $nodeExecutable } | ConvertTo-Json | Set-Content -LiteralPath $processFile -Encoding utf8
for ($attempt = 0; $attempt -lt 20; $attempt++) {
    Start-Sleep -Milliseconds 250
    try {
        $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8787/health' -TimeoutSec 1
        if ($health.service -eq 'SPAM Twitch Companion') { if (!$NoBrowser) { Start-Process 'http://127.0.0.1:8787' }; exit }
    } catch {}
}
throw "Le compagnon n'a pas démarré. Consulte .runtime\companion-error.log."
