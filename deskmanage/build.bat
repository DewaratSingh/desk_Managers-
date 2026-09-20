@echo off
echo Building DeskManage HTML/CSS/JS Desktop Executable...
pyinstaller --noconsole --onefile --name="DeskManage" --add-data "index.html;." --add-data "style.css;." --add-data "app.js;." main.py
echo Build completed! Executable located in dist/DeskManage.exe
pause
