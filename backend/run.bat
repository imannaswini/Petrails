@echo off
echo ==========================================================
echo Starting PETRAILS Actuarial Intelligence Backend (Port 8000)
echo ==========================================================
"%~dp0.venv\Scripts\python.exe" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

