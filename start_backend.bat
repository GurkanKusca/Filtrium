@echo off
title Twitter AI Filter Backend
color 0E
echo.
echo      /^\/^\
echo    _│ O  O │_      FILTRIUM AI
echo   (==  ^T  ==)     Local Content Filter
echo    \   U  /      
echo     \____/
echo.
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


