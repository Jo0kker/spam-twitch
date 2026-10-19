param([string]$SourceFolder, [string]$OutputFolder, [switch]$TestBuild)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$version = (Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json).version
if (!$SourceFolder) { $SourceFolder = Join-Path $projectRoot ('dist\SPAM-Twitch-Companion-' + $version) }
if (!$OutputFolder) { $OutputFolder = Join-Path $projectRoot 'dist' }
$compiler = Join-Path $projectRoot '.tools\inno-setup\ISCC.exe'
if (!(Test-Path -LiteralPath $compiler)) { throw 'Compilateur Inno Setup requis dans .tools\inno-setup (https://jrsoftware.org/isdl.php).' }
if (!(Test-Path -LiteralPath (Join-Path $SourceFolder 'SpamCardInspector.exe'))) { throw 'Préparer le paquet de bureau avant de compiler.' }
$version = (Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json).version
$compilerArguments = @('/Qp', "/DSourceRoot=$SourceFolder", "/DOutputRoot=$OutputFolder", "/DAppVersion=$version")
if ($TestBuild) { $compilerArguments += '/DTestBuild=1' }
$compilerArguments += Join-Path $projectRoot 'installer\SpamTwitch.iss'
& $compiler @compilerArguments
if ($LASTEXITCODE -ne 0) { throw "Échec de compilation Inno Setup ($LASTEXITCODE)." }
