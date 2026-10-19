$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$projectRoot = Split-Path -Parent $PSScriptRoot
$tools = Join-Path $projectRoot '.tools'
New-Item -ItemType Directory -Path $tools -Force | Out-Null
function Get-VerifiedArchive([string]$Url, [string]$Name, [string]$Hash, [string]$Destination) {
    $archive = Join-Path $tools $Name
    if (!(Test-Path -LiteralPath $archive)) { Invoke-WebRequest -Uri $Url -OutFile $archive }
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $Hash) { throw "Somme SHA256 incorrecte : $Name" }
    if ($Destination) { Expand-Archive -LiteralPath $archive -DestinationPath (Join-Path $tools $Destination) -Force }
    return $archive
}
Get-VerifiedArchive 'https://github.com/electron/electron/releases/download/v44.9.0/electron-v44.9.0-win32-x64.zip' 'electron-win32-x64.zip' '88e08039d0ef359bab9f674e8051fa103bd8628ea7c5a5e1daaa610a8a0c6931' 'electron' | Out-Null
Get-VerifiedArchive 'https://github.com/BepInEx/BepInEx/releases/download/v5.4.23.5/BepInEx_win_x64_5.4.23.5.zip' 'bepinex.zip' '82f9878551030f54657792c0740d9d51a09500eeae1fba21106b0c441e6732c4' 'bepinex' | Out-Null
$setup = Get-VerifiedArchive 'https://github.com/jrsoftware/issrc/releases/download/is-6_7_3/innosetup-6.7.3.exe' 'innosetup-6.7.3.exe' '9c73c3bae7ed48d44112a0f48e66742c00090bdb5bef71d9d3c056c66e97b732' ''
$inno = Join-Path $tools 'inno-setup'
if (!(Test-Path -LiteralPath (Join-Path $inno 'ISCC.exe'))) {
    $process = Start-Process -FilePath $setup -ArgumentList @('/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/CURRENTUSER', ('/DIR="' + $inno + '"')) -WindowStyle Hidden -PassThru -Wait
    if ($process.ExitCode -ne 0) { throw 'Installation du compilateur Inno Setup impossible.' }
}

Get-VerifiedArchive 'https://github.com/electron/rcedit/releases/download/v2.0.0/rcedit-x64.exe' 'rcedit-x64.exe' '3e7801db1a5edbec91b49a24a094aad776cb4515488ea5a4ca2289c400eade2a' '' | Out-Null
