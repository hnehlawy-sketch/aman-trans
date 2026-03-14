# ─────────────────────────────────────────────
#  Aman  v4.0  —  Production Docker Image
# ─────────────────────────────────────────────

FROM node:20-alpine AS base

# 1. تثبيت الحزم (أضفنا تحديث المستودعات لضمان عدم ضياع أي حزمة مثل python أو wkhtmltopdf)
RUN apk update && apk add --no-cache \
    python3 \
    py3-pip \
    py3-setuptools \
    wkhtmltopdf \
    ttf-freefont \
    fontconfig \
    curl \
    && fc-cache -f 2>/dev/null || true

# 2. تثبيت مكتبات Python
# استخدمنا python3 -m pip لأنها النسخة الأكثر استقراراً في Alpine لضمان إيجاد الأمر
RUN python3 -m pip install --no-cache-dir --break-system-packages \
    python-docx \
    pdfplumber \
    pypdf \
    reportlab

WORKDIR /app

# 3. تثبيت Node deps (تم إصلاح السطر الذي كان يسبب الخطأ)
# ملاحظة: حذفنا 2>/dev/null || true لأنها لا تعمل في Docker
# واستخدمنا خدعة الـ [n] لجعل الملف اختيارياً كما هو مطلوب
COPY backend/package*.jso[n] ./backend/

RUN if [ -f backend/package.json ]; then \
      cd backend && npm ci --omit=dev --quiet; \
    fi

# 4. نسخ المصدر (باقي الملف كما هو تماماً لضمان استقرار الواجهة)
COPY backend/ ./backend/
COPY public/  ./public/

# 5. المجلدات والمستخدم
RUN mkdir -p /app/data

RUN addgroup -S aman && adduser -S aman -G aman \
    && chown -R aman:aman /app
USER aman

EXPOSE 3000

# 6. الفحص والإعدادات
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -fsS http://localhost:3000/api/health || exit 1

ENV PORT=3000 \
    NODE_ENV=production \
    DATA_DIR=/app/data \
    PYTHONIOENCODING=utf-8

CMD ["node", "backend/server.js"]
