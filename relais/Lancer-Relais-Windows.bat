@echo off
rem Lance Relais sur un PC Windows : double-cliquez sur ce fichier.
rem La premiere fois, il installe et prepare l'application, puis il ouvre le navigateur.
setlocal
title Relais
cd /d "%~dp0"

echo.
echo  ======================================
echo   RELAIS - lancement sur ce PC
echo  ======================================
echo.

where node >nul 2>nul
if errorlevel 1 goto :pas_de_node

node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)"
if errorlevel 1 goto :node_trop_ancien

if exist node_modules goto :deja_installe
echo Premiere utilisation : installation, 2 a 5 minutes selon la connexion...
echo.
call npm ci
if errorlevel 1 goto :erreur
:deja_installe

if exist .next\BUILD_ID goto :deja_prepare
echo.
echo Preparation de l'application, 1 a 3 minutes...
echo.
call npm run build
if errorlevel 1 goto :erreur
:deja_prepare

echo.
echo Relais demarre. Le navigateur va s'ouvrir tout seul sur http://localhost:3100
echo.
echo Pour essayer l'application chauffeur sur un telephone branche sur le meme Wi-Fi,
echo tapez dans son navigateur http://ADRESSE:3100 en remplacant ADRESSE par celle-ci :
ipconfig | findstr /c:"IPv4"
echo.
echo Laissez cette fenetre ouverte pendant l'utilisation. Fermez-la pour arreter Relais.
echo.

start "" powershell -NoProfile -WindowStyle Hidden -Command "for ($i = 0; $i -lt 90; $i++) { try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://localhost:3100/connexion | Out-Null; Start-Process 'http://localhost:3100'; break } catch { Start-Sleep -Seconds 1 } }"

set RELAIS_COOKIE_SECURE=0
call npm start
echo.
echo Relais s'est arrete.
pause
exit /b 0

:pas_de_node
echo Node.js n'est pas installe sur cet ordinateur. Il est necessaire pour faire tourner Relais.
echo.
echo  1. Sur la page qui s'ouvre, telechargez la version LTS et installez-la
echo     en gardant les choix proposes.
echo  2. Relancez ensuite ce fichier.
echo.
start "" https://nodejs.org/fr/download
pause
exit /b 1

:node_trop_ancien
echo La version de Node.js installee sur ce PC est trop ancienne pour Relais.
echo Installez la version LTS depuis la page qui s'ouvre, puis relancez ce fichier.
echo.
start "" https://nodejs.org/fr/download
pause
exit /b 1

:erreur
echo.
echo Une erreur est survenue pendant l'installation.
echo Faites une capture d'ecran de cette fenetre et envoyez-la.
echo.
pause
exit /b 1
