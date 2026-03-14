/**
 * ═══════════════════════════════════════════════════════════════
 *   Aman AI Worker  —  Deno Deploy
 *   وسيط بين خادم Aman و Google Gemini API
 *   يتجاوز الحظر الجغرافي على generativelanguage.googleapis.com
 *
 *   النشر على Deno Deploy (مجاني):
 *   1. اذهب إلى https://dash.deno.com
 *   2. New Project → Deploy URL → الصق رابط هذا الملف
 *      أو: اربط GitHub repo
 *   3. أضف Environment Variable:
 *      AMAN_SECRET = أي نص سري طويل
 *   4. انسخ رابط الـ Worker (مثل: https://xxx.deno.dev)
 *   5. ضعه في لوحة الإدارة → إعدادات AI → Worker URL
 * ═══════════════════════════════════════════════════════════════
 */

const GEMINI_BASE = "https://generativelanguage.googleapis.com";

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Aman-Secret",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  const url = new URL(req.url);

  // ── Health ────────────────────────────────────────────────────
  if (url.pathname === "/health") {
    return Response.json(
      { status: "ok", worker: "aman-deno", ts: Date.now() },
      { headers: cors }
    );
  }

  // ── Translate ─────────────────────────────────────────────────
  if (url.pathname === "/translate" && req.method === "POST") {
    // Verify secret
    const secret = req.headers.get("X-Aman-Secret");
    const envSecret = Deno.env.get("AMAN_SECRET");
    if (envSecret && secret !== envSecret) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: cors });
    }

    let body: {
      apiKey: string;
      model?: string;
      system?: string;
      user: string;
      maxTokens?: number;
    };

    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400, headers: cors });
    }

    const {
      apiKey,
      model = "gemini-2.5-flash",
      system,
      user,
      maxTokens = 8192,
    } = body;

    if (!apiKey) return Response.json({ error: "apiKey required" }, { status: 400, headers: cors });
    if (!user)   return Response.json({ error: "user text required" }, { status: 400, headers: cors });

    const geminiPayload = {
      ...(system ? { system_instruction: { parts: [{ text: system }] } } : {}),
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: maxTokens,
        responseMimeType: "text/plain",
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH",       threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
      ],
    };

    const geminiUrl =
      `${GEMINI_BASE}/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
      const upstream = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiPayload),
      });

      const data = await upstream.json();

      if (data.error) {
        return Response.json(
          { error: `Gemini: ${data.error.message ?? JSON.stringify(data.error)}` },
          { status: upstream.status, headers: cors }
        );
      }

      const text: string | undefined =
        data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        const reason = data.candidates?.[0]?.finishReason ?? "unknown";
        return Response.json(
          { error: `Empty response (reason: ${reason})` },
          { status: 500, headers: cors }
        );
      }

      return Response.json(
        { text: text.trim(), model, via: "deno-worker" },
        { headers: cors }
      );

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return Response.json(
        { error: `Worker error: ${msg}` },
        { status: 502, headers: cors }
      );
    }
  }

  return Response.json({ error: "Not found" }, { status: 404, headers: cors });
});
