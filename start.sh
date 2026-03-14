#!/bin/bash
echo ""
echo "  🛡️  أمان للملفات والنصوص"
echo "  ════════════════════════════"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "  ❌ Node.js غير مثبت! حمّله من: https://nodejs.org"
  exit 1
fi
echo "  ✅ Node.js: $(node --version)"

# Check Python
PY=""
if command -v python3 &> /dev/null; then PY="python3"
elif command -v python &> /dev/null; then PY="python"; fi

if [ -z "$PY" ]; then
  echo "  ❌ Python غير مثبت! حمّله من: https://python.org"
  exit 1
fi
echo "  ✅ Python: $($PY --version)"

# Install Python deps
echo "  📦 تثبيت مكتبات Python..."
$PY -m pip install --quiet python-docx pdfplumber pypdf reportlab 2>/dev/null || \
$PY -m pip install --quiet --break-system-packages python-docx pdfplumber pypdf reportlab 2>/dev/null
echo "  ✅ المكتبات جاهزة"

echo ""
echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🌐 http://localhost:3000"
echo "  📱 http://localhost:3000/app"
echo "  🔐 http://localhost:3000/admin"
echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
cd backend
node server.js
