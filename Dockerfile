# ─────────────────────────────────────────────
#  Aman  v4.0  —  The Nuclear Option
# ─────────────────────────────────────────────

FROM node:20-alpine AS base

# 1. تثبيت حزم النظام 
RUN apk update && apk add --no-cache \
    python3 py3-pip py3-setuptools \
    ttf-freefont fontconfig curl

# 2. تثبيت wkhtmltopdf 
RUN apk add --no-cache wkhtmltopdf \
    --repository http://dl-cdn.alpinelinux.org/alpine/v3.18/community/ \
    && fc-cache -f 2>/dev/null || true

# 3. تثبيت مكتبات بايثون
RUN python3 -m pip install --no-cache-dir --break-system-packages \
    python-docx pdfplumber pypdf reportlab

WORKDIR /app

# 4. الحل الجذري: ننسخ كل شيء أولاً! (لا مجال للهروب الآن يا Docker)
COPY . .

# 5. ندخل لمجلد backend ونثبت الحزم (الملفات موجودة 100% الآن)
RUN cd backend && npm install --quiet

# 6. إعداد الصلاحيات والأمان
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
