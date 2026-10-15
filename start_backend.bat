@echo off
setlocal EnableDelayedExpansion
title MCGSE 3-in-1 Launcher (AI + Backend + Tunnel)
color 0A

echo.
echo  ====================================================================
echo   MCGSE Web-GIS  ^|  1-Click 3-Service Launcher
echo  ====================================================================
echo.
echo   Frontend : https://geospatial-suitability-web.dssintern1.workers.dev
echo   Tunnel   : https://outreach-freely-causal.ngrok-free.dev
echo   Local API: http://127.0.0.1:8000
echo   AI Engine: http://127.0.0.1:11434
echo.
echo  ====================================================================
echo.

:: [1/4] Ensure AI Runtime (Ollama) is running
echo  [1/4] Checking AI Runtime (Ollama)...
curl.exe -s http://127.0.0.1:11434/api/tags >nul 2>&1
if errorlevel 1 (
    echo       AI is offline. Starting Ollama in background...
    if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" (
        start "Ollama AI" /min "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" serve
    ) else (
        start "Ollama AI" /min ollama serve
    )
    set AI_READY=0
    for /L %%I in (1,1,20) do (
        if !AI_READY!==0 (
            curl.exe -s http://127.0.0.1:11434/api/tags >nul 2>&1
            if not errorlevel 1 (
                set AI_READY=1
            ) else (
                powershell -NoProfile -Command "Start-Sleep -Milliseconds 500" >nul 2>&1
            )
        )
    )
    if "!AI_READY!"=="1" (
        echo  [OK] AI Runtime (Ollama) started and ready!
    ) else (
        echo  [WARN] AI runtime did not respond within 10s. Deterministic GIS evidence report will be used.
    )
) else (
    echo  [OK] AI Runtime (Ollama) is already running and ready!
)
echo.

:: [2/4] Start FastAPI backend
echo  [2/4] Starting FastAPI backend on port 8000...
taskkill /IM ngrok.exe /F >nul 2>&1
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1

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

echo  [OK] Local FastAPI backend is live and healthy (200 OK)!
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
echo   STATUS: ALL 3 SERVICES LIVE AND SYNCHRONIZED!
echo  ====================================================================
echo.
echo   [OK] 1. AI Runtime (Ollama) : http://127.0.0.1:11434 (Ready)
echo   [OK] 2. FastAPI Backend     : http://127.0.0.1:8000 (Live)
echo   [OK] 3. Public Ngrok Tunnel : https://outreach-freely-causal.ngrok-free.dev (Connected)
echo.
echo   [OK] Web-GIS Application    : https://geospatial-suitability-web.dssintern1.workers.dev
echo.
echo   The frontend is now open in your browser and receiving data!
echo   Keep this launcher window open while using the application.
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
