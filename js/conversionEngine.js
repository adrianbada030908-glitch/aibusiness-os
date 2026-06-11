

function normalizeCopy(rawResponse) {
  if (!rawResponse) {
    return {
      headline: 'Titular aún no generado',
      subheadline: '',
      mechanism: '',
      offer_stack: { product: '', bonuses: [] },
      cta: 'Comprar ahora',
    };
  }

  if (typeof rawResponse === 'object') {
    return {
      headline: rawResponse.headline || rawResponse.titulo || '',
      subheadline: rawResponse.subheadline || rawResponse.subtitulo || '',
      mechanism: rawResponse.mechanism || rawResponse.mecanismo || '',
      offer_stack: {
        product: rawResponse.offer_stack?.product || rawResponse.producto || '',
        bonuses: Array.isArray(rawResponse.offer_stack?.bonuses)
          ? rawResponse.offer_stack.bonuses
          : rawResponse.offer_stack?.bonuses
            ? [String(rawResponse.offer_stack.bonuses)]
            : [],
      },
      cta: rawResponse.cta || rawResponse.llamada || rawResponse.call_to_action || '',
    };
  }

  const text = String(rawResponse).trim();
  try {
    const parsed = JSON.parse(text);
    return normalizeCopy(parsed);
  } catch (e) {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return normalizeCopy(parsed);
      } catch (err) {
        // continue to fallback
      }
    }
  }

  const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const kv = {};
  lines.forEach(line => {
    const match = line.match(/^\s*[-*]?\s*([^:]+):\s*(.+)$/);
    if (match) {
      kv[match[1].trim().toLowerCase().replace(/\s+/g, '_')] = match[2].trim();
    }
  });

  const fallback = {
    headline: kv.headline || kv.titulo || lines[0] || 'Landing generada',
    subheadline: kv.subheadline || kv.subtitulo || lines[1] || '',
    mechanism: kv.mechanism || kv.mecanismo || lines[2] || '',
    offer_stack: {
      product: kv.product || kv.producto || lines.slice(3, 6).join(' ') || '',
      bonuses: [],
    },
    cta: kv.cta || kv.llamada || kv.call_to_action || 'Comprar ahora',
  };

  const bonusesRaw = kv.bonuses || kv.bonos || kv.bonus;
  if (bonusesRaw) {
    fallback.offer_stack.bonuses = bonusesRaw.split(/[;,]\s*/).map(s => s.trim()).filter(Boolean);
  }

  return fallback;
}

function buildPrompt(producto) {
  return `Actúa como un Copywriter de Respuesta Directa de élite.

Toma este JSON del usuario:
${JSON.stringify(producto, null, 2)}

Genera un copy perfectamente estructurado para una Landing Page y devuélvelo únicamente como JSON válido. No incluyas texto fuera del JSON ni markdown.

ESTRUCTURA OBLIGATORIA PARA EL JSON:
{
  "headline": "Título potente: Promesa principal que elimina el mayor dolor del padre (máximo 15 palabras)",
  "subheadline": "Descripción breve del método (mecanismo) y beneficio principal (2 frases máximo)",
  "mechanism": "Explicación breve del 'cómo' del método (mecanismo único, simple y lógico)",
  "offer_stack": {
    "product": "Nombre del producto principal + Formato (Ebook/Video)",
    "bonuses": [
      "Bono 1: Nombre atractivo enfocado en beneficio",
      "Bono 2: Nombre atractivo enfocado en beneficio",
      "Bono 3: Nombre atractivo enfocado en beneficio"
    ]
  },
  "cta": "Llamado a la acción: Verbo de acción + Beneficio (ej: 'Quiero mi tranquilidad ahora')"
}
`;
}

async function generarCopyDesdeProducto(producto) {
  const prompt = buildPrompt(producto);
  const response = await generarIA(prompt, { temperature: 0.8, maxTokens: 4096 });
  return normalizeCopy(response);
}


// Exposición global
window.generarCopyDesdeProducto = generarCopyDesdeProducto;
window.normalizeCopy = normalizeCopy;
window.buildPrompt = buildPrompt;
