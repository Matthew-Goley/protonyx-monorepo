@echo off
echo Starting Protonyx dev environment...

:: Start backend
start "Protonyx Backend" cmd /k "cd /d %~dp0backend && npm run dev"

:: Wait 2 seconds for backend to start
timeout /t 2 /nobreak > nul

:: Start frontend with browser-sync
start "Protonyx Frontend" cmd /k "cd /d %~dp0frontend && browser-sync start --server --port 5500 --files **/*"

echo.
echo Backend running on http://localhost:3000
echo Frontend running on http://localhost:5500
echo.
pause