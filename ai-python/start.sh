#!/bin/bash
# Aegis AI Engine - Startup Script
# Usage: bash start.sh

set -e

cd "$(dirname "$0")"

echo "🛡️  Starting Aegis AI Insurance Engine..."
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦  Creating virtual environment..."
    python3 -m venv venv
    echo "📦  Installing dependencies..."
    venv/bin/pip install --upgrade pip
    venv/bin/pip install -r requirements.txt
    echo "✅  Dependencies installed!"
fi

# Permanently resolve "Address already in use" by terminating any existing process bound to port 8000
echo "🧹  Checking for existing processes on port 8000..."
PID=$(lsof -t -i:8000 2>/dev/null || true)
if [ -n "$PID" ]; then
    echo "⚠️  Port 8000 is occupied by process(es): $PID. Releasing port..."
    kill -9 $PID 2>/dev/null || true
    sleep 1
    echo "✅  Port 8000 successfully released!"
else
    # Fallback to fuser check
    fuser -k 8000/tcp >/dev/null 2>&1 || true
fi

echo "🚀  Starting FastAPI server on http://0.0.0.0:8000"
echo "📚  API Docs available at: http://localhost:8000/docs"
echo ""

venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --reload

