const WORKER_URL = 'https://aibusiness-proxy.adrianbada0309.workers.dev';

async function parseProxyError(res) {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const body = await res.json().catch(() => null);
    if (body) {
      if (body.error) return body.error;
      if (body.message) return body.message;
      return JSON.stringify(body);
    }
  }
  const text = await res.text().catch(() => '');
  return text || `Error ${res.status}`;
}

export async function generarIA(prompt, options = {}) {
  const { temperature = 0.8, maxTokens = 4096, timeoutMs = 45000 } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, temperature, maxTokens }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!response.ok) {
      const message = await parseProxyError(response);
      throw new Error(message || `IA error ${response.status}`);
    }

    const payload = await response.json().catch(async () => ({ text: await response.text() }));
    if (payload && typeof payload === 'object' && 'text' in payload) {
      return payload.text;
    }
    if (typeof payload === 'string') {
      return payload;
    }
    return JSON.stringify(payload);
  } catch (error) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      throw new Error('La solicitud a la IA excedió el tiempo.');
    }
    throw error;
  }
}
