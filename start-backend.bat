@echo off
setlocal enabledelayedexpansion

REM ----------------------------------------------------------
REM  Update the placeholders below before running this script.
REM  Do NOT commit your real keys to version control.
REM ----------------------------------------------------------
set "AWS_ACCESS_KEY_ID=REPLACE_WITH_YOUR_ACCESS_KEY_ID"
set "AWS_SECRET_ACCESS_KEY=REPLACE_WITH_YOUR_SECRET_ACCESS_KEY"
set "AWS_DEFAULT_REGION=us-east-1"
set "SEMANTIC_SCHOLAR_API_KEY=REPLACE_WITH_YOUR_SS_API_KEY"

echo.
echo === Cloud Research Workspace :: Backend ===
echo Current directory: %cd%
echo.

REM Ensure the virtual environment exists
if not exist venv (
    echo [setup] Creating Python virtual environment...
    python -m venv venv
)

REM Activate the virtual environment
call venv\Scripts\activate

REM Install backend dependencies
echo [setup] Installing Python dependencies...
python -m pip install --upgrade pip
pip install -r requirements.txt

echo.
echo [run] Starting FastAPI server on http://0.0.0.0:8000
echo       (accessible via http://localhost:8000 from this machine)
echo       Press CTRL+C to stop the server.
echo.

uvicorn main:app --host 0.0.0.0 --port 8000 --reload

endlocal


