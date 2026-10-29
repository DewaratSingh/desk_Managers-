@echo off
cd /d "%~dp0"
set "PATH=%~dp0;%~dp0node_modules\.bin;%PATH%"
echo Starting DeskManager Backend via PM2...
call "%~dp0node_modules\.bin\pm2.cmd" delete deskmanager-server 2>nul
call "%~dp0node_modules\.bin\pm2.cmd" delete deskmanager-backend 2>nul
call "%~dp0node_modules\.bin\pm2.cmd" start index.js --name "deskmanager-backend"
call "%~dp0node_modules\.bin\pm2.cmd" save
