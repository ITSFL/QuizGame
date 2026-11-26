@echo off
REM Copyright 2026 by Florian Lohkamp
REM Lizenz: GNU GPL v3, siehe LIZENZ_DE_GNU_GPL_v3.md im Projektordner
REM Startet einen lokalen HTTP-Server fuer das QuizGame (Ordner "game\") unter Windows.
REM Notwendig, weil Chrome das Laden der Kartendecks per fetch() blockiert,
REM wenn die Seite direkt als Datei (file://) geoeffnet wird.
REM
REM Verwendung: start-server.bat [Port]
REM Danach im Browser aufrufen: http://localhost:<Port>

setlocal
set "PORT=%~1"
if "%PORT%"=="" set "PORT=8000"

cd /d "%~dp0" || exit /b 1

start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:%PORT%"

where py >nul 2>nul
if %errorlevel%==0 (
    py -3 server.py %PORT%
    goto :end
)

where python >nul 2>nul
if %errorlevel%==0 (
    python server.py %PORT%
    goto :end
)

echo Python wurde nicht gefunden. Bitte Python von https://python.org installieren.
pause

:end
endlocal
