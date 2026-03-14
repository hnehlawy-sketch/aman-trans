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
| الرئيسية | http://localhost:8080 |
| التطبيق | http://localhost:8080/app |
| الأسعار | http://localhost:8080/pricing |
| الإدارة | http://localhost:8080/admin |

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
- **wkhtmltopdf** (اختياري — لـ PDF عربي مثالي) من: https://wkhtmltopdf.org/**
 * ═══════════════════════════════════════════════════════════════
 *   Aman  v4.0  —  Full SaaS Server
 *   Node.js · Zero npm deps
 *   ✓ Auth + Rate-limit + Brute-force protection
 *   ✓ SMTP email (any provider: Gmail, Outlook, custom)
 *   ✓ Firebase Firestore (optional, falls back to data.json)
 *   ✓ Deno/CF Worker proxy for Gemini (bypasses geo-blocks)
 *   ✓ Translation jobs + history + cancel
 *   ✓ Payment notifications + admin approval
 *   ✓ Full admin panel
 * ═══════════════════════════════════════════════════════════════
 */

'use strict';
const http   = require('http');
const https  = require('https');
const net    = require('net');
const url    = require('url');
const path   = require('path');
const fs     = require('fs');
const os     = require('os');
const crypto = require('crypto');
const { execFile } = require('child_process');

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════
const PORT        = process.env.PORT || 8080;
const IS_WIN      = process.platform === 'win32';
const PYTHON      = IS_WIN ? 'python' : 'python3';
const BASE_DIR    = __dirname;
const PUBLIC_DIR  = path.join(BASE_DIR, '..', 'public');
const DATA_FILE   = path.join(BASE_DIR, 'data.json');
const UPLOAD_DIR  = path.join(os.tmpdir(), 'aman_uploads');
const OUTPUT_DIR  = path.join(os.tmpdir(), 'aman_outputs');
const MAX_FILE_B  = 50 * 1024 * 1024;
const CHUNK_CHARS = 3500;
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
const MAX_LOGIN_FAIL  = 5;
const LOCKOUT_MS      = 15 * 60 * 1000;
const RATE_WIN_MS     = 60 * 1000;
const RATE_IP_MAX     = 120;
const RATE_XLAT_MAX   = 20;

[UPLOAD_DIR, OUTPUT_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
const uid    = () => crypto.randomBytes(16).toString('hex');
const tok    = () => crypto.randomBytes(32).toString('hex');
const hash   = (pw, salt) => crypto.pbkdf2Sync(pw, salt, 100000, 64, 'sha512').toString('hex');
const now    = () => Date.now();
const slog   = (...a) => console.log(`[${new Date().toISOString().slice(0,19).replace('T',' ')}]`, ...a);
const sanitizeFilename = n => path.basename(n).replace(/[^\w.\-]/g,'_').slice(0,200);

const CORS = {
  'Access-Control-Allow-Origin' : '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

function json(res, status, data) {
  const b = JSON.stringify(data);
  res.writeHead(status, { ...CORS, 'Content-Type': 'application/json' });
  res.end(b);
}

function serveHTML(res, name) {
  const fp = path.join(PUBLIC_DIR, name);
  if (!fs.existsSync(fp)) {
    const p4 = path.join(PUBLIC_DIR, '404.html');
    res.writeHead(404, { 'Content-Type': 'text/html;charset=utf-8' });
    return (fs.existsSync(p4) ? fs.createReadStream(p4) :
      require('stream').Readable.from(['<h1>404</h1><a href="/">Home</a>'])).pipe(res);
  }
  res.writeHead(200, { ...CORS, 'Content-Type': 'text/html;charset=utf-8' });
  fs.createReadStream(fp).pipe(res);
}

function sendFile(res, fp, dlName, mime = 'application/octet-stream') {
  if (!fs.existsSync(fp)) return json(res, 404, { error: 'File not found' });
  const stat = fs.statSync(fp);
  res.writeHead(200, {
    ...CORS,
    'Content-Type'       : mime,
    'Content-Length'     : stat.size,
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(dlName)}`,
  });
  fs.createReadStream(fp).pipe(res);
}

function readJSON(req) {
  return new Promise((ok, fail) => {
    let s = '';
    req.on('data', c => { s += c; if (s.length > 2e6) { req.destroy(); fail(new Error('Body too large')); } });
    req.on('end',  () => { try { ok(JSON.parse(s || '{}')); } catch { fail(new Error('Bad JSON')); } });
    req.on('error', fail);
  });
}

function getIP(req) {
  return ((req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
    .split(',')[0].trim());
}

// ═══════════════════════════════════════════════════════════════
// RATE LIMITER
// ═══════════════════════════════════════════════════════════════
const _ipWin  = new Map();
const _usrWin = new Map();

function limitIP(req, res) {
  const ip = getIP(req), t = now();
  let w = _ipWin.get(ip);
  if (!w || t > w.r) { w = { c: 0, r: t + RATE_WIN_MS }; _ipWin.set(ip, w); }
  if (++w.c > RATE_IP_MAX) { json(res, 429, { error: 'Too many requests' }); return false; }
  return true;
}
function limitUser(uid, res) {
  const t = now();
  let w = _usrWin.get(uid);
  if (!w || t > w.r) { w = { c: 0, r: t + RATE_WIN_MS }; _usrWin.set(uid, w); }
  if (++w.c > RATE_XLAT_MAX) { json(res, 429, { error: 'Translation rate limit exceeded' }); return false; }
  return true;
}

// ═══════════════════════════════════════════════════════════════
// DATA STORE  (JSON local  OR  Firebase Firestore)
// ═══════════════════════════════════════════════════════════════

// ── Default settings structure ───────────────────────────────
function defaultSettings() {
  return {
    geminiApiKey: '', geminiModel: 'gemini-2.5-flash',
    workerUrl: '', workerSecret: '', useWorker: false,

    smtpHost: '', smtpPort: 587, smtpSecure: false,
    smtpUser: '', smtpPass: '', smtpFrom: '',
    emailOnRegister: true, emailOnPaymentApproved: true,
    emailOnPaymentReceived: true,

    firebaseProject: '', firebaseKey: '', useFirebase: false,

    allowRegistration: true, freePlanEnabled: true,
    freeCharsLimit: 500, freeFilesLimit: 3,
    maxFilesPerJob: 50, maxFileSizeMB: 50,
    plans: [
      { id:'free',       name:'مجاني',   nameEn:'Free',       price:0,     currency:'USD', period:'month', color:'#6b7280',
        features:['500 حرف لكل طلب','3 ملفات لكل مهمة','22 لغة مدعومة','PDF و Word'],
        charsLimit:500, filesLimit:3,   highlighted:false, description:'للاستخدام الشخصي الخفيف' },
      { id:'pro',        name:'احترافي', nameEn:'Pro',        price:9.99,  currency:'USD', period:'month', color:'#c9a84c',
        features:['نصوص غير محدودة','50 ملف لكل مهمة','ملفات حتى 50MB','أولوية بالمعالجة','دعم مباشر'],
        charsLimit:0,   filesLimit:50,  highlighted:true,  description:'للمحترفين والأعمال' },
      { id:'enterprise', name:'مؤسسات', nameEn:'Enterprise', price:49.99, currency:'USD', period:'month', color:'#60a5fa',
        features:['كل ما في Pro','مستخدمون غير محدودين','API مخصص','تقارير استخدام','SLA مضمون'],
        charsLimit:0,   filesLimit:200, highlighted:false, description:'للفرق والشركات الكبيرة' },
    ],
    paymentMethods: [],
  };
}

// ── Local JSON store ──────────────────────────────────────────
function initLocal() {
  const salt = crypto.randomBytes(16).toString('hex');
  const id   = uid();
  const db = {
    users: {
      [id]: { id, email: 'admin@aman.app', passwordHash: hash('Admin@1234', salt), salt,
               name: 'Admin', role: 'admin', plan: 'pro', createdAt: now(),
               translations: 0, words: 0, loginAttempts: 0, lockedUntil: 0, history: [] },
    },
    sessions: {}, settings: defaultSettings(),
    stats: { totalTranslations: 0, totalWords: 0 },
    notifications: [], activityLog: [],
  };
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
  return db;
}

function loadLocal() {
  if (!fs.existsSync(DATA_FILE)) return initLocal();
  try {
    const db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    // Migrate missing fields
    const ds = defaultSettings();
    db.settings = Object.assign({}, ds, db.settings);
    if (!db.activityLog)   db.activityLog   = [];
    if (!db.notifications) db.notifications = [];
    if (!db.stats)         db.stats = { totalTranslations: 0, totalWords: 0 };
    Object.values(db.users).forEach(u => {
      if (!u.history)          u.history        = [];
      if (u.loginAttempts == null) u.loginAttempts = 0;
      if (u.lockedUntil   == null) u.lockedUntil   = 0;
    });
    return db;
  } catch { return initLocal(); }
}

let DB = loadLocal();
function saveDB() { fs.writeFileSync(DATA_FILE, JSON.stringify(DB, null, 2), 'utf8'); }

// Session cleanup every hour
setInterval(() => {
  const t = now(); let dirty = false;
  for (const [k, s] of Object.entries(DB.sessions)) {
    if (t > s.exp) { delete DB.sessions[k]; dirty = true; }
  }
  if (dirty) saveDB();
}, 3_600_000);

function addLog(action, userId = '', detail = '') {
  if (!DB.activityLog) DB.activityLog = [];
  DB.activityLog.push({ id: uid(), action, userId, detail, ts: now() });
  if (DB.activityLog.length > 500) DB.activityLog = DB.activityLog.slice(-500);
}

// ── Firebase Firestore adapter ────────────────────────────────
// Calls Firebase REST API — no npm needed
// Only activated when settings.useFirebase = true AND firebaseProject/Key set

let FB = null; // Firebase client instance, initialized lazily

function fbHeaders(idToken) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` };
}

async function fbGetToken() {
  // Exchange service account key for access token via Google OAuth2
  const key = DB.settings.firebaseKey;
  if (!key) throw new Error('Firebase key not configured');
  let sa;
  try { sa = JSON.parse(key); } catch { throw new Error('Invalid Firebase JSON key'); }

  const now_s = Math.floor(Date.now() / 1000);
  const payload = {
    iss: sa.client_email, sub: sa.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now_s, exp: now_s + 3600,
    scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase',
  };
  // Build JWT manually (RS256)
  const header  = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const body_b  = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const toSign  = `${header}.${body_b}`;
  const sig     = crypto.createSign('RSA-SHA256').update(toSign).sign(sa.private_key, 'base64url');
  const jwt     = `${toSign}.${sig}`;

  const postData = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt,
  }).toString();

  return new Promise((ok, fail) => {
    const req = https.request({
      hostname: 'oauth2.googleapis.com', path: '/token',
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        const r = JSON.parse(d);
        r.error ? fail(new Error(r.error_description || r.error)) : ok(r.access_token);
      });
    });
    req.on('error', fail);
    req.write(postData); req.end();
  });
}

// Cache token for 50 minutes
let _fbToken = null, _fbTokenExp = 0;
async function getFirebaseToken() {
  if (_fbToken && now() < _fbTokenExp) return _fbToken;
  _fbToken = await fbGetToken();
  _fbTokenExp = now() + 50 * 60 * 1000;
  return _fbToken;
}

async function fbRequest(method, docPath, body = null) {
  const project = DB.settings.firebaseProject;
  const token   = await getFirebaseToken();
  const base    = `firestore.googleapis.com`;
  const apiPath = `/v1/projects/${project}/databases/(default)/documents/${docPath}`;

  return new Promise((ok, fail) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: base, port: 443, method,
      path: apiPath,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { ok({ status: res.statusCode, data: JSON.parse(d) }); }
        catch { ok({ status: res.statusCode, data: d }); }
      });
    });
    req.on('error', fail);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// Convert JS value → Firestore value
function toFS(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean')  return { booleanValue: v };
  if (typeof v === 'number')   return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string')   return { stringValue: v };
  if (Array.isArray(v))        return { arrayValue: { values: v.map(toFS) } };
  if (typeof v === 'object')   return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k,x]) => [k, toFS(x)])) } };
  return { stringValue: String(v) };
}

// Convert Firestore value → JS value
function fromFS(v) {
  if (!v) return null;
  if ('nullValue'    in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue'  in v) return v.doubleValue;
  if ('stringValue'  in v) return v.stringValue;
  if ('arrayValue'   in v) return (v.arrayValue.values || []).map(fromFS);
  if ('mapValue'     in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k,x]) => [k, fromFS(x)]));
  return null;
}

function fromFSDoc(doc) {
  if (!doc?.fields) return null;
  return Object.fromEntries(Object.entries(doc.fields).map(([k, v]) => [k, fromFS(v)]));
}

function toFSDoc(obj) {
  return { fields: Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, toFS(v)])) };
}

// High-level Firebase DB operations (mirrors local DB interface)
const Firebase = {
  async getUser(id) {
    const r = await fbRequest('GET', `users/${id}`);
    return r.status === 200 ? fromFSDoc(r.data) : null;
  },
  async setUser(id, data) {
    await fbRequest('PATCH', `users/${id}`, toFSDoc({ ...data, id }));
  },
  async deleteUser(id) {
    await fbRequest('DELETE', `users/${id}`);
  },
  async getAllUsers() {
    const r = await fbRequest('GET', 'users');
    if (!r.data?.documents) return [];
    return r.data.documents.map(fromFSDoc).filter(Boolean);
  },
  async getSettings() {
    const r = await fbRequest('GET', 'meta/settings');
    return r.status === 200 ? (fromFSDoc(r.data) || defaultSettings()) : defaultSettings();
  },
  async setSettings(data) {
    await fbRequest('PATCH', 'meta/settings', toFSDoc(data));
  },
  async getStats() {
    const r = await fbRequest('GET', 'meta/stats');
    return r.status === 200 ? (fromFSDoc(r.data) || {}) : {};
  },
  async setStats(data) {
    await fbRequest('PATCH', 'meta/stats', toFSDoc(data));
  },
  async getNotifs() {
    const r = await fbRequest('GET', 'notifications');
    if (!r.data?.documents) return [];
    return r.data.documents.map(d => fromFSDoc(d)).filter(Boolean)
      .sort((a, b) => b.createdAt - a.createdAt);
  },
  async addNotif(notif) {
    await fbRequest('PATCH', `notifications/${notif.id}`, toFSDoc(notif));
  },
  async updateNotif(id, data) {
    // Fetch + merge
    const r = await fbRequest('GET', `notifications/${id}`);
    const existing = r.status === 200 ? fromFSDoc(r.data) : {};
    await fbRequest('PATCH', `notifications/${id}`, toFSDoc({ ...existing, ...data, id }));
  },
};

// ── DB proxy: routes to Firebase or local ────────────────────
function useFirebase() {
  return DB.settings.useFirebase && DB.settings.firebaseProject && DB.settings.firebaseKey;
}

// For simplicity we still cache in-memory DB and sync to Firebase on writes
// This avoids async reads on every request
async function syncToFirebase() {
  if (!useFirebase()) return;
  try {
    // Sync all users
    for (const [id, u] of Object.entries(DB.users)) {
      await Firebase.setUser(id, u);
    }
    await Firebase.setSettings(DB.settings);
    await Firebase.setStats(DB.stats);
    slog('Firebase sync complete');
  } catch (e) {
    slog('Firebase sync error:', e.message);
  }
}

async function loadFromFirebase() {
  if (!useFirebase()) return false;
  try {
    const users    = await Firebase.getAllUsers();
    const settings = await Firebase.getSettings();
    const stats    = await Firebase.getStats();
    if (users.length) {
      DB.users = {};
      users.forEach(u => { DB.users[u.id] = u; });
    }
    if (settings?.geminiModel) DB.settings = { ...defaultSettings(), ...settings };
    if (stats?.totalTranslations != null) DB.stats = stats;
    slog('Loaded from Firebase:', users.length, 'users');
    return true;
  } catch (e) {
    slog('Firebase load error:', e.message);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// SMTP EMAIL  (pure Node.js, no nodemailer needed)
// ═══════════════════════════════════════════════════════════════

function smtpReady() {
  const s = DB.settings;
  return !!(s.smtpHost && s.smtpPort && s.smtpUser && s.smtpPass && s.smtpFrom);
}

function sendSmtp(to, subject, html) {
  return new Promise((ok, fail) => {
    if (!smtpReady()) return fail(new Error('SMTP not configured'));
    const s    = DB.settings;
    const port = parseInt(s.smtpPort) || 587;
    const sock = s.smtpSecure
      ? require('tls').connect(port, s.smtpHost, { rejectUnauthorized: false })
      : net.createConnection(port, s.smtpHost);

    let buf = '', step = 0, upgraded = false;

    const send = (line) => {
      sock.write(line + '\r\n');
    };

    const b64 = (v) => Buffer.from(v).toString('base64');

    // Build message
    const boundary = uid();
    const textVersion = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const msg = [
      `From: =?UTF-8?B?${b64('أمان')}?= <${s.smtpFrom}>`,
      `To: ${to}`,
      `Subject: =?UTF-8?B?${b64(subject)}?=`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      ``,
      b64(textVersion),
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      ``,
      b64(html),
      `--${boundary}--`,
    ].join('\r\n');

    const handleLine = (line) => {
      slog('SMTP <', line.slice(0, 80));
      const code = parseInt(line);

      // STARTTLS upgrade
      if (code === 220 && line.includes('STARTTLS') && !upgraded && !s.smtpSecure) {
        send('STARTTLS'); return;
      }
      if (code === 220 && step === 0) { step = 1; send('EHLO aman'); return; }
      if (code === 220 && step > 0 && !upgraded) {
        upgraded = true;
        const tlsSock = require('tls').connect({ socket: sock, rejectUnauthorized: false }, () => {
          sock.removeAllListeners('data');
          tlsSock.on('data', d => d.toString().split('\r\n').filter(Boolean).forEach(handleLine));
          send('EHLO aman');
        });
        return;
      }
      if (code === 250 && step === 1) { step = 2; send(`AUTH LOGIN`); return; }
      if (code === 334 && step === 2) { step = 3; send(b64(s.smtpUser)); return; }
      if (code === 334 && step === 3) { step = 4; send(b64(s.smtpPass)); return; }
      if (code === 235 && step === 4) { step = 5; send(`MAIL FROM:<${s.smtpFrom}>`); return; }
      if (code === 250 && step === 5) { step = 6; send(`RCPT TO:<${to}>`); return; }
      if (code === 250 && step === 6) { step = 7; send('DATA'); return; }
      if (code === 354 && step === 7) { step = 8; send(msg + '\r\n.'); return; }
      if (code === 250 && step === 8) { step = 9; send('QUIT'); sock.destroy(); ok(); return; }
      if (code === 221) { sock.destroy(); ok(); return; }
      if (code >= 400)  { sock.destroy(); fail(new Error(`SMTP ${code}: ${line}`)); return; }
    };

    sock.on('data', d => d.toString().split('\r\n').filter(Boolean).forEach(handleLine));
    sock.on('error', fail);
    sock.on('timeout', () => { sock.destroy(); fail(new Error('SMTP timeout')); });
    sock.setTimeout(20000);
  });
}

// Email templates
function emailTemplates(type, data = {}) {
  const brand = `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto">
    <div style="background:linear-gradient(135deg,#0b0f1a,#1a2235);padding:28px 32px;border-radius:12px 12px 0 0;text-align:center">
      <div style="font-size:32px">🛡️</div>
      <div style="color:#e8c97e;font-size:1.3rem;font-weight:800;margin-top:6px">أمان للملفات والنصوص</div>
    </div>
    <div style="background:#fff;padding:28px 32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">`;
  const end = `</div></div>`;

  const templates = {
    welcome: `${brand}
      <h2 style="color:#1a2235;margin:0 0 12px">مرحباً ${data.name}! 👋</h2>
      <p style="color:#374151;line-height:1.8">تم إنشاء حسابك بنجاح في منصة أمان للترجمة.</p>
      <a href="${data.appUrl||'#'}" style="display:inline-block;background:linear-gradient(135deg,#c9a84c,#9a6f18);color:#0b0f1a;padding:12px 28px;border-radius:9px;text-decoration:none;font-weight:800;margin:16px 0">ابدأ الترجمة الآن →</a>
      <p style="color:#6b7280;font-size:.85rem;margin-top:20px">إذا لم تقم بإنشاء هذا الحساب يرجى تجاهل هذا الإيميل.</p>
    ${end}`,

    payment_received: `${brand}
      <h2 style="color:#1a2235;margin:0 0 12px">✅ استلمنا طلب دفعتك</h2>
      <p style="color:#374151;line-height:1.8">مرحباً ${data.name}، تلقينا طلب اشتراكك في خطة <strong style="color:#c9a84c">${data.planName}</strong></p>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0">
        <div style="color:#374151"><b>الخطة:</b> ${data.planName}</div>
        <div style="color:#374151"><b>المبلغ:</b> ${data.amount}</div>
        <div style="color:#374151"><b>طريقة الدفع:</b> ${data.method}</div>
      </div>
      <p style="color:#374151;line-height:1.8">سيتم مراجعة طلبك وتفعيل اشتراكك خلال <strong>2-24 ساعة</strong>. ستصلك رسالة تأكيد.</p>
    ${end}`,

    payment_approved: `${brand}
      <h2 style="color:#1a2235;margin:0 0 12px">🎉 تم تفعيل اشتراكك!</h2>
      <p style="color:#374151;line-height:1.8">مبروك ${data.name}! تم قبول دفعتك وتفعيل خطة <strong style="color:#c9a84c">${data.planName}</strong> على حسابك.</p>
      <a href="${data.appUrl||'#'}" style="display:inline-block;background:linear-gradient(135deg,#c9a84c,#9a6f18);color:#0b0f1a;padding:12px 28px;border-radius:9px;text-decoration:none;font-weight:800;margin:16px 0">استخدم حسابك الآن →</a>
    ${end}`,

    payment_rejected: `${brand}
      <h2 style="color:#1a2235;margin:0 0 12px">❌ لم يتم تأكيد دفعتك</h2>
      <p style="color:#374151;line-height:1.8">مرحباً ${data.name}، للأسف لم نتمكن من التحقق من دفعتك للخطة <strong>${data.planName}</strong>.</p>
      ${data.reason ? `<p style="color:#374151"><b>السبب:</b> ${data.reason}</p>` : ''}
      <p style="color:#374151;line-height:1.8">يرجى التواصل معنا أو المحاولة مجدداً.</p>
    ${end}`,
  };
  return templates[type] || '';
}

async function sendEmail(to, type, data = {}) {
  if (!smtpReady()) { slog('SMTP not configured — skip email', type, to); return false; }
  try {
    const subjects = {
      welcome           : 'مرحباً بك في أمان للترجمة 🛡️',
      payment_received  : 'استلمنا طلب دفعتك ✅',
      payment_approved  : 'تم تفعيل اشتراكك! 🎉',
      payment_rejected  : 'بخصوص طلب دفعتك',
    };
    const html = emailTemplates(type, data);
    await sendSmtp(to, subjects[type] || 'إشعار من أمان', html);
    slog('Email sent:', type, '->', to);
    return true;
  } catch (e) {
    slog('Email error:', e.message);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// GEMINI  (direct OR via Worker proxy)
// ═══════════════════════════════════════════════════════════════
const LANGS = {
  auto:'Auto-detect',ar:'Arabic',en:'English',fr:'French',de:'German',
  es:'Spanish',zh:'Chinese (Simplified)',ja:'Japanese',ru:'Russian',
  tr:'Turkish',it:'Italian',pt:'Portuguese',ko:'Korean',nl:'Dutch',
  sv:'Swedish',pl:'Polish',fa:'Persian',hi:'Hindi',ur:'Urdu',
  id:'Indonesian',th:'Thai',vi:'Vietnamese',
};

function sysPrompt(src, tgt, opts = {}) {
  const rules = [
    `Translate from ${src === 'auto' ? 'auto-detected language' : (LANGS[src] || src)} to ${LANGS[tgt] || tgt}.`,
    'Return ONLY the translated text — no preamble, no labels.',
  ];
  if (opts.preserve_format) rules.push('Preserve all formatting: Markdown, HTML, line breaks.');
  if (opts.skip_code)       rules.push('Do NOT translate code blocks — keep as-is.');
  if (opts.formal)          rules.push('Use formal, professional register.');
  if (opts.context)         rules.push('Consider full document context for natural translation.');
  return 'You are an expert professional translator.\n' + rules.map(r => '- ' + r).join('\n');
}

// Call via Worker (Deno / Cloudflare)
function callWorker(apiKey, system, user) {
  return new Promise((ok, fail) => {
    const wUrl    = DB.settings.workerUrl.replace(/\/$/, '') + '/translate';
    const secret  = DB.settings.workerSecret || '';
    const model   = DB.settings.geminiModel || 'gemini-2.5-flash';
    const body    = JSON.stringify({ apiKey, model, system, user, maxTokens: 8192 });
    const parsed  = new URL(wUrl);
    const isHttps = parsed.protocol === 'https:';
    const lib     = isHttps ? https : require('http');

    const req = lib.request({
      hostname : parsed.hostname,
      port     : parsed.port || (isHttps ? 443 : 80),
      path     : parsed.pathname + (parsed.search || ''),
      method   : 'POST',
      headers  : {
        'Content-Type'   : 'application/json',
        'Content-Length' : Buffer.byteLength(body),
        'X-Aman-Secret'  : secret,
      },
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const r = JSON.parse(d);
          if (r.error) return fail(new Error('Worker: ' + r.error));
          ok(r.text?.trim() || '');
        } catch (e) { fail(new Error('Worker parse error: ' + d.slice(0, 200))); }
      });
    });
    req.on('error', fail);
    req.setTimeout(120000, () => { req.destroy(); fail(new Error('Worker timeout')); });
    req.write(body); req.end();
  });
}

// Call Gemini directly
function callDirect(apiKey, system, user) {
  return new Promise((ok, fail) => {
    const m    = DB.settings.geminiModel || 'gemini-2.5-flash';
    const body = JSON.stringify({
      system_instruction : { parts: [{ text: system }] },
      contents           : [{ role: 'user', parts: [{ text: user }] }],
      generationConfig   : { temperature: 0.1, maxOutputTokens: 8192, responseMimeType: 'text/plain' },
      safetySettings     : [
        { category:'HARM_CATEGORY_HARASSMENT',        threshold:'BLOCK_NONE' },
        { category:'HARM_CATEGORY_HATE_SPEECH',       threshold:'BLOCK_NONE' },
        { category:'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold:'BLOCK_NONE' },
        { category:'HARM_CATEGORY_DANGEROUS_CONTENT', threshold:'BLOCK_NONE' },
      ],
    });
    const req = https.request({
      hostname : 'generativelanguage.googleapis.com', port: 443, method: 'POST',
      path     : `/v1beta/models/${m}:generateContent?key=${apiKey}`,
      headers  : { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const p = JSON.parse(d);
          if (p.error) return fail(new Error('Gemini: ' + (p.error.message || JSON.stringify(p.error))));
          const text = p.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) return fail(new Error('Gemini empty (reason: ' + (p.candidates?.[0]?.finishReason || 'unknown') + ')'));
          ok(text.trim());
        } catch (e) { fail(new Error('Gemini parse: ' + e.message)); }
      });
    });
    req.on('error', fail);
    req.setTimeout(90000, () => { req.destroy(); fail(new Error('Gemini timeout')); });
    req.write(body); req.end();
  });
}

// Auto-select: Worker if configured, else Direct
async function callAI(apiKey, system, user) {
  if (DB.settings.useWorker && DB.settings.workerUrl) {
    slog('AI via Worker:', DB.settings.workerUrl.slice(0, 40));
    return callWorker(apiKey, system, user);
  }
  return callDirect(apiKey, system, user);
}

function chunkText(text, max = CHUNK_CHARS) {
  if (text.length <= max) return [text];
  const out = [], paras = text.split('\n\n'); let cur = '';
  for (const p of paras) {
    if ((cur + p).length > max && cur) { out.push(cur.trim()); cur = p; }
    else cur += (cur ? '\n\n' : '') + p;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.length ? out : [text];
}

async function translate(text, src, tgt, apiKey, opts = {}) {
  const sys = sysPrompt(src, tgt, opts);
  const chunks = chunkText(text);
  const results = [];
  for (const c of chunks) results.push(await callAI(apiKey, sys, 'Translate:\n\n' + c));
  return results.join('\n\n');
}

// ═══════════════════════════════════════════════════════════════
// MULTIPART PARSER
// ═══════════════════════════════════════════════════════════════
function bufIdx(buf, needle, start = 0) {
  outer: for (let i = start; i <= buf.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (buf[i+j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

function parseMultipart(req) {
  return new Promise((ok, fail) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try {
        const body  = Buffer.concat(chunks);
        const bm    = (req.headers['content-type'] || '').match(/boundary=([^\s;]+)/);
        if (!bm) return fail(new Error('No boundary'));
        const bound = Buffer.from('--' + bm[1]);
        const parts = []; let start = 0;
        while (start < body.length) {
          const bp = bufIdx(body, bound, start); if (bp === -1) break;
          const hs = bp + bound.length + 2;
          const he = bufIdx(body, Buffer.from('\r\n\r\n'), hs); if (he === -1) break;
          const hdrs = body.slice(hs, he).toString();
          const ds = he + 4, nb = bufIdx(body, bound, ds), de = nb !== -1 ? nb - 2 : body.length;
          const nm = hdrs.match(/name="([^"]+)"/), fm = hdrs.match(/filename="([^"]+)"/);
          if (nm) parts.push({ name: nm[1], filename: fm ? fm[1] : null, data: body.slice(ds, de), hdrs });
          start = nb !== -1 ? nb : body.length;
        }
        ok(parts);
      } catch (e) { fail(e); }
    });
    req.on('error', fail);
  });
}

// ═══════════════════════════════════════════════════════════════
// SESSION / AUTH
// ═══════════════════════════════════════════════════════════════
function createSession(userId, remember = false) {
  const t = tok(), ttl = remember ? 30 * 24 * 60 * 60 * 1000 : SESSION_TTL;
  DB.sessions[t] = { userId, exp: now() + ttl };
  saveDB();
  return t;
}
function getUser(req) {
  const auth = req.headers['authorization'] || '';
  const t    = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!t) return null;
  const s = DB.sessions[t];
  if (!s || now() > s.exp) return null;
  return DB.users[s.userId] || null;
}
function mustAuth (req, res) { const u = getUser(req); if (!u) { json(res, 401, { error: 'Login required' }); return null; } return u; }
function mustAdmin(req, res) { const u = getUser(req); if (!u || u.role !== 'admin') { json(res, 403, { error: 'Admin only' }); return null; } return u; }
const safeUser = u => ({ id:u.id, name:u.name, email:u.email, role:u.role, plan:u.plan, translations:u.translations||0, words:u.words||0, createdAt:u.createdAt });

// ═══════════════════════════════════════════════════════════════
// PYTHON RUNNER
// ═══════════════════════════════════════════════════════════════
function runPy(script, args, ms = 120000) {
  return new Promise((ok, fail) => {
    const fp = path.join(BASE_DIR, script);
    if (!fs.existsSync(fp)) return fail(new Error('Script not found: ' + fp));
    execFile(PYTHON, [fp, ...args], {
      timeout: ms, maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
    }, (err, stdout, stderr) => {
      if (err?.killed)           return fail(new Error('Python timeout'));
      if (err?.code === 'ENOENT') return fail(new Error('Python not found'));
      try { const r = JSON.parse(stdout.trim()); if (r.error) return fail(new Error(r.error)); ok(r); }
      catch { fail(new Error(stderr || err?.message || stdout.slice(0, 300))); }
    });
  });
}
const BIN_EXT = new Set(['.pdf','.docx','.doc']);
const isBin   = n => BIN_EXT.has(path.extname(n).toLowerCase());

// ═══════════════════════════════════════════════════════════════
// JOB STORE
// ═══════════════════════════════════════════════════════════════
const JOBS = new Map();

async function runJob(jobId) {
  const job = JOBS.get(jobId); if (!job) return;
  job.status = 'running'; job.startedAt = now();
  const apiKey = DB.settings.geminiApiKey;
  if (!apiKey) { job.status = 'failed'; job.error = 'API key not configured'; return; }

  const sem = { n: 0, max: job.concurrency, q: [] };
  const acq = () => new Promise(r => sem.n < sem.max ? (sem.n++, r()) : sem.q.push(r));
  const rel = () => { sem.n--; if (sem.q.length) { sem.n++; sem.q.shift()(); } };

  await Promise.all(job.files.map(async fi => {
    await acq();
    if (job.cancelled) { fi.status = 'cancelled'; rel(); return; }
    fi.status = 'translating';
    try {
      let text;
      if (isBin(fi.name)) {
        const r = await runPy('extract_text.py', [fi.uploadPath]);
        text = r.text || '';
        if (!text.trim()) throw new Error('No extractable text');
      } else {
        text = fs.readFileSync(fi.uploadPath, 'utf8');
      }
      const translated = await translate(text, job.src, job.tgt, apiKey, job.opts);
      fi.wordCount = text.split(/\s+/).length;
      const ext = path.extname(fi.name), base = path.basename(fi.name, ext);
      const out = path.join(OUTPUT_DIR, jobId + '_' + sanitizeFilename(fi.name));
      if (isBin(fi.name)) {
        const tp = path.join(OUTPUT_DIR, jobId + '_' + base + '_tr.txt');
        fs.writeFileSync(tp, translated, 'utf8');
        fi.txtPath = tp;
        await runPy('rebuild_doc.py', [fi.uploadPath, tp, out]);
      } else {
        fs.writeFileSync(out, translated, 'utf8');
      }
      fi.status = 'done'; fi.outPath = out; fi.outExt = path.extname(out);
      fi.preview = translated.slice(0, 500);
      const u = DB.users[job.userId];
      if (u) { u.words = (u.words || 0) + fi.wordCount; u.translations = (u.translations || 0) + 1; if (!u.history) u.history = []; u.history.push({ id: uid(), jobId, fileName: fi.name, src: job.src, tgt: job.tgt, words: fi.wordCount, ts: now(), type: isBin(fi.name) ? 'file' : 'text' }); if (u.history.length > 50) u.history = u.history.slice(-50); }
      DB.stats.totalWords        = (DB.stats.totalWords || 0)        + fi.wordCount;
      DB.stats.totalTranslations = (DB.stats.totalTranslations || 0) + 1;
      saveDB();
    } catch (e) { fi.status = 'error'; fi.error = e.message; }
    rel();
  }));

  job.status = job.cancelled ? 'cancelled' : 'completed';
  job.completedAt = now();
  job.duration = ((job.completedAt - job.startedAt) / 1000).toFixed(1);
  job.files.forEach(f => { try { fs.unlinkSync(f.uploadPath); } catch {} });
}

setInterval(() => {
  const cut = now() - 3 * 3_600_000;
  for (const [id, job] of JOBS.entries()) {
    if (job.createdAt < cut) {
      job.files?.forEach(f => { try { fs.unlinkSync(f.outPath); } catch {} try { fs.unlinkSync(f.txtPath); } catch {} });
      JOBS.delete(id);
    }
  }
}, 3_600_000);

// ═══════════════════════════════════════════════════════════════
// HANDLERS — AUTH
// ═══════════════════════════════════════════════════════════════
async function hRegister(req, res) {
  try {
    if (!DB.settings.allowRegistration) return json(res, 403, { error: 'Registration is closed' });
    const { name, email, password } = await readJSON(req);
    if (!name?.trim() || !email?.trim() || !password) return json(res, 400, { error: 'All fields required' });
    if (password.length < 8)            return json(res, 400, { error: 'Password min 8 chars' });
    if (!/\S+@\S+\.\S+/.test(email))    return json(res, 400, { error: 'Invalid email' });
    if (Object.values(DB.users).find(u => u.email === email.toLowerCase())) return json(res, 409, { error: 'Email already registered' });
    const salt = crypto.randomBytes(16).toString('hex'), id = uid();
    DB.users[id] = { id, email: email.toLowerCase(), name: name.trim(), passwordHash: hash(password, salt), salt, role: 'user', plan: 'free', createdAt: now(), translations: 0, words: 0, loginAttempts: 0, lockedUntil: 0, history: [] };
    saveDB();
    addLog('register', id, email.toLowerCase());
    const token = createSession(id);
    if (DB.settings.emailOnRegister) {
      sendEmail(email, 'welcome', { name: name.trim(), appUrl: `http://localhost:${PORT}/app` }).catch(() => {});
    }
    json(res, 201, { token, user: safeUser(DB.users[id]) });
  } catch (e) { json(res, 500, { error: e.message }); }
}

async function hLogin(req, res) {
  try {
    const { email, password, remember } = await readJSON(req);
    if (!email || !password) return json(res, 400, { error: 'Email and password required' });
    const u = Object.values(DB.users).find(u => u.email === email.toLowerCase());
    if (u?.lockedUntil && now() < u.lockedUntil)
      return json(res, 429, { error: 'Account locked — try again in ' + Math.ceil((u.lockedUntil - now()) / 60000) + ' min' });
    if (!u || hash(password, u.salt) !== u.passwordHash) {
      if (u) { u.loginAttempts = (u.loginAttempts || 0) + 1; if (u.loginAttempts >= MAX_LOGIN_FAIL) { u.lockedUntil = now() + LOCKOUT_MS; u.loginAttempts = 0; } saveDB(); }
      return json(res, 401, { error: 'Invalid email or password' });
    }
    u.loginAttempts = 0; u.lockedUntil = 0;
    const token = createSession(u.id, !!remember);
    addLog('login', u.id, getIP(req));
    saveDB();
    json(res, 200, { token, user: safeUser(u) });
  } catch (e) { json(res, 500, { error: e.message }); }
}

function hLogout(req, res) {
  const t = (req.headers['authorization'] || '').slice(7);
  if (t) { delete DB.sessions[t]; saveDB(); }
  json(res, 200, { ok: true });
}

function hMe(req, res) {
  const u = mustAuth(req, res); if (!u) return;
  json(res, 200, safeUser(u));
}

async function hUpdateProfile(req, res) {
  const u = mustAuth(req, res); if (!u) return;
  try {
    const b = await readJSON(req);
    if (b.name?.trim()) u.name = b.name.trim();
    if (b.newPassword) {
      if (!b.currentPassword) return json(res, 400, { error: 'Current password required' });
      if (hash(b.currentPassword, u.salt) !== u.passwordHash) return json(res, 401, { error: 'Wrong current password' });
      if (b.newPassword.length < 8) return json(res, 400, { error: 'New password min 8 chars' });
      const ns = crypto.randomBytes(16).toString('hex');
      u.salt = ns; u.passwordHash = hash(b.newPassword, ns);
      const ct = (req.headers['authorization'] || '').slice(7);
      Object.keys(DB.sessions).forEach(t => { if (t !== ct && DB.sessions[t].userId === u.id) delete DB.sessions[t]; });
    }
    saveDB();
    json(res, 200, { ok: true, user: safeUser(u) });
  } catch (e) { json(res, 500, { error: e.message }); }
}

function hHistory(req, res) {
  const u = mustAuth(req, res); if (!u) return;
  json(res, 200, { history: (u.history || []).slice().reverse() });
}

// ═══════════════════════════════════════════════════════════════
// HANDLERS — TRANSLATION
// ═══════════════════════════════════════════════════════════════
async function hTranslateText(req, res) {
  const u = mustAuth(req, res); if (!u) return;
  if (!limitUser(u.id, res)) return;
  const apiKey = DB.settings.geminiApiKey;
  if (!apiKey) return json(res, 503, { error: 'Translation unavailable — set API key in admin' });
  try {
    const { text, src = 'auto', tgt = 'ar', options = {} } = await readJSON(req);
    if (!text?.trim()) return json(res, 400, { error: 'Text required' });
    if (u.plan === 'free' && text.length > (DB.settings.freeCharsLimit || 500))
      return json(res, 403, { error: `Free plan limit: ${DB.settings.freeCharsLimit} chars`, upgrade: true });
    const translated = await translate(text, src, tgt, apiKey, options);
    const wc = text.split(/\s+/).length;
    u.words = (u.words || 0) + wc; u.translations = (u.translations || 0) + 1;
    if (!u.history) u.history = [];
    u.history.push({ id: uid(), src, tgt, chars: text.length, words: wc, ts: now(), type: 'text', preview: text.slice(0, 80) });
    if (u.history.length > 50) u.history = u.history.slice(-50);
    DB.stats.totalWords = (DB.stats.totalWords || 0) + wc;
    DB.stats.totalTranslations = (DB.stats.totalTranslations || 0) + 1;
    saveDB();
    json(res, 200, { translated, wordCount: wc, chars: text.length });
  } catch (e) { json(res, 500, { error: e.message }); }
}

async function hTranslateFiles(req, res) {
  const u = mustAuth(req, res); if (!u) return;
  if (!limitUser(u.id, res)) return;
  const apiKey = DB.settings.geminiApiKey;
  if (!apiKey) return json(res, 503, { error: 'Translation unavailable — set API key in admin' });
  try {
    const parts = await parseMultipart(req);
    const fields = {}, files = [];
    for (const p of parts) {
      if (p.filename) {
        if (p.data.length > MAX_FILE_B) return json(res, 413, { error: `File too large: ${p.filename}` });
        const safe = sanitizeFilename(p.filename);
        const up   = path.join(UPLOAD_DIR, uid() + '_' + safe);
        fs.writeFileSync(up, p.data);
        files.push({ name: safe, size: p.data.length, uploadPath: up, status: 'pending' });
      } else { fields[p.name] = p.data.toString().trim(); }
    }
    if (!files.length) return json(res, 400, { error: 'No files' });
    const maxF = u.plan === 'free' ? (DB.settings.freeFilesLimit || 3) : (DB.settings.maxFilesPerJob || 50);
    if (files.length > maxF) return json(res, 403, { error: `Plan limit: max ${maxF} files`, upgrade: true });
    const jobId = uid();
    JOBS.set(jobId, {
      id: jobId, userId: u.id, status: 'queued', files,
      src: fields.src || 'auto', tgt: fields.tgt || 'ar',
      concurrency: Math.min(parseInt(fields.concurrency || '3'), 10),
      opts: { preserve_format: fields.preserve_format !== 'false', skip_code: fields.skip_code !== 'false', formal: fields.formal === 'true', context: fields.context !== 'false' },
      createdAt: now(), cancelled: false,
    });
    runJob(jobId);
    json(res, 202, { jobId, files: files.map(f => ({ name: f.name, size: f.size })) });
  } catch (e) { json(res, 500, { error: e.message }); }
}

function hJobStatus(res, jobId, u) {
  const job = JOBS.get(jobId);
  if (!job) return json(res, 404, { error: 'Job not found' });
  if (job.userId !== u.id && u.role !== 'admin') return json(res, 403, { error: 'Forbidden' });
  const total = job.files.length, done = job.files.filter(f => f.status === 'done').length, errs = job.files.filter(f => f.status === 'error').length;
  json(res, 200, { jobId, status: job.status, error: job.error || null, progress: total ? Math.round((done + errs) / total * 100) : 0, total, done, errors: errs, duration: job.duration || null, cancelled: job.cancelled, files: job.files.map(f => ({ name: f.name, size: f.size, status: f.status, wordCount: f.wordCount || null, error: f.error || null, preview: f.preview || null, downloadUrl: f.status === 'done' ? `/api/download/${jobId}/${encodeURIComponent(f.name)}` : null })) });
}

function hCancelJob(req, res, jobId) {
  const u = mustAuth(req, res); if (!u) return;
  const job = JOBS.get(jobId);
  if (!job) return json(res, 404, { error: 'Job not found' });
  if (job.userId !== u.id && u.role !== 'admin') return json(res, 403, { error: 'Forbidden' });
  job.cancelled = true;
  job.files.forEach(f => { if (f.status === 'pending') f.status = 'cancelled'; });
  json(res, 200, { ok: true });
}

function hDownloadOne(res, jobId, fileName, u) {
  const job = JOBS.get(jobId);
  if (!job) return json(res, 404, { error: 'Job not found' });
  if (job.userId !== u.id && u.role !== 'admin') return json(res, 403, { error: 'Forbidden' });
  const fi = job.files.find(f => f.name === decodeURIComponent(fileName));
  if (!fi || fi.status !== 'done') return json(res, 404, { error: 'File not ready' });
  sendFile(res, fi.outPath, path.basename(fi.name, path.extname(fi.name)) + '_' + job.tgt + (fi.outExt || path.extname(fi.name)));
}

function hDownloadAll(res, jobId, u) {
  const job = JOBS.get(jobId);
  if (!job) return json(res, 404, { error: 'Job not found' });
  if (job.userId !== u.id && u.role !== 'admin') return json(res, 403, { error: 'Forbidden' });
  const done = job.files.filter(f => f.status === 'done');
  const textFiles = {}, binaryFiles = [];
  done.forEach(f => {
    const ext = f.outExt || path.extname(f.name), base = path.basename(f.name, path.extname(f.name)), name = base + '_' + job.tgt + ext;
    if (isBin(f.name)) binaryFiles.push({ name, url: `/api/download/${jobId}/${encodeURIComponent(f.name)}` });
    else { try { textFiles[name] = fs.readFileSync(f.outPath, 'utf8'); } catch {} }
  });
  json(res, 200, { textFiles, binaryFiles, total: done.length });
}

// ═══════════════════════════════════════════════════════════════
// HANDLERS — ADMIN
// ═══════════════════════════════════════════════════════════════
function hAdminStats(req, res) {
  const u = mustAdmin(req, res); if (!u) return;
  let activeJobs = 0; JOBS.forEach(j => { if (j.status === 'running') activeJobs++; });
  const planCount = {};
  Object.values(DB.users).forEach(u2 => { planCount[u2.plan] = (planCount[u2.plan] || 0) + 1; });
  json(res, 200, { totalTranslations: DB.stats.totalTranslations || 0, totalWords: DB.stats.totalWords || 0, totalUsers: Object.keys(DB.users).length, activeJobs, apiKeySet: !!DB.settings.geminiApiKey, planCount, pendingPayments: (DB.notifications || []).filter(n => n.status === 'pending').length, smtpReady: smtpReady(), workerActive: !!(DB.settings.useWorker && DB.settings.workerUrl), firebaseActive: useFirebase() });
}

function hAdminSettings(req, res) {
  const u = mustAdmin(req, res); if (!u) return;
  const s = { ...DB.settings };
  if (s.geminiApiKey) s.geminiApiKey = '........' + s.geminiApiKey.slice(-4);
  if (s.smtpPass)     s.smtpPass     = '........';
  if (s.firebaseKey)  s.firebaseKey  = '••• (set) •••';
  if (s.workerSecret) s.workerSecret = '........' + s.workerSecret.slice(-4);
  json(res, 200, s);
}

async function hAdminSaveSettings(req, res) {
  const u = mustAdmin(req, res); if (!u) return;
  try {
    const b = await readJSON(req);
    const mask = ['geminiApiKey', 'smtpPass', 'workerSecret'];
    const sentinel = ['........', '••• (set) •••'];
    const plain = [
      'geminiModel', 'workerUrl', 'useWorker',
      'smtpHost', 'smtpPort', 'smtpSecure', 'smtpUser', 'smtpFrom',
      'emailOnRegister', 'emailOnPaymentApproved', 'emailOnPaymentReceived',
      'firebaseProject', 'useFirebase',
      'allowRegistration', 'freePlanEnabled', 'freeCharsLimit', 'freeFilesLimit',
      'maxFilesPerJob', 'maxFileSizeMB', 'plans', 'paymentMethods',
    ];
    plain.forEach(k => { if (b[k] !== undefined) DB.settings[k] = b[k]; });
    mask.forEach(k => { if (b[k] !== undefined && !sentinel.some(s => b[k].startsWith(s))) DB.settings[k] = b[k].trim(); });
    if (b.firebaseKey !== undefined && !b.firebaseKey.startsWith('•••')) DB.settings.firebaseKey = b.firebaseKey.trim();
    saveDB();
    json(res, 200, { ok: true });
  } catch (e) { json(res, 500, { error: e.message }); }
}

function hAdminUsers(req, res) {
  const u = mustAdmin(req, res); if (!u) return;
  json(res, 200, { users: Object.values(DB.users).map(safeUser) });
}

async function hAdminUpdateUser(req, res, userId) {
  const u = mustAdmin(req, res); if (!u) return;
  const t = DB.users[userId];
  if (!t) return json(res, 404, { error: 'User not found' });
  try {
    const b = await readJSON(req);
    if (b.plan)                   t.plan = b.plan;
    if (b.role && userId !== u.id) t.role = b.role;
    if (b.name)                   t.name = b.name;
    if (b.newPassword) {
      if (b.newPassword.length < 8) return json(res, 400, { error: 'Password too short' });
      const ns = crypto.randomBytes(16).toString('hex');
      t.salt = ns; t.passwordHash = hash(b.newPassword, ns);
      Object.keys(DB.sessions).forEach(s => { if (DB.sessions[s].userId === userId) delete DB.sessions[s]; });
    }
    saveDB();
    json(res, 200, { ok: true });
  } catch (e) { json(res, 500, { error: e.message }); }
}

function hAdminDeleteUser(req, res, userId) {
  const u = mustAdmin(req, res); if (!u) return;
  if (userId === u.id) return json(res, 400, { error: 'Cannot delete own account' });
  if (!DB.users[userId]) return json(res, 404, { error: 'User not found' });
  delete DB.users[userId];
  Object.keys(DB.sessions).forEach(t => { if (DB.sessions[t].userId === userId) delete DB.sessions[t]; });
  saveDB();
  json(res, 200, { ok: true });
}

function hAdminLogs(req, res) {
  const u = mustAdmin(req, res); if (!u) return;
  json(res, 200, { logs: (DB.activityLog || []).slice().reverse().slice(0, 200) });
}

function hAdminExportUsers(req, res) {
  const u = mustAdmin(req, res); if (!u) return;
  const rows = Object.values(DB.users).map(u2 => [u2.id, u2.name, u2.email, u2.role, u2.plan, u2.translations || 0, u2.words || 0, new Date(u2.createdAt).toISOString().slice(0, 10)].join(','));
  const csv  = 'ID,Name,Email,Role,Plan,Translations,Words,Created\n' + rows.join('\n');
  res.writeHead(200, { ...CORS, 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment;filename=users.csv' });
  res.end(csv);
}

// Test SMTP
async function hTestSmtp(req, res) {
  const u = mustAdmin(req, res); if (!u) return;
  try {
    const { to } = await readJSON(req);
    if (!to) return json(res, 400, { error: 'to email required' });
    await sendSmtp(to, 'اختبار SMTP — أمان',
      `<div style="font-family:sans-serif;padding:24px"><h2>✅ SMTP يعمل!</h2><p>تم إرسال هذا الإيميل من خادم أمان بنجاح.</p></div>`);
    json(res, 200, { ok: true, message: 'Email sent to ' + to });
  } catch (e) { json(res, 500, { error: e.message }); }
}

// Test Worker
async function hTestWorker(req, res) {
  const u = mustAdmin(req, res); if (!u) return;
  try {
    const wUrl = DB.settings.workerUrl;
    if (!wUrl) return json(res, 400, { error: 'Worker URL not set' });
    const parsed = new URL(wUrl.replace(/\/$/, '') + '/health');
    const isHttps = parsed.protocol === 'https:';
    const lib = isHttps ? https : require('http');
    const result = await new Promise((ok, fail) => {
      const req2 = lib.get({ hostname: parsed.hostname, port: parsed.port || (isHttps ? 443 : 80), path: parsed.pathname + (parsed.search || '') }, r => {
        let d = ''; r.on('data', c => d += c); r.on('end', () => { try { ok(JSON.parse(d)); } catch { ok({ raw: d }); } });
      });
      req2.on('error', fail);
      req2.setTimeout(10000, () => { req2.destroy(); fail(new Error('Worker timeout')); });
    });
    json(res, 200, { ok: true, workerResponse: result });
  } catch (e) { json(res, 500, { error: e.message }); }
}

// Test Firebase
async function hTestFirebase(req, res) {
  const u = mustAdmin(req, res); if (!u) return;
  try {
    _fbToken = null; // force re-auth
    const token = await getFirebaseToken();
    json(res, 200, { ok: true, message: 'Firebase auth OK', tokenLength: token.length });
  } catch (e) { json(res, 500, { error: e.message }); }
}

// Sync to Firebase
async function hFirebaseSync(req, res) {
  const u = mustAdmin(req, res); if (!u) return;
  try {
    await syncToFirebase();
    json(res, 200, { ok: true, message: 'Synced to Firebase' });
  } catch (e) { json(res, 500, { error: e.message }); }
}

// ═══════════════════════════════════════════════════════════════
// HANDLERS — NOTIFICATIONS / PAYMENTS
// ═══════════════════════════════════════════════════════════════
function hGetNotifs(req, res) {
  const u = mustAdmin(req, res); if (!u) return;
  json(res, 200, { notifications: (DB.notifications || []).slice().reverse() });
}

async function hSubmitPayment(req, res) {
  const u = mustAuth(req, res); if (!u) return;
  try {
    const b = await readJSON(req);
    if (!b.planId || !b.amount) return json(res, 400, { error: 'Missing fields' });
    if (!DB.notifications) DB.notifications = [];
    const notif = { id: uid(), type: 'payment', status: 'pending', userId: u.id, userName: u.name, userEmail: u.email, planId: b.planId, planName: b.planName, amount: b.amount, method: b.method, payerName: b.payerName, payerEmail: b.payerEmail, ref: b.ref || '', note: b.note || '', createdAt: now(), read: false };
    DB.notifications.push(notif);
    addLog('payment_submit', u.id, `Plan: ${b.planId}, ${b.amount}`);
    saveDB();
    if (DB.settings.emailOnPaymentReceived) {
      sendEmail(u.email, 'payment_received', { name: u.name, planName: b.planName, amount: b.amount, method: b.method }).catch(() => {});
    }
    json(res, 201, { ok: true, notifId: notif.id });
  } catch (e) { json(res, 500, { error: e.message }); }
}

async function hUpdateNotif(req, res, notifId) {
  const u = mustAdmin(req, res); if (!u) return;
  const notif = (DB.notifications || []).find(n => n.id === notifId);
  if (!notif) return json(res, 404, { error: 'Notification not found' });
  try {
    const b = await readJSON(req);
    if (b.status)           notif.status    = b.status;
    if (b.read !== undefined) notif.read    = b.read;
    if (b.adminNote)        notif.adminNote = b.adminNote;
    notif.updatedAt = now();
    if (b.status === 'approved' && notif.planId && notif.userId) {
      const target = DB.users[notif.userId];
      if (target) {
        target.plan = notif.planId;
        slog('Upgraded', target.email, '->', notif.planId);
        addLog('payment_approved', u.id, `User: ${notif.userEmail}`);
        if (DB.settings.emailOnPaymentApproved) {
          sendEmail(notif.userEmail, 'payment_approved', { name: notif.userName, planName: notif.planName, appUrl: `http://localhost:${PORT}/app` }).catch(() => {});
        }
      }
    }
    if (b.status === 'rejected') {
      addLog('payment_rejected', u.id, `User: ${notif.userEmail}`);
      sendEmail(notif.userEmail, 'payment_rejected', { name: notif.userName, planName: notif.planName, reason: b.adminNote || '' }).catch(() => {});
    }
    saveDB();
    json(res, 200, { ok: true });
  } catch (e) { json(res, 500, { error: e.message }); }
}

function hNotifCount(req, res) {
  const u = mustAdmin(req, res); if (!u) return;
  json(res, 200, { unread: (DB.notifications || []).filter(n => !n.read && n.status === 'pending').length });
}

// Public
function hPlans(req, res)  { json(res, 200, { plans: DB.settings.plans || [], paymentMethods: DB.settings.paymentMethods || [] }); }
function hHealth(req, res) { json(res, 200, { status: 'ok', version: '4.0.0', platform: process.platform, uptime: Math.round(process.uptime()), apiKeySet: !!DB.settings.geminiApiKey, model: DB.settings.geminiModel, smtpReady: smtpReady(), workerActive: !!(DB.settings.useWorker && DB.settings.workerUrl), firebaseActive: useFirebase() }); }

// ═══════════════════════════════════════════════════════════════
// ROUTER
// ═══════════════════════════════════════════════════════════════
const server = http.createServer(async (req, res) => {
  const { pathname } = url.parse(req.url, true);
  const M = req.method.toUpperCase();
  if (M === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
  if (!limitIP(req, res)) return;
  // slog(M, pathname);  // uncomment for verbose logging

  if (M === 'GET') {
    if (pathname === '/' || pathname === '/index.html') return serveHTML(res, 'index.html');
    if (pathname === '/app' || pathname === '/app.html') return serveHTML(res, 'app.html');
    if (pathname === '/pricing' || pathname === '/pricing.html') return serveHTML(res, 'pricing.html');
    if (pathname === '/admin' || pathname === '/admin.html') return serveHTML(res, 'admin.html');
  }

  let m;
  try {
    if (M==='POST' && pathname==='/api/auth/register')  return await hRegister(req,res);
    if (M==='POST' && pathname==='/api/auth/login')     return await hLogin(req,res);
    if (M==='POST' && pathname==='/api/auth/logout')    return hLogout(req,res);
    if (M==='GET'  && pathname==='/api/auth/me')        return hMe(req,res);
    if (M==='PUT'  && pathname==='/api/auth/profile')   return await hUpdateProfile(req,res);
    if (M==='GET'  && pathname==='/api/auth/history')   return hHistory(req,res);

    if (M==='POST' && pathname==='/api/translate/text')  return await hTranslateText(req,res);
    if (M==='POST' && pathname==='/api/translate/files') return await hTranslateFiles(req,res);

    if (M==='GET'    && (m=pathname.match(/^\/api\/jobs\/([a-f0-9]+)$/)))           { const u=mustAuth(req,res); if(!u)return; return hJobStatus(res,m[1],u); }
    if (M==='DELETE' && (m=pathname.match(/^\/api\/jobs\/([a-f0-9]+)$/)))            return hCancelJob(req,res,m[1]);
    if (M==='GET'    && (m=pathname.match(/^\/api\/download\/([a-f0-9]+)\/(.+)$/))) { const u=mustAuth(req,res); if(!u)return; return hDownloadOne(res,m[1],m[2],u); }
    if (M==='GET'    && (m=pathname.match(/^\/api\/download\/([a-f0-9]+)$/)))        { const u=mustAuth(req,res); if(!u)return; return hDownloadAll(res,m[1],u); }

    if (M==='GET'    && pathname==='/api/admin/stats')        return hAdminStats(req,res);
    if (M==='GET'    && pathname==='/api/admin/settings')     return hAdminSettings(req,res);
    if (M==='PUT'    && pathname==='/api/admin/settings')     return await hAdminSaveSettings(req,res);
    if (M==='GET'    && pathname==='/api/admin/users')        return hAdminUsers(req,res);
    if (M==='GET'    && pathname==='/api/admin/logs')         return hAdminLogs(req,res);
    if (M==='GET'    && pathname==='/api/admin/export-users') return hAdminExportUsers(req,res);
    if (M==='PUT'    && (m=pathname.match(/^\/api\/admin\/users\/([a-f0-9]+)$/)))  return await hAdminUpdateUser(req,res,m[1]);
    if (M==='DELETE' && (m=pathname.match(/^\/api\/admin\/users\/([a-f0-9]+)$/))) return hAdminDeleteUser(req,res,m[1]);

    if (M==='POST' && pathname==='/api/admin/test-smtp')     return await hTestSmtp(req,res);
    if (M==='POST' && pathname==='/api/admin/test-worker')   return await hTestWorker(req,res);
    if (M==='POST' && pathname==='/api/admin/test-firebase') return await hTestFirebase(req,res);
    if (M==='POST' && pathname==='/api/admin/firebase-sync') return await hFirebaseSync(req,res);

    if (M==='GET'  && pathname==='/api/plans')                   return hPlans(req,res);
    if (M==='GET'  && pathname==='/api/health')                  return hHealth(req,res);
    if (M==='GET'  && pathname==='/api/notifications')           return hGetNotifs(req,res);
    if (M==='GET'  && pathname==='/api/notifications/count')     return hNotifCount(req,res);
    if (M==='POST' && pathname==='/api/payments/submit')         return await hSubmitPayment(req,res);
    if (M==='PUT'  && (m=pathname.match(/^\/api\/notifications\/([a-f0-9_]+)$/))) return await hUpdateNotif(req,res,m[1]);

    json(res, 404, { error: 'Route not found: ' + pathname });
  } catch (e) {
    slog('ERROR:', e.message);
    json(res, 500, { error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════════════
async function start() {
  // Try to load from Firebase if configured
  if (useFirebase()) await loadFromFirebase();

  server.listen(PORT, '0.0.0.0' , () => {
    const line = '═'.repeat(44);
    console.log('\n  ' + line);
    console.log('  🛡️  Aman  v4.0  —  Full SaaS Server');
    console.log('  ' + line);
    console.log(`  🌐 http://localhost:${PORT}/`);
    console.log(`  📱 http://localhost:${PORT}/app`);
    console.log(`  💎 http://localhost:${PORT}/pricing`);
    console.log(`  🔐 http://localhost:${PORT}/admin`);
    console.log('  ' + line);
    console.log(`  API Key  : ${DB.settings.geminiApiKey ? '✅ SET' : '❌ NOT SET'}`);
    console.log(`  Worker   : ${DB.settings.useWorker && DB.settings.workerUrl ? '✅ ' + DB.settings.workerUrl.slice(0, 35) : '⬜ Direct'}`);
    console.log(`  SMTP     : ${smtpReady() ? '✅ ' + DB.settings.smtpHost : '⬜ Not configured'}`);
    console.log(`  Firebase : ${useFirebase() ? '✅ ' + DB.settings.firebaseProject : '⬜ Local JSON'}`);
    console.log('  ' + line);
    console.log('  Default admin: admin@aman.app / Admin@1234');
    console.log('  ' + line + '\n');
  });
}

start();
module.exports = server;
