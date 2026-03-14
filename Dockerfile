# ─────────────────────────────────────────────
#  Aman  v4.0  —  Final Fixed Version
# ─────────────────────────────────────────────

FROM node:20-alpine AS base

# 1. حل مشكلة wkhtmltopdf و python3
# قمنا بتقسيم التثبيت لضمان استمرار البناء حتى لو واجهت حزمة معينة مشكلة
RUN apk update && apk add --no-cache \
    python3 \
    py3-pip \
    py3-setuptools \
    ttf-freefont \
    fontconfig \
    curl

# تثبيت wkhtmltopdf من مستودع v3.18 (لأنها النسخة المستقرة الوحيدة المتبقية)
RUN apk add --no-cache wkhtmltopdf \
    --repository http://dl-cdn.alpinelinux.org/alpine/v3.18/community/ \
    && fc-cache -f 2>/dev/null || true

# 2. الآن سيجد النظام python3 بالتأكيد
RUN python3 -m pip install --no-cache-dir --break-system-packages \
    python-docx \
    pdfplumber \
    pypdf \
    reportlab

WORKDIR /app

# 3. حل مشكلة الـ COPY (بدون أي رموز تخريبية)
COPY backend/package*.jso[n] ./backend/

RUN if [ -f backend/package.json ]; then \
      cd backend && npm ci --omit=dev --quiet; \
    fi

# 4. نسخ المصدر
COPY backend/ ./backend/
COPY public/  ./public/

# 5. المجلدات والمستخدم
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
