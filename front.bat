@echo off
echo Starting Protonyx frontend only (Railway backend)...
start "Protonyx Frontend" cmd /k "cd /d %~dp0frontend && browser-sync start --server --port 5500 --files **/*"
echo Frontend running on http://localhost:5500
echo API hitting Railway production backend
pause