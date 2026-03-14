#!/bin/bash
echo ""
echo "  🛡️  Aman - File and Text Translator"
echo "  ════════════════════════════════════"

command -v node >/dev/null 2>&1 || { echo "ERROR: Node.js not found. Install: https://nodejs.org"; exit 1; }
echo "  ✅ Node.js: $(node --version)"

PY=""
command -v python3 >/dev/null 2>&1 && PY="python3" || command -v python >/dev/null 2>&1 && PY="python"
[ -z "$PY" ] && { echo "ERROR: Python not found. Install: https://python.org"; exit 1; }
echo "  ✅ Python: $($PY --version)"

# Only install if missing (fast check)
$PY -c "import docx, pdfplumber, pypdf, reportlab" 2>/dev/null
if [ $? -ne 0 ]; then
  echo "  📦 Installing missing Python libraries..."
  $PY -m pip install --quiet python-docx pdfplumber pypdf reportlab 2>/dev/null || \
  $PY -m pip install --quiet --break-system-packages python-docx pdfplumber pypdf reportlab 2>/dev/null
fi
echo "  ✅ Python libraries OK"

command -v wkhtmltopdf >/dev/null 2>&1 \
  && echo "  ✅ wkhtmltopdf: $(wkhtmltopdf --version 2>&1 | head -1)" \
  || echo "  ⚠️  wkhtmltopdf not found (Arabic PDF will use fallback)"
echo ""
echo "  🌐 http://localhost:3000"
echo "  🔐 http://localhost:3000/admin"
echo "  ════════════════════════════════════"
echo ""
cd "$(dirname "$0")/backend"
node server.js
