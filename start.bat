@echo off
echo.
echo  Aman - File and Text Translator
echo  ================================
echo.

echo [1/4] Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
  echo  ERROR: Node.js not found!
  echo  Download from: https://nodejs.org
  pause & exit /b 1
)
echo  Node.js OK

echo [2/4] Checking Python...
python --version >nul 2>&1
if errorlevel 1 (
  echo  ERROR: Python not found!
  echo  Download from: https://python.org
  pause & exit /b 1
)
echo  Python OK

echo [3/4] Installing Python libraries...
python -m pip install --quiet python-docx pdfplumber pypdf reportlab
echo  Libraries OK

echo [4/4] Checking wkhtmltopdf (for Arabic PDF support)...
wkhtmltopdf --version >nul 2>&1
if errorlevel 1 (
  echo  NOTE: wkhtmltopdf not found - Arabic PDF may show boxes
  echo  For perfect Arabic PDF support, download from:
  echo  https://wkhtmltopdf.org/downloads.html
) else (
  echo  wkhtmltopdf OK - Arabic PDF support enabled!
)

echo.
echo  ================================
echo  Open browser at:
echo  http://localhost:3000
echo  http://localhost:3000/app
echo  http://localhost:3000/pricing
echo  http://localhost:3000/admin
echo  ================================
echo  Admin: admin@aman.app / Admin@1234
echo.

cd backend
node server.js
pause
