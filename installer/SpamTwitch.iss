#ifndef SourceRoot
  #error SourceRoot must point to the prepared companion folder
#endif
#ifndef OutputRoot
  #error OutputRoot is required
#endif
#ifndef AppVersion
  #define AppVersion "0.2.0"
#endif
#ifdef TestBuild
  #define ProductName "SPAM Twitch Installer Test"
  #define ProductId "SPAMCardInspector-Installer-Test"
  #define OutputName "SPAM-Twitch-Setup-Test"
#else
  #define ProductName "SPAM Card Inspector"
  #define ProductId "SPAMCardInspector-Companion"
  #define OutputName "SPAM-Twitch-Setup-" + AppVersion
#endif

[Setup]
AppId={#ProductId}
AppName={#ProductName}
AppVersion={#AppVersion}
AppPublisher=Jo0kker
AppPublisherURL=https://spam-twitch.codible.net/
AppSupportURL=https://spam-twitch.codible.net/
DefaultDirName={localappdata}\Programs\SPAMCardInspector
DefaultGroupName={#ProductName}
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
OutputDir={#OutputRoot}
OutputBaseFilename={#OutputName}
#ifdef TestBuild
Compression=zip
#else
Compression=lzma2/fast
#endif
SolidCompression=yes
WizardStyle=modern
SetupIconFile={#SourceRoot}\resources\app\assets\app.ico
DisableProgramGroupPage=yes
UninstallDisplayName={#ProductName}
UninstallDisplayIcon={app}\SpamCardInspector.exe
CloseApplications=no
RestartApplications=no
SetupLogging=yes

[Languages]
Name: "french"; MessagesFile: "compiler:Languages\French.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[CustomMessages]
french.DesktopShortcut=Créer un raccourci sur le Bureau
english.DesktopShortcut=Create a desktop shortcut
french.StopApp=Arrêter SPAM Card Inspector
english.StopApp=Stop SPAM Card Inspector
french.OpenApp=Ouvrir SPAM Card Inspector pour configurer le jeu et Twitch
english.OpenApp=Open SPAM Card Inspector to set up the game and Twitch
french.CloseAppError=Impossible d’arrêter le compagnon installé. Fermez-le avant de réessayer.
english.CloseAppError=Cannot stop the installed companion. Close it before trying again.

[Tasks]
Name: "desktopicon"; Description: "{cm:DesktopShortcut}"; Flags: unchecked

[Files]
Source: "{#SourceRoot}\*"; DestDir: "{app}"; Excludes: ".runtime\*,config.local.json"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#ProductName}"; Filename: "{app}\SpamCardInspector.exe"; WorkingDir: "{app}"
Name: "{group}\{cm:StopApp}"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\tools\Start-Companion.ps1"" -Stop"; WorkingDir: "{app}"
Name: "{autodesktop}\{#ProductName}"; Filename: "{app}\SpamCardInspector.exe"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\SpamCardInspector.exe"; Description: "{cm:OpenApp}"; Flags: postinstall nowait skipifsilent

[UninstallRun]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\tools\Start-Companion.ps1"" -Stop"; Flags: runhidden skipifdoesntexist; RunOnceId: "StopOwnedCompanion"

[Code]
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
  StopScript: String;
begin
  Result := '';
  StopScript := ExpandConstant('{app}\tools\Start-Companion.ps1');
  if FileExists(StopScript) then
  begin
    if not Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
      '-NoProfile -ExecutionPolicy Bypass -File "' + StopScript + '" -Stop', '',
      SW_HIDE, ewWaitUntilTerminated, ResultCode) then
      Result := CustomMessage('CloseAppError')
    else if ResultCode <> 0 then
      Result := CustomMessage('CloseAppError');
  end;
end;
