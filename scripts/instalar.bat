@echo off
chcp 65001 >nul
title Instalar el sistema del taller
cd /d "%~dp0\.."

echo.
echo  Instalando el sistema del Taller Mecánico Fabián...
echo  (la primera vez tarda unos minutos y necesita internet)
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo  No se encontró Node.js. Instálalo desde https://nodejs.org (versión LTS) y vuelve a abrir este archivo.
  pause
  exit /b 1
)

call npm install || goto error
call npm run build || goto error

echo.
echo  Listo. Para encender el sistema abre "iniciar.bat".
echo.
pause
exit /b 0

:error
echo.
echo  Algo salió mal durante la instalación. Revisa la conexión a internet y vuelve a intentar.
echo  Si se repite, envía una foto de esta ventana a quien te dio soporte.
pause
exit /b 1
