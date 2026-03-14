# ─────────────────────────────────────────────
#  Aman  v4.0  —  Production Docker Image
#  All dependencies pre-installed at build time
#  No runtime pip installs
# ─────────────────────────────────────────────

FROM node:20-alpine AS base

# System deps: Python, PDF tools, fonts, curl for healthcheck
RUN apk add --no-cache \
    python3 \
    py3-pip \
    py3-setuptools \
    wkhtmltopdf \
    ttf-freefont \
    fontconfig \
    curl \
    && fc-cache -f 2>/dev/null || true

# ── Pre-install Python packages at build time (NOT at runtime) ──
# This is the correct way — avoids runtime pip install
RUN python3 install --no-cache-dir --break-system-packages \
    python-docx \
    pdfplumber \
    pypdf \
    reportlab

WORKDIR /app

# ── Install Node deps if package.json exists ──
COPY backend/package*.json ./backend/ 2>/dev/null || true
RUN if [ -f backend/package.json ]; then \
      cd backend && npm ci --omit=dev --quiet; \
    fi

# ── Copy source ──
COPY backend/ ./backend/
COPY public/  ./public/

# ── Data directory (mount as volume in production) ──
RUN mkdir -p /app/data

# ── Non-root user for security ──
RUN addgroup -S aman && adduser -S aman -G aman \
    && chown -R aman:aman /app
USER aman

EXPOSE 3000

# ── Healthcheck using curl (pre-installed above) ──
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -fsS http://localhost:3000/api/health || exit 1

ENV PORT=3000 \
    NODE_ENV=production \
    DATA_DIR=/app/data \
    PYTHONIOENCODING=utf-8

CMD ["node", "backend/server.js"]
