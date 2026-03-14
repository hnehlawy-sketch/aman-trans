# استخدام نسخة Node.js مستقرة وخفيفة
FROM node:18-slim

# تثبيت متطلبات النظام (بايثون + أدوات الـ PDF + الخطوط العربية)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    wkhtmltopdf \
    libxrender1 \
    libfontconfig1 \
    libxext6 \
    fonts-liberation \
    fonts-noto-core \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

# تحديد مسار العمل داخل الحاوية
WORKDIR /app

# نسخ ملفات المشروع بالكامل
COPY . .

# تثبيت مكتبات بايثون المطلوبة (بناءً على متطلبات v4.0)
RUN pip3 install --no-cache-dir --break-system-packages \
    python-docx \
    pdfplumber \
    pypdf \
    reportlab

# إعداد المتغيرات البيئية (جوجل كلاود يستخدم المنفذ 8080 افتراضياً)
ENV PORT=8080
ENV NODE_ENV=production
EXPOSE 8080

# أمر تشغيل السيرفر (تأكد أن المسار لـ server.js صحيح)
CMD ["node", "backend/server.js"]