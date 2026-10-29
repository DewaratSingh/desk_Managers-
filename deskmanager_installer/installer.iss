#define MyAppName "DeskManager"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "DeskManager"
#define MyAppExeName "DeskManagerFinder.exe"

[Setup]
AppId={{7A8C3D12-ABCD-4567-8901-123456789DEF}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
OutputDir=output
OutputBaseFilename=DeskManager_Setup
SetupIconFile=file\deskmanager.ico
UninstallDisplayIcon={app}\deskmanager.ico
UninstallDisplayName={#MyAppName}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=yes
DisableProgramGroupPage=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
; Main application icon
Source: "file\deskmanager.ico"; DestDir: "{app}"; Flags: ignoreversion

; Standalone desktop app executable
Source: "file\desktop\DeskManagerFinder.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "file\desktop\DeskManagerFinder.exe"; DestDir: "{app}\desktop"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\deskmanager.ico"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\deskmanager.ico"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent
