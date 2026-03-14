# ─────────────────────────────────────────────
#  Aman  v5.0  —  The "Finally Fixed" Build
# ─────────────────────────────────────────────

FROM node:20-alpine AS base

# 1. حزم النظام الأساسية
RUN apk update && apk add --no-cache \
    python3 py3-pip py3-setuptools \
    ttf-freefont fontconfig curl

# 2. تثبيت wkhtmltopdf المستقر
RUN apk add --no-cache wkhtmltopdf \
    --repository http://dl-cdn.alpinelinux.org/alpine/v3.18/community/ \
    && fc-cache -f 2>/dev/null || true

# 3. مكتبات بايثون
RUN python3 -m pip install --no-cache-dir --break-system-packages \
    python-docx pdfplumber pypdf reportlab

WORKDIR /app

# 4. نسخ الملفات (الآن ستنتقل الملفات لأننا عدلنا .dockerignore)
COPY . .

# 5. تثبيت الحزم (بما أنك تملك مجلد backend فقط)
RUN cd backend && npm install --quiet

# 6. الصلاحيات
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
