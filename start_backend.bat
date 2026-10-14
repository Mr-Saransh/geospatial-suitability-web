@echo off
setlocal
title MCGSE Backend + Ngrok Static Tunnel
color 0A

echo.
echo  =====================================================
echo   MCGSE Web-GIS  ^|  Permanent 1-Click Launcher
echo  =====================================================
echo.
echo  Live Frontend : https://geospatial-suitability-web.dssintern1.workers.dev
echo  Permanent API : https://outreach-freely-causal.ngrok-free.dev
echo  Local API Docs: http://127.0.0.1:8000/docs
echo.
echo  Keep this window open while using the application.
echo  Press Ctrl+C to stop both backend and tunnel.
echo  =====================================================
echo.

:: Clean up any leftover processes on port 8000 first
echo  [1/3] Preparing environment...
taskkill /FI "WINDOWTITLE eq MCGSE Backend*" /T /F >nul 2>&1

:: Start the backend in a new minimized window
echo  [2/3] Starting FastAPI backend on port 8000...
pushd "%~dp0backend"
start "MCGSE Backend" /min C:\gee_env\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
popd

:: Wait for backend to be ready and healthy
echo  Waiting for backend health check (http://127.0.0.1:8000/api/v1/health)...
set READY=0
for /L %%I in (1,1,15) do (
    curl.exe -s http://127.0.0.1:8000/api/v1/health >nul 2>&1
    if not errorlevel 1 (
        set READY=1
        goto :backend_ready
    )
    timeout /t 1 /nobreak >nul
)

:backend_ready
if "%READY%"=="0" (
    echo.
    echo  [ERROR] Backend failed to start on port 8000 within 15 seconds!
    echo  Please check C:\gee_env\python.exe and database paths.
    pause
    exit /b 1
)

echo  [SUCCESS] FastAPI backend is live and healthy (200 OK)!
echo.

:: Start ngrok with permanent static domain
echo  [3/3] [NGROK] Connecting to https://outreach-freely-causal.ngrok-free.dev...
echo.
"C:\Users\ADMIN\Desktop\Private\ngrok.exe" http 8000 --url https://outreach-freely-causal.ngrok-free.dev

echo.
echo  Tunnel stopped. Closing backend...
taskkill /FI "WINDOWTITLE eq MCGSE Backend*" /T /F >nul 2>&1
pause
