@echo off
echo Starting iYaya Messaging System Test...

cd /d "c:\Users\reycel\iYayaAll2\iyayav0CleanStart todeepseek\iyaya-backend"

echo.
echo 1. Fixing messaging system setup...
node fix-messaging.js

echo.
echo 2. Testing messaging components...
node test-messaging-simple.js

echo.
echo 3. Starting server for API tests...
echo Please start your server with: npm start
echo Then run: node test-messaging.js

pause