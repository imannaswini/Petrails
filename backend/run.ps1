Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Starting PETRAILS Actuarial Intelligence Backend (Port 8000)" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

& "$PSScriptRoot\.venv\Scripts\python.exe" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

