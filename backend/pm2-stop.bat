@echo off
cd /d "%~dp0"
set "PATH=%~dp0;%~dp0node_modules\.bin;%PATH%"
echo Stopping DeskManager Backend PM2 process...
call "%~dp0node_modules\.bin\pm2.cmd" stop deskmanager-server 2>nul
call "%~dp0node_modules\.bin\pm2.cmd" delete deskmanager-server 2>nul
call "%~dp0node_modules\.bin\pm2.cmd" stop deskmanager-backend 2>nul
call "%~dp0node_modules\.bin\pm2.cmd" delete deskmanager-backend 2>nul
call "%~dp0node_modules\.bin\pm2.cmd" save 2>nul
echo Terminating PM2 Daemon...
call "%~dp0node_modules\.bin\pm2.cmd" kill 2>nul
