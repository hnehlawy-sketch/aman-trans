# ─────────────────────────────────────────────
#  Aman  v4.0  —  Universal Build
# ─────────────────────────────────────────────

FROM node:20-alpine AS base

# 1. تثبيت حزم النظام (بايثون وخطوط الواجهة)
RUN apk update && apk add --no-cache \
    python3 py3-pip py3-setuptools \
    ttf-freefont fontconfig curl

# تثبيت wkhtmltopdf من مستودع مستقر
RUN apk add --no-cache wkhtmltopdf \
    --repository http://dl-cdn.alpinelinux.org/alpine/v3.18/community/ \
    && fc-cache -f 2>/dev/null || true

# 2. تثبيت مكتبات Python
RUN python3 -m pip install --no-cache-dir --break-system-packages \
    python-docx pdfplumber pypdf reportlab

WORKDIR /app

# 3. نسخ كل ملفات الـ package الموجودة في أي مكان
# ننسخ كل شيء يبدأ بـ package وينتهي بـ json في المجلد الرئيسي أو الفرعي
COPY package*.json ./
COPY backend/package*.json ./backend/ 2>/dev/null || true

# 4. تثبيت الحزم (أمر ذكي: يجرب تثبيت الرئيسي ثم الفرعي)
RUN if [ -f package.json ]; then npm install --quiet; fi && \
    if [ -f backend/package.json ]; then npm install --prefix backend --quiet; fi

# 5. نسخ بقية المشروع
COPY . .

# 6. بناء الواجهة (لإصلاح مشكلة عرض الجوال)
RUN npm run build --if-present

# 7. الإعدادات الأمنية والمجلدات
RUN mkdir -p /app/data && \
    addgroup -S aman && adduser -S aman -G aman && \
    chown -R aman:aman /app

USER aman
EXPOSE 3000

ENV PORT=3000 \
    NODE_ENV=production \
    DATA_DIR=/app/data \
    PYTHONIOENCODING=utf-8

# تشغيل السيرفر (يجرب المسارين الأكثر احتمالاً)
CMD ["sh", "-c", "if [ -f backend/server.js ]; then node backend/server.js; else node server.js; fi"]
