param([string]$GamePath = 'F:\SteamLibrary\steamapps\common\SPAM')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$managed = Join-Path $GamePath 'SPAM_Data\Managed'
$bepRoot = Join-Path $projectRoot '.tools\bepinex'
$bepDll = Join-Path $bepRoot 'BepInEx\core\BepInEx.dll'
if (!(Test-Path -LiteralPath $bepDll)) {
    New-Item -ItemType Directory -Path $bepRoot -Force | Out-Null
    $archive = Join-Path $projectRoot '.tools\bepinex.zip'
    Invoke-WebRequest -Uri 'https://github.com/BepInEx/BepInEx/releases/download/v5.4.23.5/BepInEx_win_x64_5.4.23.5.zip' -OutFile $archive
    Expand-Archive -LiteralPath $archive -DestinationPath $bepRoot -Force
}
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (!(Test-Path -LiteralPath $compiler)) { throw 'Compilateur C# .NET Framework introuvable.' }
$build = Join-Path $projectRoot 'connector\bin'
New-Item -ItemType Directory -Path $build -Force | Out-Null
$arguments = @('/nologo', '/noconfig', '/target:library', '/optimize+', '/nostdlib+', ('/out:' + (Join-Path $build 'SpamTwitchConnector.dll')), ('/reference:' + $bepDll))
$references = @('mscorlib.dll','netstandard.dll','System.dll','System.Core.dll','Assembly-CSharp.dll','Newtonsoft.Json.dll','VirtualList.dll','Unity.TextMeshPro.dll','Unity.Netcode.Runtime.dll','DOTween.dll','UnityEngine.dll','UnityEngine.CoreModule.dll','UnityEngine.UI.dll','UnityEngine.UIModule.dll','UnityEngine.TextRenderingModule.dll','UnityEngine.PhysicsModule.dll','UnityEngine.AnimationModule.dll','UnityEngine.ParticleSystemModule.dll','UnityEngine.VFXModule.dll')
foreach ($reference in $references) { $arguments += '/reference:' + (Join-Path $managed $reference) }
$arguments += Join-Path $projectRoot 'connector\SpamTwitchPlugin.cs'
& $compiler @arguments
if ($LASTEXITCODE -ne 0) { throw 'La compilation du connecteur a échoué.' }
Write-Output (Join-Path $build 'SpamTwitchConnector.dll')
