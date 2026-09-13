@echo off
setlocal
cd /d "%~dp0"
"%~dp0tools\node.exe" "%~dp0scripts\serve.mjs" --dist --dist-dir site --port 8090 --open
if not errorlevel 1 exit /b 0
echo Game server did not start. The error is shown above.
pause
