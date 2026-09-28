@echo off
title SMM Bot Engine v1.0.0
echo ========================================================
echo          SMM Bot Engine v1.0.0 - Local Runner
echo ========================================================
echo.
echo [1/2] Membuka Dashboard di Browser...
start http://localhost:3000
echo [2/2] Menyalakan server Node.js...
echo.
echo Dashboard aktif di: http://localhost:3000
echo Tekan CTRL + C di jendela ini untuk mematikan server.
echo ========================================================
echo.
npm start
pause
