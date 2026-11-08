@echo off
rem ---------------------------------------------------------------
rem  AutoPark Simulator - one-click launcher (offline, no install)
rem  Tries Python first, then Node; opens the browser automatically.
rem ---------------------------------------------------------------
setlocal
cd /d "%~dp0"
set PORT=8080

start "" http://localhost:%PORT%/

where py >nul 2>nul
if %errorlevel%==0 (
  echo Starting server with Python...
  py -3 -m http.server %PORT%
  goto :eof
)

where python >nul 2>nul
if %errorlevel%==0 (
  echo Starting server with Python...
  python -m http.server %PORT%
  goto :eof
)

where node >nul 2>nul
if %errorlevel%==0 (
  echo Starting server with Node...
  node server.mjs %PORT%
  goto :eof
)

echo Neither Python nor Node was found on this PC.
echo Install one of them, or open index.html through any static server.
pause
