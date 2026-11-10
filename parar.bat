@echo off
chcp 65001 >nul
title Parar Inventario Robotica
cd /d "%~dp0"

echo Desligando o banco de dados...
call npm run db:stop
echo.
echo Pronto. Se a janela do site ainda estiver aberta, feche-a.
pause
