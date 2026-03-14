# ─────────────────────────────────────────────
#  Aman  v4.0  —  Production Docker Image
# ─────────────────────────────────────────────

FROM node:20-alpine AS base

# 1. تثبيت كل شيء في خطوة واحدة لضمان توفر Python و Pip
RUN apk add --no-cache \
    python3 \
    py3-pip \
    py3-setuptools \
    wkhtmltopdf \
    ttf-freefont \
    fontconfig \
    curl \
    && fc-cache -f 2>/dev/null || true \
    && python3 -m pip install --no-cache-dir --break-system-packages \
       python-docx \
       pdfplumber \
       pypdf \
       reportlab

WORKDIR /app

# 2. تثبيت اعتماديات Node (طريقة آمنة واختيارية)
COPY backend/package*.jso[n] ./backend/

RUN if [ -f backend/package.json ]; then \
      cd backend && npm ci --omit=dev --quiet; \
    fi

# 3. نسخ ملفات المشروع
COPY backend/ ./backend/
COPY public/  ./public/

# 4. إعداد المجلدات والمستخدم
RUN mkdir -p /app/data && \
    addgroup -S aman && adduser -S aman -G aman && \
    chown -R aman:aman /app

USER aman

EXPOSE 3000

# 5. فحص الحالة والإعدادات
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -fsS http://localhost:3000/api/health || exit 1

ENV PORT=3000 \
    NODE_ENV=production \
    DATA_DIR=/app/data \
    PYTHONIOENCODING=utf-8

CMD ["node", "backend/server.js"]
