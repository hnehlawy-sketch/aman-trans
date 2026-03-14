# ─────────────────────────────────────────────
#  Aman  v4.0  —  Stable UI Fixed
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

# 3. تثبيت اعتماديات Node داخل مجلد backend حصراً
# ننسخ ملفات الـ package من مجلد backend إلى داخل الحاوية في نفس المسار
COPY backend/package*.json ./backend/

# ندخل لمجلد backend ونثبت الحزم
RUN cd backend && npm install --quiet

# 4. نسخ بقية ملفات المشروع (تأكد أن المجلدات موجودة محلياً)
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

# تشغيل السيرفر من المسار الصحيح
CMD ["node", "backend/server.js"]
