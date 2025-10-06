@echo off
echo ===============================================
echo AQI Route App - ApacheBench Performance Tests
echo ===============================================
echo.

REM Set ApacheBench path
set AB_PATH=D:\xampp\apache\bin\ab.exe

REM Test parameters
set REQUESTS=50
set CONCURRENCY=1

echo Testing Main Application Page...
echo ----------------------------------------
%AB_PATH% -n %REQUESTS% -c %CONCURRENCY% http://localhost:5173/
echo.

echo Testing Main Page with Keep-Alive...
echo ----------------------------------------
%AB_PATH% -n %REQUESTS% -c %CONCURRENCY% -k http://localhost:5173/
echo.

echo Testing Main Page with Higher Concurrency...
echo ----------------------------------------
%AB_PATH% -n %REQUESTS% -c 5 http://localhost:5173/
echo.

echo Testing Main Page with More Requests...
echo ----------------------------------------
%AB_PATH% -n 100 -c %CONCURRENCY% http://localhost:5173/
echo.

echo Testing Static Assets (if available)...
echo ----------------------------------------
%AB_PATH% -n %REQUESTS% -c %CONCURRENCY% http://localhost:5173/src/main.jsx
echo.

%AB_PATH% -n %REQUESTS% -c %CONCURRENCY% http://localhost:5173/style.css
echo.

echo Testing External API Endpoints...
echo ----------------------------------------
echo Testing OpenWeather AQI API (using demo coordinates)...
%AB_PATH% -n 10 -c 1 "https://api.openweathermap.org/data/2.5/air_pollution?lat=18.5204&lon=73.8567&appid=cc89ee52f5cdf7cd8a3915cba042774f"
echo.

echo ===============================================
echo All tests completed!
echo ===============================================
pause
