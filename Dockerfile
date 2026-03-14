# ─────────────────────────────────────────────
#  Aman  v4.0  —  Final Custom Build
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

# 4. تثبيت حزم الـ Node.js (الخاصة بالـ backend فقط كما في صورتك)
# نستخدم خدعة الـ [n] الآمنة جداً في Docker بدلاً من 2>/dev/null
COPY backend/package*.jso[n] ./backend/

# الدخول لمجلد backend وتثبيت الحزم
RUN cd backend && npm install --quiet

# 5. نسخ كل ملفات المشروع (public, worker, backend) دفعة واحدة
COPY . .

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
