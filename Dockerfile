# ─────────────────────────────────────────────
#  Aman  v4.0  —  Production Docker Image
# ─────────────────────────────────────────────

FROM node:20-alpine AS base

# تثبيت الحزم النظامية: Python، أدوات PDF، الخطوط، و curl
RUN apk add --no-cache \
    python3 \
    py3-pip \
    py3-setuptools \
    wkhtmltopdf \
    ttf-freefont \
    fontconfig \
    curl \
    && fc-cache -f 2>/dev/null || true

# ── تثبيت حزم Python قبل وقت التشغيل ──
# تم استخدام python3 -m pip لضمان عدم ظهور خطأ "pip3 not found"
RUN python3 -m pip install --no-cache-dir --break-system-packages \
    python-docx \
    pdfplumber \
    pypdf \
    reportlab

WORKDIR /app

# ── تثبيت اعتماديات Node (طريقة آمنة واختيارية) ──
# استخدام [n] يمنع Docker من التوقف إذا لم يجد الملف
COPY backend/package*.jso[n] ./backend/

RUN if [ -f backend/package.json ]; then \
      cd backend && npm ci --omit=dev --quiet; \
    fi

# ── نسخ ملفات المشروع ──
COPY backend/ ./backend/
COPY public/  ./public/

# ── إنشاء مجلد البيانات ──
RUN mkdir -p /app/data

# ── إعداد مستخدم غير جذر (Non-root) للأمان ──
RUN addgroup -S aman && adduser -S aman -G aman \
    && chown -R aman:aman /app
USER aman

EXPOSE 3000

# ── فحص حالة التطبيق (Healthcheck) ──
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -fsS http://localhost:3000/api/health || exit 1

# إعدادات البيئة
ENV PORT=3000 \
    NODE_ENV=production \
    DATA_DIR=/app/data \
    PYTHONIOENCODING=utf-8

# أمر التشغيل النهائي
CMD ["node", "backend/server.js"]
