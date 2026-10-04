@echo off
setlocal

REM ============================================================
REM AstroRaf local server starter
REM
REM This file can be copied to any Windows PC. Only the line
REM below (PROJECT_PATH) needs to be edited to point at wherever
REM the AstroRaf project folder lives on THAT pc.
REM ============================================================

set "PROJECT_PATH=C:\Users\Wouter\Documents\AstroRaf"
set "SERVE_ROOT=%LocalAppData%\AstroRafManualServe"
set "JUNCTION=%SERVE_ROOT%\AstroRaf"
set "PORT=8080"

if not exist "%PROJECT_PATH%" (
    echo [FOUT] Projectmap niet gevonden: %PROJECT_PATH%
    echo Pas de PROJECT_PATH-regel bovenaan dit bestand aan.
    pause
    exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
    echo [FOUT] Node.js is niet gevonden. Installeer Node.js eerst: https://nodejs.org/
    pause
    exit /b 1
)

REM If something is already listening on this port (e.g. an autostart
REM service on this pc), don't touch the junction — just open the browser.
netstat -ano | findstr "127.0.0.1:%PORT% " | findstr "LISTENING" >nul
if not errorlevel 1 (
    echo Er draait al een server op poort %PORT% ^(vermoedelijk een andere autostart-service op deze pc^).
    echo Open gewoon: http://localhost:%PORT%/AstroRaf/
    start "" "http://localhost:%PORT%/AstroRaf/"
    pause
    exit /b 0
)

if not exist "%SERVE_ROOT%" mkdir "%SERVE_ROOT%"

REM (Re)create the junction so it always points at PROJECT_PATH
if exist "%JUNCTION%" rmdir "%JUNCTION%" >nul 2>nul
mklink /J "%JUNCTION%" "%PROJECT_PATH%" >nul
if errorlevel 1 (
    echo [FOUT] Kon junction niet aanmaken naar %PROJECT_PATH%
    pause
    exit /b 1
)

echo Server wordt gestart op http://localhost:%PORT%/AstroRaf/
echo Laat dit venster open; sluit het om de server te stoppen.
echo.

start "" "http://localhost:%PORT%/AstroRaf/"
cd /d "%SERVE_ROOT%"
npx serve -l tcp://127.0.0.1:%PORT% .

endlocal
