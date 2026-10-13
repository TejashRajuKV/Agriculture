@echo off
echo 🚀 Starting AgriLoop 2.0...
echo.

echo 📋 Checking configuration...
node test-config.js

echo.
echo 🔧 Starting backend server...
start "AgriLoop Backend" cmd /k "npm run server"

timeout /t 3 /nobreak > nul

echo 🌐 Starting frontend development server...
start "AgriLoop Frontend" cmd /k "npm run dev"

echo.
echo ✅ Both servers are starting!
echo 📊 Backend: http://localhost:5000
echo 🌐 Frontend: http://localhost:5174
echo.
pause