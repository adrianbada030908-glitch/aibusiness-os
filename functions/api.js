// ═══════════════════════════════════════════════════════════════════════════
// AI Business OS — Cloudflare Pages Function (/api)
// Proxy a Gemini API con rate limiting
// ═══════════════════════════════════════════════════════════════════════════

// Configuración
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Límites por plan (free por defecto)
const LIMITS = {
  free: { daily: 5, monthly: 30 },
};

// ═══════════════════════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════════════════════

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

function errorResponse(message, status = 500) {
  return jsonResponse({ error: true, message }, status);
}

function getUserId(request) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const ua = request.headers.get('User-Agent') || '';
  const raw = `${ip}:${ua}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `user_${Math.abs(hash).toString(36)}`;
}

function getTodayKey(userId) {
  const today = new Date().toISOString().split('T')[0];
  return `usage:${userId}:${today}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// RATE LIMITING (sin KV — usando contador en memoria por request)
// ═══════════════════════════════════════════════════════════════════════════

async function checkRateLimit(userId, env) {
  const limits = LIMITS.free;
  const todayKey = getTodayKey(userId);

  // Si tenés KV configurado, usalo. Si no, permitimos siempre (el frontend controla)
  let dailyCount = 0;
  if (env.USAGE_KV) {
    dailyCount = parseInt(await env.USAGE_KV.get(todayKey) || '0');
  }

  if (dailyCount >= limits.daily) {
    return { allowed: false, daily: dailyCount, limit: limits.daily };
  }

  return { allowed: true, daily: dailyCount, limit: limits.daily };
}

async function incrementUsage(userId, env) {
  const todayKey = getTodayKey(userId);
  let dailyCount = 0;

  if (env.USAGE_KV) {
    dailyCount = parseInt(await env.USAGE_KV.get(todayKey) || '0');
    await env.USAGE_KV.put(todayKey, String(dailyCount + 1), { expirationTtl: 172800 });
  }

  return { daily: dailyCount + 1 };
}

// ═══════════════════════════════════════════════════════════════════════════
// GEMINI API
// ═══════════════════════════════════════════════════════════════════════════

async function callGemini(prompt, temperature, maxTokens, apiKey) {
  const url = `${GEMINI_API_URL}?key=${apiKey}`;

  const body = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature: temperature || 0.8,
      maxOutputTokens: maxTokens || 4096,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  let text = '';
  if (data.candidates && data.candidates[0] && data.candidates[0].content) {
    text = data.candidates[0].content.parts.map(p => p.text).join('');
  }

  return text;
}

// ═══════════════════════════════════════════════════════════════════════════
// HANDLER
// ═══════════════════════════════════════════════════════════════════════════

export async function onRequest(context) {
  const { request, env } = context;

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (request.method !== 'POST') {
    return errorResponse('Método no permitido. Usá POST.', 405);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { systemPrompt, prompt, temperature, maxTokens } = body;

    if (!prompt || typeof prompt !== 'string') {
      return errorResponse('Falta el campo "prompt" en el body.', 400);
    }

    // Combinar el systemPrompt con el prompt del usuario
    const finalPrompt = systemPrompt ? `${systemPrompt}\n\nUser Request:\n${prompt}` : prompt;

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return errorResponse('GEMINI_API_KEY no configurada en el Worker.', 500);
    }

    const userId = getUserId(request);
    const rateCheck = await checkRateLimit(userId, env);

    if (!rateCheck.allowed) {
      return errorResponse(
        `Límite diario alcanzado. Usos: ${rateCheck.daily}/${rateCheck.limit}.`,
        429
      );
    }

    const result = await callGemini(finalPrompt, temperature, maxTokens, apiKey);
    const usage = await incrementUsage(userId, env);

    return jsonResponse({
      text: result,
      usage: {
        daily: usage.daily,
        limit: rateCheck.limit,
      },
    });

  } catch (error) {
    console.error('Worker error:', error);
    return errorResponse(error.message || 'Error interno del servidor', 500);
  }
}
