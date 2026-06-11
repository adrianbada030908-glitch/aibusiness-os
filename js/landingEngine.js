import { appState, setLandingStyle } from './state.js';


function _escLanding(text) {
  return String(text || '').replace(/[&<>'"]/g, match => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'}[match]));
}

// ── TAREA 3: renderLandingCopy — inyecta cada campo del objeto JSON ──────────
function renderLandingCopy() {
  const preview = document.getElementById('copy-preview');
  if (!preview) return;

  const d = appState.finalCopy;
  const rawText = appState.finalCopyRaw || '';

  if (!d && !rawText) {
    preview.textContent = 'No hay copy disponible.';
    return;
  }

  // Si solo hay texto crudo (sin objeto estructurado), mostrar como texto
  if (!d && rawText) {
    preview.textContent = rawText;
    return;
  }

  const obj = typeof d === 'object' ? d : { hero_title: String(d) };

  const painHtml = Array.isArray(obj.pain_points) && obj.pain_points.length
    ? `<ul>${obj.pain_points.map(p => `<li>${_escLanding(p)}</li>`).join('')}</ul>`
    : '';

  const bonusHtml = Array.isArray(obj.offer?.bonuses) && obj.offer.bonuses.length
    ? `<ul>${obj.offer.bonuses.map((b, i) => `<li><strong>Bono ${i + 1}:</strong> ${_escLanding(b)}</li>`).join('')}</ul>`
    : '';

  const priceOrig = obj.offer?.price_original ? `$${obj.offer.price_original}` : '';
  const priceDsc  = obj.offer?.price_discount  ? `$${obj.offer.price_discount}`  : '';

  preview.innerHTML = `
    <div class="landing-copy-preview-inner">
      <h3>${_escLanding(obj.hero_title)}</h3>
      ${painHtml ? `<p><strong>Dolores del cliente:</strong></p>${painHtml}` : ''}
      <p><strong>Mecanismo único:</strong> ${_escLanding(obj.unique_mechanism)}</p>
      <p><strong>Producto:</strong> ${_escLanding(obj.offer?.main_product)}</p>
      ${bonusHtml ? `<p><strong>Bonos:</strong></p>${bonusHtml}` : ''}
      ${priceOrig ? `<p><s style="opacity:.5">${priceOrig}</s> → <strong>${priceDsc}</strong></p>` : ''}
      <p><strong>Garantía:</strong> ${_escLanding(obj.guarantee)}</p>
      <p><strong>CTA:</strong> ${_escLanding(obj.cta_button)}</p>
    </div>
  `;
}

// ── TAREA 3: renderFinalLandingPage — inyecta cada campo en el panel ─────────
function renderFinalLandingPage() {
  const panel = document.getElementById('panel-landing-generator');
  if (!panel) return;

  const d = appState.finalCopy;
  const obj = (d && typeof d === 'object') ? d : {};

  const styleLabel = _escLanding(appState.landingStyle || 'minimalista');

  const bonusHtml = Array.isArray(obj.offer?.bonuses) && obj.offer.bonuses.length
    ? `<ul>${obj.offer.bonuses.map((b, i) => `<li><strong>Bono ${i + 1}:</strong> ${_escLanding(b)}</li>`).join('')}</ul>`
    : '';

  const priceOrig = obj.offer?.price_original ? `$${obj.offer.price_original}` : '';
  const priceDsc  = obj.offer?.price_discount  ? `$${obj.offer.price_discount}`  : '';

  panel.innerHTML = `
    <div class="final-landing">
      <div class="final-landing-header">
        <div class="final-landing-style">Estilo: ${styleLabel}</div>
        <h2>${_escLanding(obj.hero_title)}</h2>
        <p class="muted">${_escLanding(obj.unique_mechanism)}</p>
      </div>
      <div class="final-landing-body">
        ${obj.offer?.main_product ? `<p><strong>Producto:</strong> ${_escLanding(obj.offer.main_product)}</p>` : ''}
        ${bonusHtml ? `<div><strong>Bonos:</strong>${bonusHtml}</div>` : ''}
        ${priceOrig ? `<p><s style="opacity:.5">${priceOrig}</s> → <strong>${priceDsc}</strong></p>` : ''}
        ${obj.guarantee ? `<p><strong>Garantía:</strong> ${_escLanding(obj.guarantee)}</p>` : ''}
      </div>
      <div class="final-landing-cta">
        <button class="btn btn-primary" onclick="volverALanding()">← Volver</button>
      </div>
    </div>
  `;
}

function volverALanding() {
  setLandingTab('copy');
  renderLandingCopy();
}


// Exposición global
window.renderLandingCopy = renderLandingCopy;
window.renderFinalLandingPage = renderFinalLandingPage;
window.volverALanding = volverALanding;

window._escLanding = _escLanding;
