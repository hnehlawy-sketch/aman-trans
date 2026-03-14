# ─────────────────────────────────────────────
#  Aman  v4.0  —  Production Docker Image
# ─────────────────────────────────────────────

FROM node:20-alpine AS base

# 1. تحديث المستودعات وتثبيت الحزم (مع إضافة مستودع community لضمان وجود wkhtmltopdf)
RUN apk add --no-cache \
    python3 \
    py3-pip \
    py3-setuptools \
    # تيفات وأدوات الخطوط
    ttf-freefont \
    fontconfig \
    dbus \
    curl \
    # إضافة wkhtmltopdf من مستودع الـ edge/community إذا لم تكن في الرسمي
    && apk add --no-cache wkhtmltopdf --repository http://dl-cdn.alpinelinux.org/alpine/v3.18/community/ \
    && fc-cache -f 2>/dev/null || true

# 2. تثبيت حزم Python بشكل منفصل لضمان الوضوح
RUN python3 -m pip install --no-cache-dir --break-system-packages \
    python-docx \
    pdfplumber \
    pypdf \
    reportlab

WORKDIR /app

# 3. تثبيت اعتماديات Node (طريقة آمنة واختيارية)
COPY backend/package*.jso[n] ./backend/
RUN if [ -f backend/package.json ]; then \
      cd backend && npm ci --omit=dev --quiet; \
    fi

# 4. نسخ ملفات المشروع
COPY backend/ ./backend/
COPY public/  ./public/

# 5. إعداد المجلدات والمستخدم
RUN mkdir -p /app/data && \
    addgroup -S aman && adduser -S aman -G aman && \
    chown -R aman:aman /app

USER aman
EXPOSE 3000

ENV PORT=3000 \
    NODE_ENV=production \
    DATA_DIR=/app/data \
    PYTHONIOENCODING=utf-8

CMD ["node", "backend/server.js"]
