@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist node_modules (
 echo 请先双击 setup.bat 安装项目依赖。
 pause
 exit /b 1
)
echo Flower Breath: http://127.0.0.1:5180
call npm.cmd run dev
pause
