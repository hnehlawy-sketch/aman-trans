/**
 * ═══════════════════════════════════════════════════════════════
 *   Aman AI Worker  v1.0  —  Cloudflare Worker
 *   Acts as a proxy between Aman server and Google Gemini API
 *   Bypasses country-level blocks on generativelanguage.googleapis.com
 *   Deploy: wrangler deploy  OR  paste into workers.dev dashboard
 * ═══════════════════════════════════════════════════════════════
 *
 *  ENV VARIABLES (set in Cloudflare dashboard or wrangler.toml):
 *    AMAN_SECRET   - shared secret between your server and this worker
 *                    (prevents unauthorized use of your worker)
 *
 *  HOW IT WORKS:
 *    Your Node server  →  POST https://your-worker.workers.dev/translate
 *    Worker            →  POST https://generativelanguage.googleapis.com/...
 *    Response flows back transparently
 *
 *  REQUEST FORMAT (from your Node server):
 *    POST /translate
 *    Headers:
 *      Content-Type: application/json
 *      X-Aman-Secret: <AMAN_SECRET>
 *    Body:
 *      {
 *        "apiKey": "AIzaSy...",
 *        "model": "gemini-2.5-flash",
 *        "system": "You are a translator...",
 *        "user": "Translate:\n\nHello world",
 *        "maxTokens": 8192
 *      }
 *
 *  RESPONSE:
 *    { "text": "مرحبا بالعالم", "model": "gemini-2.5-flash", "via": "worker" }
 *    OR on error:
 *    { "error": "..." }
 * ═══════════════════════════════════════════════════════════════
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ── CORS ──────────────────────────────────────────────────────
    const corsHeaders = {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Aman-Secret',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // ── Health check ──────────────────────────────────────────────
    if (url.pathname === '/health' && request.method === 'GET') {
      return Response.json({ status: 'ok', worker: 'aman-ai', ts: Date.now() }, { headers: corsHeaders });
    }

    // ── Main translate endpoint ───────────────────────────────────
    if (url.pathname === '/translate' && request.method === 'POST') {
      // Verify secret
      const secret = request.headers.get('X-Aman-Secret');
      if (env.AMAN_SECRET && secret !== env.AMAN_SECRET) {
        return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: 'Invalid JSON body' }, { status: 400, headers: corsHeaders });
      }

      const { apiKey, model = 'gemini-2.5-flash', system, user, maxTokens = 8192 } = body;

      if (!apiKey) return Response.json({ error: 'apiKey required' }, { status: 400, headers: corsHeaders });
      if (!user)   return Response.json({ error: 'user text required' }, { status: 400, headers: corsHeaders });

      // Build Gemini request
      const geminiBody = {
        system_instruction: system ? { parts: [{ text: system }] } : undefined,
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: maxTokens,
          responseMimeType: 'text/plain',
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
      };

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      try {
        // Workers have no 90s timeout issue — they use streaming/subrequests
        const resp = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiBody),
        });

        const data = await resp.json();

        if (data.error) {
          return Response.json(
            { error: `Gemini: ${data.error.message || JSON.stringify(data.error)}` },
            { status: resp.status, headers: corsHeaders }
          );
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
          const reason = data.candidates?.[0]?.finishReason || 'unknown';
          return Response.json(
            { error: `Gemini empty response (reason: ${reason})` },
            { status: 500, headers: corsHeaders }
          );
        }

        return Response.json({ text: text.trim(), model, via: 'worker' }, { headers: corsHeaders });

      } catch (err) {
        return Response.json(
          { error: `Worker fetch error: ${err.message}` },
          { status: 502, headers: corsHeaders }
        );
      }
    }

    return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
  }
};
