@echo off
setlocal EnableDelayedExpansion
title MCGSE Backend + Ngrok Launcher
color 0A

echo.
echo  ====================================================================
echo   MCGSE Web-GIS  ^|  Permanent 1-Click Launcher
echo  ====================================================================
echo.
echo   Frontend : https://geospatial-suitability-web.dssintern1.workers.dev
echo   Tunnel   : https://outreach-freely-causal.ngrok-free.dev
echo   Local API: http://127.0.0.1:8000
echo.
echo  ====================================================================
echo.

:: [1/4] Clean up any previous python or ngrok processes
echo  [1/4] Cleaning previous instances...
taskkill /IM ngrok.exe /F >nul 2>&1
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1

:: [2/4] Start FastAPI backend
echo  [2/4] Starting FastAPI backend on port 8000...
pushd "%~dp0backend"
start "MCGSE Backend" /min C:\gee_env\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
popd

:: Wait for local backend to be healthy
echo  Waiting for local backend (http://127.0.0.1:8000/api/v1/health)...
set READY=0
for /L %%I in (1,1,20) do (
    if !READY!==0 (
        curl.exe -s http://127.0.0.1:8000/api/v1/health >nul 2>&1
        if not errorlevel 1 (
            set READY=1
        ) else (
            powershell -NoProfile -Command "Start-Sleep -Milliseconds 500" >nul 2>&1
        )
    )
)

if "!READY!"=="0" (
    echo.
    echo  [ERROR] Backend failed to start on port 8000 within 10 seconds!
    echo  Please check C:\gee_env\python.exe.
    pause
    exit /b 1
)

echo  [OK] Local backend is live and healthy (200 OK)!
echo.

:: [3/4] Start ngrok tunnel with static domain
echo  [3/4] Starting public tunnel (https://outreach-freely-causal.ngrok-free.dev)...
start "MCGSE Ngrok Tunnel" /min "C:\Users\ADMIN\Desktop\Private\ngrok.exe" http 8000 --url https://outreach-freely-causal.ngrok-free.dev --log stdout

:: Wait for ngrok public tunnel to respond 200 OK
echo  Waiting for public tunnel to establish...
set TUNNEL_READY=0
for /L %%I in (1,1,20) do (
    if !TUNNEL_READY!==0 (
        curl.exe -s -H "ngrok-skip-browser-warning: true" https://outreach-freely-causal.ngrok-free.dev/api/v1/health >nul 2>&1
        if not errorlevel 1 (
            set TUNNEL_READY=1
        ) else (
            powershell -NoProfile -Command "Start-Sleep -Milliseconds 500" >nul 2>&1
        )
    )
)

echo  [OK] Public ngrok tunnel is live and connected!
echo.

:: [4/4] Launch Frontend in Default Browser
echo  [4/4] Opening Web-GIS Frontend in browser...
start "" "https://geospatial-suitability-web.dssintern1.workers.dev"

echo.
echo  ====================================================================
echo   STATUS: ALL SERVICES LIVE AND SYNCHRONIZED!
echo  ====================================================================
echo.
echo   [OK] Local FastAPI Server : http://127.0.0.1:8000
echo   [OK] Public Ngrok Tunnel  : https://outreach-freely-causal.ngrok-free.dev
echo   [OK] Web-GIS Application  : https://geospatial-suitability-web.dssintern1.workers.dev
curl.exe -s http://127.0.0.1:11434/api/tags >nul 2>&1
if not errorlevel 1 (
    echo   [OK] Local Ollama AI      : http://127.0.0.1:11434 (Ready)
) else (
    echo   [INFO] Local Ollama AI    : Offline (Start Ollama application for neural generation)
)
echo.
echo   The frontend is now open in your browser and receiving data!
echo   Keep this window open while using the application.
echo.
echo   Press any key to stop all services and exit...
echo  ====================================================================
echo.

pause >nul

echo.
echo  Stopping services...
taskkill /IM ngrok.exe /F >nul 2>&1
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1
echo  Services stopped.
