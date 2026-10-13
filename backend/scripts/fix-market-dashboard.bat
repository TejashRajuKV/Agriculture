@echo off
echo 🚀 Starting AgriLoop 2.0 - Market Dashboard Fix
echo.

echo 📋 Checking if data exists in MongoDB...
node check-database.js
echo.

echo 🔧 Starting backend server (MongoDB API)...
start "AgriLoop Backend" cmd /k "npm run server"

echo ⏳ Waiting for server to start...
timeout /t 5 /nobreak > nul

echo 🧪 Testing API endpoints...
node test-api-endpoints.js
echo.

echo 🌐 Starting frontend...
start "AgriLoop Frontend" cmd /k "npm run dev"

echo.
echo ✅ Setup complete!
echo 📊 Backend API: http://localhost:5000
echo 🌐 Frontend: http://localhost:5174
echo 📈 Market Dashboard should now work!
echo.
pause