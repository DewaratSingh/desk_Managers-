@echo off
title DeskManager Network Finder
cd /d "%~dp0"
python main.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Python failed to start DeskManager Finder.
    pause
)
