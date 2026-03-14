# ─────────────────────────────────────────────
#  Aman  v4.0  —  Final Stable UI
# ─────────────────────────────────────────────

FROM node:20-alpine AS base

# 1. تثبيت حزم النظام
RUN apk update && apk add --no-cache \
    python3 \
    py3-pip \
    py3-setuptools \
    ttf-freefont \
    fontconfig \
    curl

# تثبيت wkhtmltopdf
RUN apk add --no-cache wkhtmltopdf \
    --repository http://dl-cdn.alpinelinux.org/alpine/v3.18/community/ \
    && fc-cache -f 2>/dev/null || true

# 2. تثبيت مكتبات Python
RUN python3 -m pip install --no-cache-dir --break-system-packages \
    python-docx \
    pdfplumber \
    pypdf \
    reportlab

WORKDIR /app

# 3. تثبيت اعتماديات Node (إصلاح مسار المجلد)
# ننشئ المجلد يدوياً لضمان وجوده
RUN mkdir -p backend

# ننسخ الملفات مباشرة داخل المجلد
COPY backend/package*.json ./backend/

# ننفذ التثبيت باستخدام --prefix بدلاً من cd، وهي طريقة أضمن في Docker
RUN npm install --prefix backend --quiet

# 4. نسخ بقية الملفات
COPY backend/ ./backend/
COPY public/  ./public/

# 5. إعدادات المجلدات والمستخدم
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
