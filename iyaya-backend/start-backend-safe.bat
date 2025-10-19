@echo off
echo Starting Iyaya Backend Server...

cd /d "c:\Users\reycel\iYayaAll2\iyayav0CleanStart todeepseek\iyaya-backend"

echo Checking for missing dependencies...

:: Check if joi is installed
npm list joi >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing joi...
    npm install joi
)

:: Check if firebase-admin is installed
npm list firebase-admin >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing firebase-admin...
    npm install firebase-admin
)

:: Check if socket.io is installed
npm list socket.io >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing socket.io...
    npm install socket.io
)

echo Starting server...
npm run server

pause