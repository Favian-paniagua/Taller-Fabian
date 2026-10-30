@echo off
chcp 65001 >nul
title Actualizar el sistema del taller
cd /d "%~dp0\.."

echo.
echo  Actualizando el sistema del taller...
echo  Primero cierra la ventana "Sistema del Taller" si está abierta.
echo.
pause

rem Copia de seguridad antes de actualizar
if exist "server\data\taller.db" (
  if not exist "server\data\copias" mkdir "server\data\copias"
  copy /y "server\data\taller.db" "server\data\copias\antes-de-actualizar.db" >nul
)

git pull || goto error
call npm install || goto error
call npm run build || goto error

echo.
echo  Listo. Abre "iniciar.bat" para encender el sistema con la versión nueva.
pause
exit /b 0

:error
echo.
echo  No se pudo actualizar. El sistema anterior sigue funcionando: abre "iniciar.bat".
pause
exit /b 1
