@echo off
set "PATH=%~dp0;%~dp0node_modules\.bin;%PATH%"
call "%~dp0node_modules\.bin\pm2.cmd" resurrect
