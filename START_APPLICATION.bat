@echo off
TITLE Enterprise Spare IMS Launcher - Proactive Data Systems
COLOR 0A
cls

:: Ensure Node.js in PATH
set PATH=C:\Program Files\nodejs;%PATH%

echo =======================================================================
echo          ENTERPRISE SPARE INVENTORY MANAGEMENT SYSTEM
echo                  Proactive Data Systems Pvt. Ltd.
echo =======================================================================
echo.

:: 1. Check for Node.js
where node.exe >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is NOT found.
    echo Please install Node.js LTS from https://nodejs.org/
    pause
    exit /b 1
)

echo [1/4] Node.js Version:
call node -v

:: 2. Ensure environment files exist
if not exist "backend\.env" (
    copy "backend\.env.example" "backend\.env" >nul
)
if not exist "frontend\.env" (
    copy "frontend\.env.example" "frontend\.env" >nul
)

:: 3. Install backend node_modules if missing
if not exist "backend\node_modules" (
    echo [2/4] Installing Backend Dependencies...
    cd backend
    call npm.cmd install --loglevel=error
    cd ..
)

:: 4. Install frontend node_modules if missing
if not exist "frontend\node_modules" (
    echo [3/4] Installing Frontend Dependencies...
    cd frontend
    call npm.cmd install --loglevel=error
    cd ..
)

:: 5. Push DB schema & seed users
echo [4/4] Syncing Database & Seeding Users...
cd backend
call npx.cmd prisma db push --skip-generate >nul 2>&1
call npx.cmd prisma db seed >nul 2>&1
cd ..

echo.
echo =======================================================================
echo                 APPLICATION LAUNCHED SUCCESSFULLY!
echo =======================================================================
echo.
echo Web App URL: http://localhost:5173
echo.
echo Default Credentials:
echo   Super Admin : admin@proactivedata.in  / Password: Admin@123
echo   Inv Admin   : inventory@proactivedata.in / Password: Inv@123
echo   Engineer    : engineer@proactivedata.in  / Password: Eng@123
echo.
echo Launching Servers & Opening Browser...
start "Spare IMS Backend API" /min cmd /c "set PATH=C:\Program Files\nodejs;%%PATH%% && cd backend && npm.cmd run dev"
start "Spare IMS Frontend Web" /min cmd /c "set PATH=C:\Program Files\nodejs;%%PATH%% && cd frontend && npm.cmd run dev"

timeout /t 4 >nul
start http://localhost:5173

pause
