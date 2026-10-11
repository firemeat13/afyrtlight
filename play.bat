@echo off
cd /d "%~dp0"
echo Starting AFTERLIGHT... open the Local or Network address shown below in a browser.
call npm run dev
pause
