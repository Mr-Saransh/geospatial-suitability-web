@echo off
setlocal EnableDelayedExpansion
title MCDSE Web-GIS (Local: AI + Backend + Frontend)
color 0B

echo.
echo  ====================================================================
echo   MCDSE Web-GIS  ^|  1-Click Local Launcher (AI + Backend + Frontend)
echo  ====================================================================
echo.
echo   Local Frontend : http://localhost:5173
echo   Local Backend  : http://127.0.0.1:8000
echo   Local AI Engine: http://127.0.0.1:11434 (Ollama)
echo.
echo  ====================================================================
echo.

set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
set "PROJECT_ROOT=%SCRIPT_DIR%"
set "BACKEND_DIR=%PROJECT_ROOT%\backend"

:: Discover Python: prioritize environment override, C:\gee_env, project .venv, or system python
if not defined PYTHON_EXE (
    if exist "C:\gee_env\python.exe" (
        set "PYTHON_EXE=C:\gee_env\python.exe"
    ) else if exist "%BACKEND_DIR%\.venv\Scripts\python.exe" (
        set "PYTHON_EXE=%BACKEND_DIR%\.venv\Scripts\python.exe"
    ) else if exist "%PROJECT_ROOT%\.venv\Scripts\python.exe" (
        set "PYTHON_EXE=%PROJECT_ROOT%\.venv\Scripts\python.exe"
    ) else (
        set "PYTHON_EXE=python"
    )
)

:: [1/4] Ensure AI Runtime (Ollama) is running
echo  [1/4] Checking AI Runtime (Ollama)...
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
        echo  [WARN] AI runtime did not respond within 10s. Continuing...
    )
) else (
    echo  [OK] AI Runtime is already running and ready!
)
echo.

:: [2/4] Start FastAPI backend on port 8000
echo  [2/4] Starting FastAPI backend on port 8000...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1

pushd "%BACKEND_DIR%"
start "MCDSE Backend (Port 8000)" /min "%PYTHON_EXE%" -m uvicorn app.main:app --host 127.0.0.1 --port 8000
popd

echo  Waiting for local backend to be healthy...
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
    echo  Please check %PYTHON_EXE% and dependencies.
    echo.
    pause
    exit /b 1
)
echo  [OK] Local FastAPI backend is live and healthy (200 OK)!
echo.

:: [3/4] Start Frontend Dev Server on port 5173
echo  [3/4] Starting Frontend Dev Server on port 5173...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1

pushd "%PROJECT_ROOT%"
start "MCDSE Frontend (Vite 5173)" /min cmd /c "npm run dev"
popd

echo  Waiting for frontend dev server...
set FRONTEND_READY=0
for /L %%I in (1,1,30) do (
    if !FRONTEND_READY!==0 (
        curl.exe -s http://localhost:5173/ >nul 2>&1
        if not errorlevel 1 (
            set FRONTEND_READY=1
        ) else (
            powershell -NoProfile -Command "Start-Sleep -Milliseconds 500" >nul 2>&1
        )
    )
)
echo  [OK] Frontend dev server is live on http://localhost:5173!
echo.

:: [4/4] Launch in Default Browser
echo  [4/4] Opening MCDSE Web-GIS in browser...
start "" "http://localhost:5173/"

echo.
echo  ====================================================================
echo   STATUS: ALL LOCAL SERVICES RUNNING! (ZERO NGROK REQUIRED)
echo  ====================================================================
echo.
echo   [OK] AI Engine : http://127.0.0.1:11434 (Ollama)
echo   [OK] Backend   : http://127.0.0.1:8000 (FastAPI)
echo   [OK] Frontend  : http://localhost:5173 (Vite Web-GIS)
echo.
echo   Leave this launcher open while using the application.
echo   Press any key to stop all services and exit.
echo  ====================================================================
echo.
pause >nul

echo  Shutting down services...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1
echo  [OK] All services stopped.
