# ⚡ Aman AI Worker — Deno Deploy

وسيط بين خادم Aman و Google Gemini API.
يتجاوز الحظر الجغرافي على generativelanguage.googleapis.com في بعض الدول.

## النشر (مجاني 100%)

### الطريقة الأسهل: Dashboard
1. https://dash.deno.com → New Project
2. Deploy from URL أو GitHub
3. ارفع ملف `worker.ts`
4. أضف Environment Variable:
   - Key: `AMAN_SECRET`
   - Value: أي نص سري طويل (مثل: `my-secret-key-123abc`)
5. انسخ رابط الـ Worker مثل: `https://your-worker.deno.dev`

### إعداد في لوحة الإدارة
1. افتح `/admin` → ⚡ Worker AI
2. الصق رابط Deno Worker
3. أدخل نفس قيمة `AMAN_SECRET`
4. فعّل الـ Worker
5. اضغط "اختبار الاتصال"

## الحدود المجانية
- 100,000 طلب/يوم
- بدون timeout مشاكل (أسرع من الاتصال المباشر)
