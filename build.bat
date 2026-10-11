@echo off
cd /d "%~dp0"
echo Building AFTERLIGHT into the "dist" folder...
call npm run build
echo.
echo Done. Upload the "dist" folder (for example drag it onto netlify.com/drop).
pause
