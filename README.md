# 🛡️ أمان للملفات والنصوص  v3.0

> مترجم ذكي مدعوم بـ Google Gemini AI — SaaS كامل

---

## 📁 الملفات

```
aman-final/
├── backend/
│   ├── server.js          ← الخادم الكامل (Node.js، بدون npm)
│   ├── extract_text.py    ← استخراج نص من PDF/DOCX
│   └── rebuild_doc.py     ← إعادة بناء PDF بالعربي (يدعم RTL)
├── public/
│   ├── index.html         ← الصفحة الرئيسية
│   ├── app.html           ← واجهة المستخدم (ترجمة + ملف شخصي + تاريخ)
│   ├── admin.html         ← لوحة الإدارة الكاملة
│   ├── pricing.html       ← صفحة الخطط والأسعار
│   └── 404.html           ← صفحة 404
├── start.bat              ← تشغيل Windows
├── start.sh               ← تشغيل Linux/Mac
└── README.md
```

> ⚠️ لا ترفع `data.json` على GitHub — يحتوي على كلمات مرور مشفرة وبيانات المستخدمين.

---

## 🚀 التشغيل

**Windows:** انقر مرتين على `start.bat`

**Linux/Mac:**
```bash
chmod +x start.sh && ./start.sh
```

**يدوياً:**
```bash
pip install python-docx pdfplumber pypdf reportlab
cd backend && node server.js
```

---

## 🌐 الروابط

| الصفحة | الرابط |
|--------|--------|
| الرئيسية | http://localhost:3000 |
| التطبيق | http://localhost:3000/app |
| الأسعار | http://localhost:3000/pricing |
| الإدارة | http://localhost:3000/admin |

**بيانات الأدمن الافتراضية:** `admin@aman.app` / `Admin@1234`
⚠️ **غيّر كلمة المرور فوراً من لوحة الإدارة!**

---

## ✨ المميزات الكاملة (v3.0)

### للمستخدمين
- تسجيل دخول + "تذكرني 30 يوم"
- ترجمة نصوص وملفات (PDF, DOCX, TXT, MD, HTML, JSON, CSV...)
- PDF عربي صحيح بدون مربعات (يحتاج wkhtmltopdf)
- سجل الترجمات السابقة
- ملف شخصي (تغيير الاسم + كلمة المرور)
- إلغاء مهمة جارية
- معاينة النص المترجم

### للمدير
- إحصائيات شاملة
- إدارة مفتاح Gemini API واختيار النموذج
- إدارة المستخدمين (ترقية، حذف، تغيير كلمة المرور)
- تصدير المستخدمين CSV
- إدارة الخطط والأسعار
- إدارة طرق الدفع (محفظة QR، بنك، PayPal)
- نظام إشعارات الدفع + موافقة/رفض
- سجل النشاط الكامل
- Rate limiting تلقائي

---

## 🔒 الأمان

- PBKDF2 × 100,000 لكلمات المرور
- قفل الحساب بعد 5 محاولات خاطئة
- Rate limit: 120 طلب/دقيقة لكل IP
- Rate limit: 20 ترجمة/دقيقة لكل مستخدم
- جلسات مشفرة تنتهي تلقائياً
- مفتاح API مقنع دائماً

---

## 📋 متطلبات

- **Node.js** 18+
- **Python** 3.8+
- **wkhtmltopdf** (اختياري — لـ PDF عربي مثالي) من: https://wkhtmltopdf.org
