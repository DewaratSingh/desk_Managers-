@echo off
title Building DeskManager Finder Executable
cd /d "%~dp0"

echo ===================================================
echo Building Standalone DeskManager Finder (.exe)
echo ===================================================

pyinstaller --noconsole --onefile --name="DeskManagerFinder" --icon="deskmanager.ico" --add-data "deskmanager.ico;." --add-data "scanner.py;." main.py

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ===================================================
    echo Build Successful!
    echo Executable is located at: dist\DeskManagerFinder.exe
    echo ===================================================
) else (
    echo.
    echo Build failed. Please ensure pyinstaller is installed: pip install pyinstaller
)

pause
