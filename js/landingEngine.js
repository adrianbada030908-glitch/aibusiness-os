import { appState, setLandingStyle } from './state.js';
import { setLandingTab } from './router.js';

function esc(text) {
  return String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderLandingCopy() {
  const preview = document.getElementById('landing-copy-preview');
  if (!preview) return;

  const copyObject = appState.finalCopy;
  const rawText = appState.finalCopyRaw || '';

  if (!copyObject && !rawText) {
    preview.textContent = 'No hay copy disponible.';
    return;
  }

  if (!copyObject && rawText) {
    preview.textContent = rawText;
    return;
  }

  const bonuses = Array.isArray(copyObject.offer_stack?.bonuses)
    ? copyObject.offer_stack.bonuses
    : [];

  preview.innerHTML = `
    <div class="landing-copy-preview-inner">
      <h3>${esc(copyObject.headline)}</h3>
      <p>${esc(copyObject.subheadline)}</p>
      <p><strong>Mecanismo único:</strong> ${esc(copyObject.mechanism)}</p>
      <p><strong>Producto:</strong> ${esc(copyObject.offer_stack?.product)}</p>
      ${bonuses.length ? `<div><strong>Bonos:</strong><ul>${bonuses.map(b => `<li>${esc(b)}</li>`).join('')}</ul></div>` : ''}
      <p><strong>CTA:</strong> ${esc(copyObject.cta)}</p>
    </div>
  `;
}

export function renderFinalLandingPage() {
  const panel = document.getElementById('panel-landing-generator');
  if (!panel) return;

  const copyObject = appState.finalCopy;
  const bonuses = Array.isArray(copyObject?.offer_stack?.bonuses)
    ? copyObject.offer_stack.bonuses
    : [];
  const productLine = esc(copyObject?.offer_stack?.product);
  const styleLabel = esc(appState.landingStyle || 'minimalista');

  panel.innerHTML = `
    <div class="final-landing">
      <div class="final-landing-header">
        <div class="final-landing-style">Estilo: ${styleLabel}</div>
        <h2>${esc(copyObject?.headline)}</h2>
        <p class="muted">${esc(copyObject?.subheadline)}</p>
      </div>
      <div class="final-landing-body">
        <p><strong>Mecanismo único:</strong> ${esc(copyObject?.mechanism)}</p>
        ${productLine ? `<p><strong>Producto:</strong> ${productLine}</p>` : ''}
        ${bonuses.length ? `<div><strong>Bonos:</strong><ul>${bonuses.map(b => `<li>${esc(b)}</li>`).join('')}</ul></div>` : ''}
      </div>
      <div class="final-landing-cta">
        <button class="btn btn-primary" onclick="volverALanding()">← Volver</button>
      </div>
    </div>
  `;
}

export function volverALanding() {
  setLandingTab('copy');
  renderLandingCopy();
}
