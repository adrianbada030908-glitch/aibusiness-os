import { sanitizeJsonResponse } from './parser.js';

// Función para generar el prompt basado en el estilo seleccionado
export function getPromptForStyle(niche, style, data = {}) {
  const estilos = {
    'autoridad': "Enfócate en la experiencia, la lógica de negocio y la autoridad. Usa un tono profesional y directo.",
    'dolor': "Enfócate en el dolor del problema actual y cómo tu solución es la única salida. Tono persuasivo y empático.",
    'oferta': "Enfócate en la velocidad, facilidad y el valor del precio. Tono de urgencia y oportunidad única.",
    'visionario': "Enfócate en la transformación personal y los sueños del cliente. Tono inspirador y aspiracional.",
    'social': "Enfócate en la validación social, números de éxito y satisfacción de otros clientes. Tono seguro y confiable."
  };

  const selectedStyleDesc = estilos[style] || estilos['autoridad'];

  return `
    Actúa como un copywriter experto en respuesta directa. 
    Tu objetivo es escribir una landing page de alta conversión para un nicho de: "${niche}".
    
    Estilo a seguir: ${selectedStyleDesc}
    
    IMPORTANTE: Debes devolver el contenido ÚNICAMENTE en formato JSON, sin texto adicional, sin introducciones, sin bloques de código si es posible. El JSON debe seguir exactamente esta estructura:
    {
        "hero_title": "Título impactante",
        "unique_mechanism": "Subtítulo de propuesta de valor",
        "pain_points": ["punto de dolor 1", "punto de dolor 2"],
        "offer": {
            "main_product": "Nombre del producto",
            "bonuses": ["bono 1", "bono 2"],
            "price_original": "precio original",
            "price_discount": "precio con descuento"
        },
        "guarantee": "Garantía de satisfacción",
        "cta_button": "Texto para el botón de llamada a la acción"
    }
  `;
}

const WORKER_URL = 'https://aibusiness.adrianbada0309.workers.dev';

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

export async function generarIA(prompt, options = {}, retries = 3, delay = 2000) {
  const { temperature = 0.8, maxTokens = 4096, timeoutMs = 45000 } = options;

  for (let i = 0; i < retries; i++) {
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
        // Si es un error de alta demanda, reintentamos después de una espera
        if (message.includes('high demand') && i < retries - 1) {
          console.warn(`Intento ${i + 1} fallido por alta demanda. Reintentando en ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw new Error(message || `IA error ${response.status}`);
      }

      const payload = await response.json().catch(async () => ({ text: await response.text() }));
      let finalContent;
      if (payload && typeof payload === 'object' && 'text' in payload) {
        finalContent = payload.text;
      } else if (typeof payload === 'string') {
        finalContent = payload;
      } else {
        finalContent = JSON.stringify(payload);
      }
      
      // Aplicar sanitización robusta
      const sanitized = sanitizeJsonResponse(finalContent);
      try {
        return JSON.parse(sanitized);
      } catch (e) {
        console.error("Error al parsear JSON de la IA:", e, "Contenido:", sanitized);
        throw new Error("La IA no devolvió un formato JSON válido.");
      }
    } catch (error) {
      clearTimeout(timeout);
      if (error.name === 'AbortError') {
        if (i < retries - 1) {
          console.warn(`Intento ${i + 1} fallido por timeout. Reintentando...`);
          continue;
        }
        throw new Error('La solicitud a la IA excedió el tiempo.');
      }
      throw error;
    }
  }
}
