@echo off
cd /d "%~dp0"

echo Starting web at http://localhost:5173/
echo.
npm run dev

echo.
echo Server stopped or failed. Press any key to close this window.
pause >nul
