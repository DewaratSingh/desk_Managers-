@echo off
setlocal
echo ========================================================
echo Building DeskManager Setup Installer using Inno Setup
echo ========================================================

set "ISCC_CMD="

where iscc >nul 2>&1
if %ERRORLEVEL% equ 0 set "ISCC_CMD=iscc"

if "%ISCC_CMD%"=="" if exist "%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe" set "ISCC_CMD=%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe"
if "%ISCC_CMD%"=="" if exist "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" set "ISCC_CMD=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if "%ISCC_CMD%"=="" if exist "C:\Program Files\Inno Setup 6\ISCC.exe" set "ISCC_CMD=C:\Program Files\Inno Setup 6\ISCC.exe"

if "%ISCC_CMD%"=="" (
    echo ERROR: Inno Setup Compiler ISCC.exe not found!
    echo Please install Inno Setup 6 or add ISCC to your PATH.
    pause
    exit /b 1
)

echo Using Inno Setup Compiler: "%ISCC_CMD%"
echo Compiling installer.iss...

"%ISCC_CMD%" "%~dp0installer.iss"

if %ERRORLEVEL% equ 0 (
    echo ========================================================
    echo SUCCESS: Installer generated in output folder!
    echo ========================================================
) else (
    echo ERROR: Installer compilation failed with error code %ERRORLEVEL%.
)
