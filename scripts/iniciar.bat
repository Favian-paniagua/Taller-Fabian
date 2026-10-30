@echo off
chcp 65001 >nul
title Sistema del Taller (no cerrar esta ventana)
cd /d "%~dp0\.."

if not exist "server\dist\index.js" (
  echo  Primero hay que instalar el sistema: abre "instalar.bat".
  pause
  exit /b 1
)

echo.
echo  Encendiendo el sistema del taller...
echo  Deja esta ventana abierta (puedes minimizarla). Si la cierras, el sistema se apaga.
echo.

rem Abre el navegador unos segundos después, cuando el sistema ya está listo
start "" cmd /c "timeout /t 4 >nul & start http://localhost:3000"

call npm start
pause
