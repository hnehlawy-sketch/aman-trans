# ─────────────────────────────────────────────
#  Aman  v4.0  —  Docker Image
#  Multi-stage: Python deps + Node server
#  Usage:
#    docker build -t aman .
#    docker run -p 3000:3000 -v $(pwd)/data:/app/backend/data aman
# ─────────────────────────────────────────────

FROM node:20-alpine AS base

# Install Python + system deps for PDF processing
RUN apk add --no-cache \
    python3 py3-pip \
    wkhtmltopdf \
    ttf-freefont \
    msttcorefonts-installer \
    fontconfig \
    && update-ms-fonts \
    && fc-cache -f 2>/dev/null || true

# Install Python packages
RUN pip3 install --break-system-packages --no-cache-dir \
    python-docx \
    pdfplumber \
    pypdf \
    reportlab

WORKDIR /app

# Copy backend
COPY backend/ ./backend/

# Copy public (frontend)
COPY public/ ./public/

# Data directory (mounted as volume in production)
RUN mkdir -p /app/backend/data

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

# Environment
ENV PORT=3000 \
    NODE_ENV=production \
    PYTHONIOENCODING=utf-8

# Start
CMD ["node", "backend/server.js"]
