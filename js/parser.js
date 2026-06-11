/**
 * Sanitiza la respuesta de la IA extrayendo el bloque JSON,
 * incluso si viene envuelto en markdown o texto conversacional.
 */
function sanitizeJsonResponse(text) {
  if (typeof text !== 'string') return null;

  // 1. Intenta buscar el bloque dentro de ```json ... ```
  const markdownMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (markdownMatch && markdownMatch[1]) {
    return markdownMatch[1].trim();
  }

  // 2. Fallback: Intenta encontrar el primer '{' y el último '}'
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    return text.substring(start, end + 1).trim();
  }

  // 3. Si parece que ya es un JSON puro, devuélvelo
  return text.trim();
}


// Exposición global
window.sanitizeJsonResponse = sanitizeJsonResponse;
