@echo off
chcp 65001 >nul
title Inventario Robotica
cd /d "%~dp0"

echo ============================================
echo   Inventario Robotica - abrindo o sistema
echo ============================================
echo.

rem 1) Docker precisa estar aberto
docker info >nul 2>&1
if not errorlevel 1 goto docker_pronto

echo O Docker Desktop nao esta rodando. Abrindo...
if exist "%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe" (
  start "" "%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe"
  goto espera_docker
)
if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" (
  start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
  goto espera_docker
)
echo Nao encontrei o Docker Desktop. Abra-o pelo menu Iniciar e rode este arquivo de novo.
pause
exit /b 1

:espera_docker
echo Esperando o Docker ficar pronto, pode levar ate 2 minutos...
:laco_docker
timeout /t 5 /nobreak >nul
docker info >nul 2>&1
if errorlevel 1 goto laco_docker

:docker_pronto
echo Docker pronto.
echo.

rem 2) Banco de dados (Supabase local)
echo Subindo o banco de dados...
call npm run db:start
if errorlevel 1 (
  echo.
  echo Nao foi possivel subir o banco. Veja a mensagem acima.
  pause
  exit /b 1
)
echo.

rem 3) Abre o navegador quando o site estiver no ar
start "" /min powershell -NoProfile -Command "for ($i=0; $i -lt 90; $i++) { try { Invoke-WebRequest http://localhost:3000/entrar -UseBasicParsing -TimeoutSec 3 | Out-Null; Start-Process 'http://localhost:3000/entrar'; break } catch { Start-Sleep 2 } }"

rem 4) Site (esta janela precisa ficar aberta)
echo Subindo o site. Deixe esta janela aberta.
echo Para desligar: feche esta janela (ou Ctrl+C) e rode parar.bat
echo.
echo Entrar com:  prof@escola.local   senha: Teste@12345
echo.
call npm run dev
pause
