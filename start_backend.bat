@echo off
title MCGSE Backend + Ngrok Static Tunnel
color 0A

echo.
echo  =====================================================
echo   MCGSE Web-GIS  ^|  Permanent 1-Click Launcher
echo  =====================================================
echo.
echo  Starting FastAPI backend on port 8000...
echo  Starting Ngrok permanent static tunnel...
echo.
echo  Live Frontend : https://geospatial-suitability-web.dssintern1.workers.dev
echo  Permanent API : https://outreach-freely-causal.ngrok-free.dev
echo  Local API Docs: http://127.0.0.1:8000/docs
echo.
echo  Keep this window open while using the application.
echo  Press Ctrl+C to stop both backend and tunnel.
echo  =====================================================
echo.

:: Start the backend in a new minimized window
start "MCGSE Backend" /min cmd /c "cd /d \"C:\Users\ADMIN\Desktop\Private\Saransh project\project\code climate frontend\MCGSE Web-GIS Application Design\backend\" && C:\gee_env\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

:: Wait for backend to be ready
timeout /t 3 /nobreak >nul

:: Start ngrok with your permanent static domain
echo  [NGROK] Connecting to https://outreach-freely-causal.ngrok-free.dev...
echo.
"C:\Users\ADMIN\Desktop\Private\ngrok.exe" http 8000 --url https://outreach-freely-causal.ngrok-free.dev

echo.
echo  Tunnel stopped. Closing backend...
taskkill /FI "WINDOWTITLE eq MCGSE Backend" >nul 2>&1
pause

