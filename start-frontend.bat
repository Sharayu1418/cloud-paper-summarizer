@echo off
setlocal

REM ----------------------------------------------------------
REM  Update the placeholder if you deploy the backend elsewhere.
REM ----------------------------------------------------------
set "NEXT_PUBLIC_API_BASE_URL=http://localhost:8000"

echo.
echo === Cloud Research Workspace :: Frontend ===
echo Current directory: %cd%
echo.

pushd frontend

if not exist node_modules (
    echo [setup] Installing npm dependencies...
    npm install
) else (
    echo [setup] Updating npm dependencies (safe to skip with Ctrl+C)...
    npm install
)

echo.
echo [run] Starting Next.js dev server on http://localhost:3000
echo       Press CTRL+C to stop.
echo.

npm run dev

popd
endlocal


