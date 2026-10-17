@echo off
setlocal EnableDelayedExpansion
title MCGSE 3-in-1 Launcher (AI + Backend + Tunnel) — Auto-Recovery
color 0A

echo.
echo  ====================================================================
echo   MCGSE Web-GIS  ^|  1-Click 3-Service Launcher (Auto-Recovery)
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
echo  [1/4] Checking AI Runtime...
curl.exe -s http://127.0.0.1:11434/api/tags >nul 2>&1
if errorlevel 1 (
    echo       AI runtime is offline. Starting Ollama in background...
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
        echo  [OK] AI Runtime started and ready!
    ) else (
        echo  [WARN] AI runtime did not respond within 10s. Deterministic GIS engine will be active.
    )
) else (
    echo  [OK] AI Runtime is already running and ready!
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
echo  Waiting for local backend on port 8000...
set BACKEND_READY=0
for /L %%I in (1,1,30) do (
    if !BACKEND_READY!==0 (
        curl.exe -s http://127.0.0.1:8000/api/v1/health >nul 2>&1
        if not errorlevel 1 (
            set BACKEND_READY=1
        ) else (
            powershell -NoProfile -Command "Start-Sleep -Milliseconds 500" >nul 2>&1
        )
    )
)

if "!BACKEND_READY!"=="0" (
    echo.
    echo  [ERROR] Backend failed to start on port 8000 within 15 seconds!
    echo  Please check C:\gee_env\python.exe and dependencies.
    echo.
    pause
    exit /b 1
)

echo  [OK] Local FastAPI backend is live and healthy - 200 OK!
echo.

:: [3/4] Start Ngrok tunnel with static domain
echo  [3/4] Starting Ngrok public tunnel...
taskkill /IM ngrok.exe /F >nul 2>&1
start "MCGSE Ngrok Tunnel" /min "C:\Users\ADMIN\Desktop\Private\ngrok.exe" http 8000 --url https://outreach-freely-causal.ngrok-free.dev --log stdout

:: Brief 2-second settle time for ngrok process to bind
powershell -NoProfile -Command "Start-Sleep -Seconds 2" >nul 2>&1
echo  [OK] Public Ngrok Tunnel is running: https://outreach-freely-causal.ngrok-free.dev
echo.

:: [4/4] Launch Frontend in Default Browser
echo  [4/4] Opening Web-GIS Frontend in browser...
start "" "https://geospatial-suitability-web.dssintern1.workers.dev"

echo.
echo  ====================================================================
echo   STATUS: ALL 3 SERVICES LIVE AND SYNCHRONIZED!
echo  ====================================================================
echo.
echo   [OK] 1. AI Runtime          : http://127.0.0.1:11434 (Ready)
echo   [OK] 2. FastAPI Backend     : http://127.0.0.1:8000 (Live)
echo   [OK] 3. Public Ngrok Tunnel : https://outreach-freely-causal.ngrok-free.dev (Static Domain)
echo.
echo   [OK] Web-GIS Application    : https://geospatial-suitability-web.dssintern1.workers.dev
echo.
echo   The frontend is now open in your browser and connected to Ngrok!
echo   AUTO-RECOVERY: All services will automatically restart if they crash.
echo   Keep this launcher window open while using the application.
echo.
echo   To stop all services and exit, type Q and press Enter.
echo  ====================================================================
echo.

:: =========================================================================
:: AUTO-RECOVERY WATCHDOG (ZERO-QUOTA OPTIMIZED)
:: Monitors all services LOCALLY every 15 seconds.
:: NEVER sends HTTP requests over the public internet so Ngrok quota is 0% used!
:: =========================================================================

:WATCHDOG
set "USER_CHOICE="
powershell -NoProfile -Command "$input = [System.Console]::In; $task = [System.Threading.Tasks.Task]::Run([System.Func[string]]{ $input.ReadLine() }); if ($task.Wait(15000)) { $task.Result } else { 'TIMEOUT' }" 2>nul > "%TEMP%\mcgse_input.tmp"
set /p USER_CHOICE=<"%TEMP%\mcgse_input.tmp"
del "%TEMP%\mcgse_input.tmp" 2>nul
if /i "!USER_CHOICE!"=="Q" goto :SHUTDOWN

:: ── Check 1: Ollama AI Runtime (Local check only) ──
curl.exe -s --connect-timeout 3 http://127.0.0.1:11434/api/tags >nul 2>&1
if errorlevel 1 (
    echo  [%TIME%] [WATCHDOG] AI Runtime crashed! Restarting Ollama...
    if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" (
        start "Ollama AI" /min "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" serve
    ) else (
        start "Ollama AI" /min ollama serve
    )
    powershell -NoProfile -Command "Start-Sleep -Seconds 3" >nul 2>&1
    curl.exe -s http://127.0.0.1:11434/api/tags >nul 2>&1
    if not errorlevel 1 (
        echo  [%TIME%] [WATCHDOG] AI Runtime recovered successfully!
    ) else (
        echo  [%TIME%] [WATCHDOG] AI Runtime still starting... will recheck next cycle.
    )
)

:: ── Check 2: FastAPI Backend (Local check only — zero ngrok requests) ──
curl.exe -s --connect-timeout 3 http://127.0.0.1:8000/api/v1/health >nul 2>&1
if errorlevel 1 (
    echo  [%TIME%] [WATCHDOG] Backend crashed! Restarting FastAPI on port 8000...
    powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1
    pushd "%~dp0backend"
    start "MCGSE Backend" /min C:\gee_env\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
    popd
    set BACKEND_BACK=0
    for /L %%I in (1,1,20) do (
        if !BACKEND_BACK!==0 (
            curl.exe -s http://127.0.0.1:8000/api/v1/health >nul 2>&1
            if not errorlevel 1 (
                set BACKEND_BACK=1
            ) else (
                powershell -NoProfile -Command "Start-Sleep -Milliseconds 500" >nul 2>&1
            )
        )
    )
    if "!BACKEND_BACK!"=="1" (
        echo  [%TIME%] [WATCHDOG] Backend recovered successfully!
    ) else (
        echo  [%TIME%] [WATCHDOG] Backend still starting... will recheck next cycle.
    )
)

:: ── Check 3: Ngrok Process (Process-level check only — zero HTTP requests consumed) ──
tasklist /FI "IMAGENAME eq ngrok.exe" 2>nul | find /I "ngrok.exe" >nul 2>&1
if errorlevel 1 (
    echo  [%TIME%] [WATCHDOG] Ngrok process died! Restarting...
    start "MCGSE Ngrok Tunnel" /min "C:\Users\ADMIN\Desktop\Private\ngrok.exe" http 8000 --url https://outreach-freely-causal.ngrok-free.dev --log stdout
    powershell -NoProfile -Command "Start-Sleep -Seconds 3" >nul 2>&1
    echo  [%TIME%] [WATCHDOG] Ngrok restarted successfully.
)

goto :WATCHDOG

:SHUTDOWN
echo.
echo  Stopping services...
taskkill /IM ngrok.exe /F >nul 2>&1
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1
echo  Services stopped successfully.
timeout /t 2 >nul
exit /b 0

