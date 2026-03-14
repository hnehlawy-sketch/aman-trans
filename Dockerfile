# ─────────────────────────────────────────────
#  Aman  v4.0  —  Production Stable UI
# ─────────────────────────────────────────────

FROM node:20-alpine AS base

# 1. تثبيت حزم النظام (تقسيمها لضمان عدم فشل بايثون)
RUN apk update && apk add --no-cache \
    python3 \
    py3-pip \
    py3-setuptools \
    ttf-freefont \
    fontconfig \
    curl

# تثبيت wkhtmltopdf من مستودع v3.18 لضمان وجوده
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

# 3. تثبيت اعتماديات Node وبناء ملفات التنسيق (ضروري لإصلاح شكل الواجهة)
COPY package*.json ./
COPY backend/package*.json ./backend/

# تثبيت الحزم وعمل Build للتنسيقات (Tailwind/CSS)
RUN npm install && \
    if [ -f backend/package.json ]; then cd backend && npm install; fi

# 4. نسخ بقية ملفات المشروع
COPY . .

# إذا كان مشروعك يحتاج بناء (مثل React/Next.js/Tailwind)
RUN npm run build --if-present

# 5. إعدادات المجلدات والمستخدم
RUN mkdir -p /app/data && \
    addgroup -S aman && adduser -S aman -G aman && \
    chown -R aman:aman /app

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
