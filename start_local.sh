#!/usr/bin/env bash
# MCDSE Web-GIS 1-Click Local Launcher (Bash / WSL / Git Bash)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
BACKEND_DIR="$PROJECT_ROOT/backend"

if [ -z "$PYTHON_EXE" ]; then
    if [ -f "C:/gee_env/python.exe" ]; then
        PYTHON_EXE="C:/gee_env/python.exe"
    elif [ -f "$BACKEND_DIR/.venv/bin/python" ]; then
        PYTHON_EXE="$BACKEND_DIR/.venv/bin/python"
    elif [ -f "$PROJECT_ROOT/.venv/bin/python" ]; then
        PYTHON_EXE="$PROJECT_ROOT/.venv/bin/python"
    else
        PYTHON_EXE="python3"
    fi
fi

echo ""
echo "===================================================================="
echo "  MCDSE Web-GIS | 1-Click Local Launcher (AI + Backend + Frontend)"
echo "===================================================================="
echo ""
echo "  Local Frontend : http://localhost:5173"
echo "  Local Backend  : http://127.0.0.1:8000"
echo "  Local AI Engine: http://127.0.0.1:11434 (Ollama)"
echo ""
echo "===================================================================="
echo ""

# [1/4] Check AI Runtime
echo "[1/4] Checking AI Runtime (Ollama)..."
if curl -s http://127.0.0.1:11434/api/tags > /dev/null 2>&1; then
    echo " [OK] AI Runtime is already running!"
else
    echo "       Starting Ollama in background..."
    ollama serve > /dev/null 2>&1 &
    sleep 2
fi

# [2/4] Start FastAPI backend
echo "[2/4] Starting FastAPI backend on port 8000..."
cd "$BACKEND_DIR" || exit 1
"$PYTHON_EXE" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 > /dev/null 2>&1 &
BACKEND_PID=$!

echo "Waiting for local backend..."
for i in {1..30}; do
    if curl -s http://127.0.0.1:8000/api/v1/health > /dev/null 2>&1; then
        echo " [OK] Backend live at http://127.0.0.1:8000"
        break
    fi
    sleep 0.5
done

# [3/4] Start Frontend Dev Server
echo "[3/4] Starting Frontend Dev Server on port 5173..."
cd "$PROJECT_ROOT" || exit 1
npm run dev > /dev/null 2>&1 &
FRONTEND_PID=$!

echo "Waiting for frontend dev server..."
for i in {1..30}; do
    if curl -s http://localhost:5173/ > /dev/null 2>&1; then
        echo " [OK] Frontend live at http://localhost:5173"
        break
    fi
    sleep 0.5
done

# [4/4] Open in Browser
echo "[4/4] Opening MCDSE Web-GIS in browser..."
cmd.exe /c start "http://localhost:5173/" 2>/dev/null || open "http://localhost:5173/" 2>/dev/null

echo ""
echo "===================================================================="
echo "  STATUS: ALL LOCAL SERVICES RUNNING! (ZERO NGROK REQUIRED)"
echo "===================================================================="
echo "  Press Ctrl+C to terminate all services."
echo ""

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
