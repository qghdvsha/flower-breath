@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo 未检测到 Node.js，请先安装兼容版本。
 pause
 exit /b 1
)
call npm.cmd ci --cache .npm-cache
if errorlevel 1 goto failed
call npm.cmd run build
if errorlevel 1 goto failed
echo 完成，请双击 start.bat。
pause
exit /b 0
:failed
echo 安装或构建未完成，请查看上方错误。
pause
exit /b 1
