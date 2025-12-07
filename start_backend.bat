@echo off
title Twitter AI Filter Backend
color 0A
echo ===================================================
echo      Filtrium is Starting
echo ===================================================
echo.
echo [1/2] checking for libraries
echo    
echo.
pip install -r requirements.txt
echo.
echo [2/2] 
echo.
echo    Status: READY!
echo    Please DON'T close this Window !
echo.
echo ===================================================
python api.py
pause


