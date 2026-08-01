@echo off
title Mental Health App Server
echo ===================================================
echo Starting Local Server for Mental Health App...
echo DO NOT CLOSE THIS WINDOW if you want to use the app.
echo ===================================================
echo.

:: Start Backend API in a separate window
echo Starting Backend Server (this may take a moment to load ML models)...
start "Backend API (Flask)" cmd /k "cd backend && .\venv\Scripts\python.exe app.py"

:: Open the browser automatically after a short delay
start "" cmd /c "timeout /t 5 >nul & start http://localhost:8000"

:: Try to start the secure server using Python first (fastest)
python frontend/serve.py 8000

:: If Python isn't installed, it will try Node.js (npx)
if %errorlevel% neq 0 (
    echo Python not found, trying Node.js...
    npx http-server frontend -p 8000 -d false
)

pause
