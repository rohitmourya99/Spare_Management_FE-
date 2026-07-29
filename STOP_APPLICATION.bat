@echo off
TITLE Stop Spare IMS - Proactive Data Systems
COLOR 0C
cls

echo =======================================================================
echo              STOPPING SPARE INVENTORY MANAGEMENT SYSTEM
echo =======================================================================
echo.

echo Stopping Node.js server processes...
taskkill /F /IM node.exe /T 2>nul

echo.
echo =======================================================================
echo                    SYSTEM STOPPED SUCCESSFULLY
echo =======================================================================
echo.
pause
