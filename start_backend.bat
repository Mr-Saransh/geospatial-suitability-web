@echo off
title MCGSE Backend + Tunnel
color 0A

echo.
echo  =====================================================
echo   MCGSE Web-GIS  ^|  Backend + Tunnel Launcher
echo  =====================================================
echo.
echo  Starting FastAPI backend on port 8000...
echo  Starting Cloudflare Tunnel to expose it publicly...
echo.
echo  Frontend : https://geospatial-suitability-web.dssintern1.workers.dev
echo  API Docs : http://127.0.0.1:8000/docs
echo.
echo  The tunnel URL will appear below (look for the
echo  .trycloudflare.com link). If it changes, update the
echo  frontend .env and rebuild, or paste the new URL in
echo  the app's Help ^> Backend Settings.
echo.
echo  Press Ctrl+C to stop everything.
echo  =====================================================
echo.

:: Start the backend in a new minimized window
start "MCGSE Backend" /min cmd /c "cd /d \"C:\Users\ADMIN\Desktop\Private\Saransh project\project\code climate frontend\MCGSE Web-GIS Application Design\backend\" && C:\gee_env\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

:: Wait for backend to start
timeout /t 3 /nobreak >nul

:: Start the tunnel in this window so the user can see the URL
echo  [TUNNEL] Starting Cloudflare Quick Tunnel...
echo.
"C:\Users\ADMIN\Desktop\Private\cloudflared-windows-amd64.exe" tunnel --url http://localhost:8000

echo.
echo  Tunnel stopped. Closing backend...
taskkill /FI "WINDOWTITLE eq MCGSE Backend" >nul 2>&1
pause
