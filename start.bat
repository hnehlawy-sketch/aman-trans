@echo off
echo.
echo  Aman - File and Text Translator
echo  ================================
echo.

echo [1/4] Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
  echo  ERROR: Node.js not found. Download: https://nodejs.org
  pause & exit /b 1
)
echo  Node.js OK

echo [2/4] Checking Python...
python --version >nul 2>&1
if errorlevel 1 (
  echo  ERROR: Python not found. Download: https://python.org
  pause & exit /b 1
)
echo  Python OK

echo [3/4] Checking Python libraries...
python -c "import docx, pdfplumber, pypdf, reportlab" >nul 2>&1
if errorlevel 1 (
  echo  Installing missing Python libraries...
  python -m pip install --quiet python-docx pdfplumber pypdf reportlab
  echo  Libraries installed.
) else (
  echo  Python libraries OK
)

echo [4/4] Starting server...
echo.
echo  Open: http://localhost:3000
echo  Admin: http://localhost:3000/admin
echo  NOTE: Install wkhtmltopdf for Arabic PDF support
echo  Download: https://wkhtmltopdf.org/downloads.html
echo.
cd backend
node server.js
pause
