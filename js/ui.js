import { appState, setFinalCopy, setLandingStyle } from './state.js';
import { goStep as routerGoStep, goHome as routerGoHome, setLandingTab as routerSetLandingTab, activarPanel } from './router.js';
import { generarIA as apiGenerarIA } from './api.js';
import { generarCopyDesdeProducto as conversionGenerarCopyDesdeProducto } from './conversionEngine.js';
import { generarProducto as productGenerarProducto, asignarProductoFinal } from './productEngine.js';
import { renderLandingCopy as landingRenderLandingCopy, renderFinalLandingPage as landingRenderFinalLandingPage, volverALanding as landingVolverALanding } from './landingEngine.js';

const generarIA = apiGenerarIA;

const esc = (str) => String(str || '').replace(/[&<>'"]/g, match => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'}[match]));

function attachModuleGlobals() {
  const names = [
    'goStep','goHome','setLandingTab','activarPanel','generarIA','generarCopyDesdeProducto','generarProducto','asignarProductoFinal',
    'renderLandingCopy','renderFinalLandingPage','volverALanding','descargarIndexHTML','authTab','authSubmit','toggleApiKeyVisibility','saveApiKey','onApiKeyInput','hideApiKeySetup',
    'authLogout','toggleAvatarMenu','closeAvatarMenu','abrirSoporte','openGuidedMode','closeGuidedMode','setSubcat','trendHunterAI',
    'generarContenido','generarAnuncios','generarEmails','generarTraficoGratis','generarTraficoPremium','descargarEstrategiaPDF','convertirTextoAHTML','generarLanding','usarProductoEnLanding','usarEnLandingPage',
    'enviarCopyAlGenerador','togglePbSection','exportarProductoPDF','guidedLoadNichos','guidedLoadAvatars','guidedNext','guidedBack',
    'guidedLoadProductos','selectAvatar','selectProducto','selectNicho','copyText','copyAdCard','markDone','buildChips','initLandingGenerator','initLandingGeneratorEvents',
    'initEditor','applyDynamicYears','updateApiIndicator','initDashboard','updateUsageDisplay','updateAvatarRing','showApp',
    'selectEstrategia','guidedLoadEstrategias','runConversionEngine','activateLandingFromEngine'
  ];

  // funciones importadas
  try { if (typeof routerGoStep === 'function') window.goStep = routerGoStep; } catch(e){}
  try { if (typeof routerGoHome === 'function') window.goHome = routerGoHome; } catch(e){}
  try { if (typeof routerSetLandingTab === 'function') window.setLandingTab = routerSetLandingTab; } catch(e){}
  try { if (typeof activarPanel === 'function') window.activarPanel = activarPanel; } catch(e){}
  try { if (typeof apiGenerarIA === 'function') window.generarIA = apiGenerarIA; } catch(e){}

  // adjuntar dinámicamente si existen en este módulo
  names.forEach(n => {
    try {
      if (typeof window[n] === 'undefined') {
        const fn = eval(n);
        if (typeof fn === 'function') window[n] = fn;
      }
    } catch (e) {
      console.warn('No se pudo asignar a window:', n, e);
    }
  });
}

// ─── Fecha / año dinámico (siempre el momento de uso) ─────────────────────────
function getAppYear() {
  return new Date().getFullYear();
}

function getAppDateLabel() {
  return new Date().toLocaleDateString('es', { year: 'numeric', month: 'long', day: 'numeric' });
}

function withDateContext(systemPrompt) {
  const y = getAppYear();
  return `${systemPrompt.trim()}

CONTEXTO TEMPORAL (obligatorio):
- Fecha de uso: ${getAppDateLabel()}.
- Año actual: ${y}. Referencias a "este año", tendencias, algoritmos, plataformas y datos del mercado deben ser de ${y}.
- No cites años pasados como presente (2023, 2024, 2025, etc.) salvo comparación histórica explícita.`;
}

function applyDynamicYears() {
  document.querySelectorAll('[data-current-year]').forEach(el => {
    el.textContent = getAppYear();
  });
}

/* ------------------------------------------------------------------
   waitForClaude — helper de sincronización (resuelve inmediato)
   Claude ya está disponible vía callClaudeRaw, no hace falta esperar
   ------------------------------------------------------------------ */
function waitForClaude() {
  return Promise.resolve();
}

// ─── API Key Setup ────────────────────────────────────────────────────────────
function getApiKey() {
  return localStorage.getItem('gemini_api_key') || '';
}

function showApiKeySetup() {
  const overlay = document.getElementById('setup-overlay');
  if (overlay) overlay.classList.add('visible');
  const existing = getApiKey();
  if (existing) {
    const input = document.getElementById('api-key-input');
    input.value = existing;
  }
  updateApiIndicator();
}

function hideApiKeySetup() {
  const overlay = document.getElementById('setup-overlay');
  if (overlay) overlay.classList.remove('visible');
}

function onApiKeyInput(el) {
  const btn = document.getElementById('btn-save-key');
  if (!btn) return;
  btn.disabled = !el.value || el.value.trim().length === 0;
}

function saveApiKey() {
  const input = document.getElementById('api-key-input');
  if (!input) return;
  const v = input.value.trim();
  if (!v) return;
  localStorage.setItem('gemini_api_key', v);
  updateApiIndicator();
  hideApiKeySetup();
}

function toggleApiKeyVisibility() {
  const input = document.getElementById('api-key-input');
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
  const eye = document.getElementById('eye-btn');
  if (eye) eye.textContent = input.type === 'password' ? '👁️' : '🙈';
}

function updateApiIndicator() {
  const key = getApiKey();
  const dot = document.getElementById('api-dot');
  const text = document.getElementById('api-indicator-text');
  if (!dot || !text) return;
  if (key) {
    dot.className = 'dot-status ok';
    text.textContent = 'API conectada · ' + key.substring(0,8) + '···  (cambiar)';
  } else {
    dot.className = 'dot-status missing';
    text.textContent = '⚠️ Conectá tu API key para empezar';
  }
}

// Close overlay clicking outside
const _setupOverlayEl = document.getElementById('setup-overlay');
if (_setupOverlayEl) {
  _setupOverlayEl.addEventListener('click', function(e) {
    if (e.target === this && getApiKey()) hideApiKeySetup();
  });
}

// ─── State ───────────────────────────────────────────────────────────────────
const state = appState;

const doneSteps = new Set();

// ─── Chips data ──────────────────────────────────────────────────────────────
const nichos = ['💰 Finanzas personales','💪 Fitness / Bajar de peso','🧘 Bienestar mental','💑 Relaciones','👩‍🍳 Cocina saludable','📈 Emprendimiento','🎓 Aprendizaje / Idiomas','💆 Productividad','👶 Crianza','✨ Belleza natural'];
const platforms = ['TikTok','Instagram Reels','YouTube Shorts','Pinterest','Facebook'];
const contentTypes = ['Antes/Después del resultado','Tip rápido de valor','Historia de transformación','"Errores que cometen todos"','Revelación de secreto','Testimonio dramatizado'];
const adTypes = ['Imagen estática + texto','Video (guión UGC)','Video (voz en off)','Carrusel de imágenes'];

function buildChips(containerId, items, stateKey, defaultVal) {
  const c = document.getElementById(containerId);
  if (!c) return;
  c.innerHTML = '';
  items.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'chip' + (item === defaultVal ? ' selected' : '');
    btn.textContent = item;
    btn.onclick = () => {
      c.querySelectorAll('.chip').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state[stateKey] = item;
    };
    c.appendChild(btn);
  });
}

// ─── Navigation ──────────────────────────────────────────────────────────────
// ── Dashboard Home ────────────────────────────────────────────────────────────
const DASH_TIPS = [
  'Empieza por el Trend Hunter — un buen nicho vale más que el mejor producto.',
  'El hook es el 80% de un video viral. Dedícale el doble de tiempo.',
  'Una landing page con 1 solo CTA convierte hasta 3x más que una con múltiples.',
  'El email marketing sigue siendo el canal con mayor ROI: $36 por cada $1 invertido.',
  'Valida antes de crear. Vende la idea antes de construir el producto.',
  'Los testimonios específicos con resultados concretos convierten 5x más que los genéricos.',
  'El nicho dentro del nicho siempre gana. "Finanzas para mamás solteras" > "Finanzas personales".',
  'Publica contenido orgánico 21 días seguidos antes de invertir en ads.',
  'El precio psicológico óptimo para infoproductos en LATAM: $27, $47 o $97.',
  'Un buen guarantee elimina el 60% de las objeciones de compra.',
];

function initDashboard() {
  // Saludo según hora
  const h = new Date().getHours();
  const greet = h < 12 ? 'Buenos días' : h < 18 ? 'Buenas tardes' : 'Buenas noches';
  const greetEl = document.getElementById('dash-greeting');
  if (greetEl && currentUser?.email) {
    greetEl.textContent = greet + ', ' + currentUser.email.split('@')[0] + ' 👋';
  } else if (greetEl) {
    greetEl.textContent = greet + ' 👋';
  }

  // Tip aleatorio del día (seed por fecha para que sea consistente)
  const tipEl = document.getElementById('dash-tip-text');
  if (tipEl) {
    const seed = new Date().getDate() % DASH_TIPS.length;
    tipEl.textContent = DASH_TIPS[seed];
  }

  // Sync usage al dashboard
  syncDashUsage();
}

async function syncDashUsage() {
  const plan = getPlanConfig();
  const numEl  = document.getElementById('dash-usage-num');
  const barEl  = document.getElementById('dash-usage-bar');
  const resEl  = document.getElementById('dash-usage-reset');
  if (!numEl) return;

  try {
    const { daily } = await getUsageCounts();
    const rem = Math.max(0, plan.diario - daily);
    const pct = (rem / plan.diario) * 100;
    const color = rem <= plan.diario * 0.2 ? '#ef4444' : rem <= plan.diario * 0.5 ? '#f59e0b' : '#34d399';

    numEl.textContent = rem;
    numEl.style.color = color;
    if (barEl) { barEl.style.width = pct + '%'; barEl.style.background = color; }

    const now = new Date(), md = new Date(now); md.setHours(24,0,0,0);
    const hrs = Math.ceil((md - now) / 3600000);
    if (resEl) resEl.textContent = `Resetea en ~${hrs}h · Plan ${plan.nombre}`;
  } catch {
    if (numEl) numEl.textContent = '—';
  }
}

function goStep(n) {
  // Ocultar home
  const homePage = document.getElementById('home-page');
  if (homePage) homePage.classList.remove('active');

  // Mostrar panel correcto
  document.querySelectorAll('.panel').forEach((p,i) => p.classList.toggle('active', i===n));

  // Actualizar step-btn original (por si acaso)
  document.querySelectorAll('.step-btn').forEach((b,i) => {
    b.classList.remove('active');
    if (i===n) b.classList.add('active');
  });

  // Actualizar sidebar buttons
  for (let i = 0; i <= 6; i++) {
    const sb = document.getElementById('sb-' + i);
    if (sb) sb.classList.toggle('active', i === n);
  }
}

function goHome() {
  // Mostrar home page
  const homePage = document.getElementById('home-page');
  if (homePage) homePage.classList.add('active');

  // Ocultar todos los panels
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));

  // Desactivar todos los sidebar buttons
  for (let i = 0; i <= 6; i++) {
    const sb = document.getElementById('sb-' + i);
    if (sb) sb.classList.remove('active');
  }
}

function setLandingTab(tab) {
  document.querySelectorAll('.sub-tab').forEach((t,i) => t.classList.toggle('active', (i===0 && tab==='copy') || (i===1 && tab==='html')));
  const copySection = document.getElementById('landing-copy-section');
  const htmlSection = document.getElementById('landing-html-section');
  if (copySection) copySection.style.display = tab==='copy' ? 'block' : 'none';
  if (htmlSection) htmlSection.style.display = tab==='html' ? 'block' : 'none';
}

// ─── API call ─────────────────────────────────────────────────────────────────
// Temperaturas por tipo de tarea
const TEMP = {
  analitico: 0.3, estructural: 0.5, creativo: 0.8, viral: 0.9, html: 0.85,
};

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

async function callClaude(systemPrompt, userPrompt, outputId, loadingMsg, temperatura = 0.7, maxTok = 8192) {

  const out = document.getElementById(outputId);
  const loaderId = 'loader-' + outputId;

  out.innerHTML = `
  <div class="output-area loading" style="padding:32px 20px;">
    <div class="loader">
      <div class="loader-step-dots">
        <div class="loader-dot active" id="${loaderId}-d0"></div>
        <div class="loader-dot" id="${loaderId}-d1"></div>
        <div class="loader-dot" id="${loaderId}-d2"></div>
        <div class="loader-dot" id="${loaderId}-d3"></div>
      </div>
      <div class="progress-wrap" style="width:280px;">
        <div class="progress-bar" id="${loaderId}-bar" style="width:0%"></div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <span class="progress-pct" id="${loaderId}-pct">0%</span>
        <div class="loader-text" id="${loaderId}-msg">${loadingMsg}</div>
      </div>
    </div>
  </div>`;

  const steps = [
    { pct: 12, dot: 0, msg: loadingMsg },
    { pct: 35, dot: 1, msg: '🧠 Procesando con Gemini 2.5 Flash...' },
    { pct: 65, dot: 2, msg: '✍️ Estructurando respuesta...' },
    { pct: 88, dot: 3, msg: '⚡ Finalizando...' },
  ];
  let stepIdx = 0;
  const progressInterval = setInterval(() => {
    if (stepIdx >= steps.length) return;
    const s = steps[stepIdx];
    const bar = document.getElementById(loaderId + '-bar');
    const pct = document.getElementById(loaderId + '-pct');
    const msg = document.getElementById(loaderId + '-msg');
    if (bar) bar.style.width = s.pct + '%';
    if (pct) pct.textContent = s.pct + '%';
    if (msg) msg.textContent = s.msg;
    for (let i = 0; i < 4; i++) {
      const d = document.getElementById(loaderId + '-d' + i);
      if (d) d.classList.toggle('active', i <= s.dot);
    }
    stepIdx++;
  }, 1800);

  try {
    const _ok = await checkUsageLimit();
    if (!_ok) { clearInterval(progressInterval); out.innerHTML = ''; return null; }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);

    const res = await fetch('https://aibusiness.adrianbada0309.workers.dev', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemPrompt: withDateContext(systemPrompt),
        prompt: userPrompt,
        temperature: temperatura,
        maxTokens: maxTok
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    clearInterval(progressInterval);

    const bar2 = document.getElementById(loaderId + '-bar');
    const pct2 = document.getElementById(loaderId + '-pct');
    if (bar2) bar2.style.width = '100%';
    if (pct2) pct2.textContent = '100%';
    await new Promise(r => setTimeout(r, 300));

    if (!res.ok) {
      const msg = await parseProxyError(res);
      if (msg.includes('quota') || msg.includes('Quota') || msg.includes('429')) {
        const retryMatch = msg.match(/retry in ([\d.]+)s/i);
        const seg = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : 60;
        out.innerHTML = '<div class="error-msg">⏳ Límite de Gemini alcanzado. Esperá <strong>' + seg + ' segundos</strong> y volvé a intentar.</div>';
        return null;
      }
      throw new Error(msg || 'Error ' + res.status);
    }

    const data = await res.json();
    const text = data.text || 'No se generó contenido';
    if (outputId && (outputId.includes('trend') || outputId.includes('nicho'))) {
      renderTrendCards(out, text);
    } else {
      renderOutput(out, text);
    }
    return text;

  } catch (err) {
    clearInterval(progressInterval);
    if (err.name === 'AbortError') {
      out.innerHTML = '<div class="error-msg">⏱️ La generación tardó demasiado. Intentá de nuevo.</div>';
      return null;
    }
    out.innerHTML = '<div class="error-msg">⚠️ Error conectando con Gemini<br><small>' + err.message + '</small></div>';
    return null;
  }
}

// callClaudeRaw: same as callClaude but skips auto-rendering and returns raw text
// Used by generarProducto to parse output into structured UI elements
async function callClaudeRaw(systemPrompt, userPrompt, outputEl, loadingMsg) {
  const tempId = 'pb-raw-loader-' + Date.now();
  outputEl.innerHTML = `
  <div class="output-area loading" style="padding:32px 20px;">
    <div class="loader">
      <div class="loader-step-dots">
        <div class="loader-dot active"></div><div class="loader-dot"></div>
        <div class="loader-dot"></div><div class="loader-dot"></div>
      </div>
      <div class="progress-wrap" style="width:280px;"><div class="progress-bar" id="${tempId}-bar" style="width:0%"></div></div>
      <div style="display:flex;align-items:center;gap:10px;">
        <span class="progress-pct" id="${tempId}-pct">0%</span>
        <div class="loader-text" id="${tempId}-msg">${loadingMsg}</div>
      </div>
    </div>
  </div>`;

  const steps = [
    { pct:12, msg: loadingMsg },
    { pct:35, msg: '🧠 Procesando con Gemini 2.5 Flash...' },
    { pct:65, msg: '✍️ Armando módulos y bonos...' },
    { pct:88, msg: '📊 Calculando viabilidad...' },
  ];
  let si = 0;
  const interval = setInterval(() => {
    if (si >= steps.length) return;
    const bar = document.getElementById(tempId+'-bar');
    const pct = document.getElementById(tempId+'-pct');
    const msg = document.getElementById(tempId+'-msg');
    if (bar) bar.style.width = steps[si].pct + '%';
    if (pct) pct.textContent = steps[si].pct + '%';
    if (msg) msg.textContent = steps[si].msg;
    si++;
  }, 1800);

  try {
    const _ok = await checkUsageLimit();
    if (!_ok) { clearInterval(interval); outputEl.innerHTML = ''; return null; }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);

    const res = await fetch('https://aibusiness.adrianbada0309.workers.dev', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemPrompt: withDateContext(systemPrompt),
        prompt: userPrompt,
        temperature: 0.7,
        maxTokens: 8192
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    clearInterval(interval);

    const bar2 = document.getElementById(tempId+'-bar');
    const pct2 = document.getElementById(tempId+'-pct');
    if (bar2) bar2.style.width = '100%';
    if (pct2) pct2.textContent = '100%';
    await new Promise(r => setTimeout(r, 300));

    if (!res.ok) {
      const msg = await parseProxyError(res);
      outputEl.innerHTML = '<div class="error-msg">⚠️ Error al generar: ' + msg + '</div>';
      return null;
    }

    const data = await res.json();
    outputEl.innerHTML = '';
    return data.text || null;

  } catch(err) {
    clearInterval(interval);
    outputEl.innerHTML = '<div class="error-msg">' +
      (err.name === 'AbortError' ? '⏱️ Timeout. Intentá de nuevo.' : '⚠️ ' + err.message) + '</div>';
    return null;
  }
}

function renderOutput(container, text, mode = 'default') {
  // Detectar si es output de anuncios o contenido (para renderizar en cards)
  const isAds = mode === 'ads' || (text.includes('ÁNGULO') && text.includes('funciona'));
  const isHooks = mode === 'hooks' || (text.includes('GUIÓN') && text.includes('HOOK'));

  if (isAds) { renderAdCards(container, text); return; }
  if (isHooks) { renderScriptCards(container, text); return; }

  // Pre: extract code blocks before other replacements
  const codeBlocks = [];
  let html = text.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) => {
    codeBlocks.push(code);
    return `__CODEBLOCK_${codeBlocks.length - 1}__`;
  });

  // Markdown conversions
  html = html
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^---$/gm, '<hr>');

  // Fix list wrapping: group consecutive <li> lines into <ul>
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]+?<\/li>)(\n<li>[\s\S]+?<\/li>)*/gm, (m) => `<ul>${m}</ul>`);

  // Restore code blocks
  codeBlocks.forEach((code, i) => {
    html = html.replace(`__CODEBLOCK_${i}__`, `<pre>${code.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>`);
  });

  container.innerHTML = `
    <div class="output-area">
      <div class="output-content">${html}</div>
      <div class="action-row">
        <button class="btn btn-copy" onclick="copyText(this)">📋 Copiar todo</button>
        <button class="btn btn-ghost" style="font-size:12px;padding:7px 14px" onclick="window.scrollTo({top:0,behavior:'smooth'})">↑ Ir arriba</button>
      </div>
    </div>`;
}

// Render anuncios en cards premium
function renderAdCards(container, text) {
  const sections = text.split(/(?=##\s+🎯\s+ÁNGULO|##\s+ÁNGULO)/g).filter(s => s.trim().length > 50);

  if (sections.length <= 1) { renderOutput(container, text, 'skip'); return; }

  const adColors = ['#38bdf8','#34d399','#a855f7','#f59e0b','#f87171','#818cf8'];

  const cards = sections.map((section, i) => {
    const titleMatch = section.match(/##\s+(?:🎯\s+)?ÁNGULO\s+\d+[:\s]+(.+)/);
    const title = titleMatch ? titleMatch[1].trim() : `Ángulo ${i+1}`;
    const color = adColors[i % adColors.length];

    let body = section.replace(/##.*\n/, '').trim();
    // Convertir markdown básico
    body = body
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^### (.+)$/gm, '<div class="ad-card-section-title">$1</div>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
      .replace(/\n\n/g, '<br>');

    return `
      <div class="ad-card" style="border-left-color:${color}">
        <div class="ad-card-header">
          <div class="ad-card-num" style="background:${color}20;color:${color};border-color:${color}40">${i+1}</div>
          <div class="ad-card-title">${title}</div>
          <button class="ad-card-copy" onclick="copyAdCard(this)" title="Copiar este ángulo">📋</button>
        </div>
        <div class="ad-card-body">${body}</div>
      </div>`;
  }).join('');

  container.innerHTML = `
    <div class="output-area">
      <div class="ad-cards-grid">${cards}</div>
      <div class="action-row">
        <button class="btn btn-copy" onclick="copyText(this)">📋 Copiar todo</button>
      </div>
    </div>`;
}

// Render guiones en cards
function renderScriptCards(container, text) {
  const sections = text.split(/(?=##\s+🎬\s+GUIÓN|##\s+GUIÓN)/g).filter(s => s.trim().length > 50);

  if (sections.length <= 1) { renderOutput(container, text, 'skip'); return; }

  const cards = sections.map((section, i) => {
    const titleMatch = section.match(/##\s+(?:🎬\s+)?GUIÓN\s+\d+[:\s]+(.+)/);
    const title = titleMatch ? titleMatch[1].trim() : `Guión ${i+1}`;

    let body = section.replace(/##.*\n/, '').trim();
    body = body
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^### (.+)$/gm, '<div class="ad-card-section-title">$1</div>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
      .replace(/\n\n/g, '<br>');

    return `
      <div class="ad-card" style="border-left-color:#818cf8">
        <div class="ad-card-header">
          <div class="ad-card-num" style="background:#818cf820;color:#818cf8;border-color:#818cf840">${i+1}</div>
          <div class="ad-card-title">🎬 ${title}</div>
          <button class="ad-card-copy" onclick="copyAdCard(this)" title="Copiar este guión">📋</button>
        </div>
        <div class="ad-card-body">${body}</div>
      </div>`;
  }).join('');

  container.innerHTML = `
    <div class="output-area">
      <div class="ad-cards-grid">${cards}</div>
      <div class="action-row">
        <button class="btn btn-copy" onclick="copyText(this)">📋 Copiar todo</button>
      </div>
    </div>`;
}

function copyAdCard(btn) {
  const card = btn.closest('.ad-card');
  const text = card.innerText.replace('📋', '').trim();
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = '✅';
    setTimeout(() => btn.textContent = '📋', 2000);
  });
}

function copyText(btn) {
  const area = btn.closest('.output-area') || btn.closest('.ce-result') || btn.closest('.copy-preview-card');
  if (!area) return;
  const content = area.querySelector('.output-content, .ce-copy-content, .copy-preview-content, #copy-preview');
  if (!content) return;
  const originalLabel = btn.textContent;
  navigator.clipboard.writeText(content.innerText).then(() => {
    btn.textContent = '✅ Copiado!';
    setTimeout(() => btn.textContent = originalLabel, 2000);
  });
}

// ─── Step 0: Nicho ────────────────────────────────────────────────────────────
async function analizarNicho() {
  const nicho = document.getElementById('nicho').value || appState.nicho;
  const pais = document.getElementById('pais').value;
  const audiencia = document.getElementById('audiencia').value;
  const presupuesto = document.getElementById('presupuesto').value;

  if (!nicho) { alert('Escribí un nicho primero'); return; }
  Object.assign(state, { nicho, pais, audiencia, presupuesto });

  const sys = `Eres consultor estratégico de negocios digitales para Latinoamérica. Análisis concreto, datos realistas, recomendaciones ejecutables esta semana. Español, formato ##, sin generalidades.`;
  const prompt = `Análisis de mercado: ${nicho} · ${pais} · Presupuesto: ${presupuesto} (${getAppYear()})

## 🎯 Diagnóstico del Nicho
Demanda (alta/media/baja) · competencia · tendencia · ventana de oportunidad.

## 💡 3 Productos Digitales Ganadores
Nombre · problema que resuelve · precio · tiempo de creación · por qué ganaría en ${pais}.

## 👤 Avatar del Cliente
Edad · ocupación · dolor principal · trigger de compra · qué busca en Google.

## ⚡ Diferenciadores
3 ángulos únicos que la competencia no explota.

## 💰 Proyección de Ingresos
Conservador · realista · optimista (ventas/mes primeros 3 meses).

## 🚀 Plan con ${presupuesto}
Semana 1 · Semana 2 · Semana 3-4 · Qué NO hacer.`;

  await callClaude(sys, prompt, 'nicho-output', 'Analizando tu nicho con IA...');
  markDone(0); incrementUsage();
}

// ─── Step 1: Producto ─────────────────────────────────────────────────────────

// Toggle collapsible pb-sections
function togglePbSection(bodyId) {
  const body = document.getElementById(bodyId);
  if (!body) return;
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  const header = body.previousElementSibling;
  if (header) {
    const arrow = header.querySelector('span:last-child, [style*="font-size:12px"]:last-child');
    if (arrow) arrow.textContent = isOpen ? '▾' : '▴';
  }
}

// Toggle individual module card
function toggleModule(card) {
  card.classList.toggle('open');
}

// Parse AI structured response using explicit delimiters
function renderProductoUI(rawText) {

  // ── Core parser: extract block between START/END delimiters ──────────────
  function getBlock(name) {
    const re = new RegExp(`---${name}_START---([\\s\\S]*?)---${name}_END---`, 'i');
    const m = rawText.match(re);
    return m ? m[1].trim() : '';
  }

  // Extract a field value: "FIELD_NAME: value"
  function field(block, key) {
    const re = new RegExp(`^${key}:\\s*(.+)$`, 'im');
    const m = block.match(re);
    return m ? m[1].trim().replace(/^\*+|\*+$/g,'') : '';
  }

  // Extract multi-line field (everything after KEY: until next KEY: or end)
  function fieldMulti(block, key) {
    const re = new RegExp(`^${key}:\\s*([\\s\\S]*?)(?=^[A-Z_]+:|$)`, 'im');
    const m = block.match(re);
    return m ? m[1].trim().replace(/\*+/g,'') : '';
  }

  // ════════════════════════════════════════════════════
  // BLOCK 1 — NOMBRES
  // ════════════════════════════════════════════════════
  const bNombres = getBlock('NOMBRES');

  const recIdx = field(bNombres, 'RECOMENDADO') || '1';
  const names = [1,2,3].map(i => ({
    num: i,
    name:    field(bNombres, `NOMBRE_${i}`),
    sub:     field(bNombres, `SUBTITULO_${i}`),
    why:     fieldMulti(bNombres, `POR_QUE_${i}`),
    isRec:   String(recIdx) === String(i)
  })).filter(n => n.name);

  const transformClaim = field(bNombres, 'TRANSFORMACION');
  const displayName = (names.find(n=>n.isRec)||names[0]||{}).name || 'Tu Producto';

  // Update hero
  document.getElementById('pb-product-name').textContent = displayName;
  document.getElementById('pb-claim-text').textContent = transformClaim;
  document.getElementById('pb-product-hero').classList.add('visible');
  appState.nombreProducto = displayName;
  const ln = document.getElementById('nombre-producto');
  if (ln && !ln.value) ln.value = displayName;

  // Render names card
  if (names.length) {
    const namesHtml = names.map(n => `
      <div class="pb-name-card${n.isRec?' pb-name-card--rec':''}">
        ${n.isRec?'<div class="pb-name-badge">★ RECOMENDADO</div>':''}
        <div class="pb-name-title">${n.name}</div>
        ${n.sub?`<div class="pb-name-subtitle">${n.sub}</div>`:''}
        ${n.why?`<div class="pb-name-why"><span>💡</span><span>${n.why}</span></div>`:''}
      </div>`).join('');
    appendPbSection('pb-sec-names','🏷️ Nombres del Producto', namesHtml, `${names.length} opciones`);
  }

  // ════════════════════════════════════════════════════
  // BLOCK 2 — MÓDULOS
  // ════════════════════════════════════════════════════
  const bModulos = getBlock('MODULOS');
  const modContainer = document.getElementById('modules-container');
  const modSection   = document.getElementById('pb-modules-section');
  const modCount     = document.getElementById('pb-modules-count');

  const modules = [];
  for (let i = 1; i <= 12; i++) {
    const titulo = field(bModulos, `MODULO_${i}_TITULO`);
    if (!titulo) break;
    const logro     = field(bModulos, `MODULO_${i}_LOGRO`);
    const contenido = field(bModulos, `MODULO_${i}_CONTENIDO`);
    const bullets   = contenido ? contenido.split('|').map(s=>s.trim()).filter(Boolean) : [];
    modules.push({ num: i, titulo, logro, bullets });
  }

  if (modules.length) {
    modContainer.innerHTML = modules.map(m => `
      <div class="module-card" onclick="toggleModule(this)">
        <div class="module-card-header">
          <div class="module-num">${m.num}</div>
          <div class="module-title">${m.titulo}</div>
          <div class="module-arrow">▾</div>
        </div>
        <div class="module-body">
          ${m.logro?`<div style="font-size:12px;color:var(--accent3);font-weight:600;margin-bottom:8px">✓ ${m.logro}</div>`:''}
          ${m.bullets.map(b=>`<div class="pb-inline-li"><span>→</span><span>${b}</span></div>`).join('')}
        </div>
      </div>`).join('');
    modCount.textContent = `${modules.length} módulos`;
    modSection.style.display = 'block';
  }

  // ════════════════════════════════════════════════════
  // BLOCK 3 — BONOS
  // ════════════════════════════════════════════════════
  const bBonos = getBlock('BONOS');
  const bonContainer = document.getElementById('bonuses-container');
  const bonSection   = document.getElementById('pb-bonuses-section');
  const bonCount     = document.getElementById('pb-bonuses-count');

  const bonos = [];
  for (let i = 1; i <= 8; i++) {
    const nombre = field(bBonos, `BONO_${i}_NOMBRE`);
    if (!nombre) break;
    bonos.push({
      nombre,
      desc:  field(bBonos, `BONO_${i}_DESC`),
      valor: field(bBonos, `BONO_${i}_VALOR`)
    });
  }
  const stackTotal = field(bBonos, 'STACK_TOTAL');

  if (bonos.length) {
    bonContainer.innerHTML = bonos.map(b=>`
      <div class="bonus-card">
        <div class="bonus-card-title">🎁 ${b.nombre}</div>
        ${b.desc?`<div class="bonus-card-desc">${b.desc}</div>`:''}
        ${b.valor?`<div class="bonus-card-value">Valor percibido: ${b.valor}</div>`:''}
      </div>`).join('');
    bonCount.textContent = `${bonos.length} bonos${stackTotal?' · '+stackTotal+' en valor':''}`;
    bonSection.style.display = 'block';
  }

  // ════════════════════════════════════════════════════
  // BLOCK 4 — PRECIOS
  // ════════════════════════════════════════════════════
  const bPrecios = getBlock('PRECIOS');
  const pricingTable   = document.getElementById('pricing-table');
  const pricingSection = document.getElementById('pb-pricing-section');

  if (bPrecios) {
    const core       = field(bPrecios, 'PRECIO_CORE');
    const coreDesc   = field(bPrecios, 'PRECIO_CORE_DESC');
    const coreJust   = field(bPrecios, 'PRECIO_CORE_JUST');
    const premium    = field(bPrecios, 'PRECIO_PREMIUM');
    const premDesc   = field(bPrecios, 'PRECIO_PREMIUM_DESC');
    const anclaje    = field(bPrecios, 'PRECIO_ANCLAJE');
    const framing    = field(bPrecios, 'PRECIO_FRAMING');
    const oferta     = field(bPrecios, 'OFERTA_LANZAMIENTO');

    pricingTable.innerHTML = `
      <div class="pricing-tier">
        <div class="pricing-tier-label">CORE</div>
        <div class="pricing-tier-price">${core||'—'}</div>
        ${framing?`<div class="pricing-tier-framing">${framing}</div>`:''}
        ${coreJust?`<div style="font-size:11px;color:var(--muted);margin-top:4px;line-height:1.5">${coreJust}</div>`:''}
        <div class="pricing-tier-includes">${coreDesc||'Producto principal + bonos base'}</div>
      </div>
      <div class="pricing-tier recommended">
        <div class="pricing-tier-label">PREMIUM</div>
        ${anclaje?`<div class="pricing-tier-original">${anclaje}</div>`:''}
        <div class="pricing-tier-price">${premium||'—'}</div>
        ${oferta?`<div class="pricing-tier-framing" style="color:var(--warn);font-size:10px">🔥 ${oferta}</div>`:''}
        <div class="pricing-tier-includes">${premDesc||'Todo Core + bonos premium + soporte'}</div>
      </div>`;
    pricingSection.style.display = 'block';
  }

  // ════════════════════════════════════════════════════
  // BLOCK 5 — POSICIONAMIENTO
  // ════════════════════════════════════════════════════
  const bPos = getBlock('POSICIONAMIENTO');
  if (bPos) {
    const claim   = field(bPos, 'CLAIM');
    const a1      = field(bPos, 'ANGULO_1');
    const a2      = field(bPos, 'ANGULO_2');
    const a3      = field(bPos, 'ANGULO_3');
    const obj     = field(bPos, 'OBJECION');
    const neutral = fieldMulti(bPos, 'NEUTRALIZACION');

    const angles = [a1,a2,a3].filter(Boolean);

    const posHtml = `
      ${claim?`<div class="pb-claim-banner"><span>✦</span><span>${claim}</span></div>`:''}
      ${angles.length?`
        <div style="margin-top:14px">
          <div class="pb-mini-label">3 Ángulos de Diferenciación</div>
          ${angles.map((a,i)=>`
            <div class="pb-angle-item">
              <span class="pb-angle-num">${i+1}</span>
              <span>${a}</span>
            </div>`).join('')}
        </div>`:''}
      ${obj?`
        <div style="margin-top:16px;padding:14px;background:rgba(251,191,36,0.05);border:1px solid rgba(251,191,36,0.2);border-radius:10px">
          <div class="pb-mini-label" style="color:var(--warn)">⚡ Objeción principal que frena la compra</div>
          <div style="font-size:12px;color:var(--muted2);margin:6px 0 0;font-style:italic">"${obj}"</div>
          ${neutral?`<div style="margin-top:10px"><div class="pb-mini-label" style="color:var(--accent3)">✓ Cómo neutralizarla</div><div style="font-size:12px;color:var(--muted2);margin-top:4px;line-height:1.65">${neutral}</div></div>`:''}
        </div>`:''}`;

    appendPbSection('pb-sec-positioning','🎯 Posicionamiento', posHtml, 'claim + ángulos');
  }

  // ════════════════════════════════════════════════════
  // BLOCK 6 — ROADMAP
  // ════════════════════════════════════════════════════
  const bRoad = getBlock('ROADMAP');
  if (bRoad) {
    const tiempo      = field(bRoad, 'TIEMPO');
    const herramientas = field(bRoad, 'HERRAMIENTAS');
    const mvpIncluir  = field(bRoad, 'MVP_INCLUIR');
    const mvpDejar    = field(bRoad, 'MVP_DEJAR');
    const primerPaso  = field(bRoad, 'PRIMER_PASO');

    const mvpInItems = mvpIncluir ? mvpIncluir.split('|').map(s=>s.trim()).filter(Boolean) : [];
    const mvpDjItems = mvpDejar   ? mvpDejar.split('|').map(s=>s.trim()).filter(Boolean)   : [];

    const tools = herramientas ? herramientas.split(',').map(s=>s.trim()).filter(Boolean) : [];

    const roadHtml = `
      ${tiempo?`<div class="pb-roadmap-row">
        <span class="pb-roadmap-icon">⏱</span>
        <div><strong>Tiempo estimado de producción</strong>
        <div style="color:var(--muted2);font-size:12px;margin-top:3px">${tiempo}</div></div>
      </div>`:''}

      ${tools.length?`<div class="pb-roadmap-row">
        <span class="pb-roadmap-icon">🛠</span>
        <div><strong>Herramientas recomendadas</strong>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">
          ${tools.map(t=>`<span style="font-size:11px;padding:3px 10px;background:rgba(255,255,255,0.05);border:1px solid var(--border2);border-radius:99px;color:var(--muted2)">${t}</span>`).join('')}
        </div></div>
      </div>`:''}

      ${mvpInItems.length?`<div class="pb-roadmap-row">
        <span class="pb-roadmap-icon">🚀</span>
        <div><strong>MVP — Lanzar primero</strong>
        <div style="margin-top:8px;display:flex;flex-direction:column;gap:4px">
          ${mvpInItems.map(x=>`<div style="font-size:12px;color:var(--accent3);display:flex;gap:6px"><span>✓</span><span>${x}</span></div>`).join('')}
        </div></div>
      </div>`:''}

      ${mvpDjItems.length?`<div class="pb-roadmap-row">
        <span class="pb-roadmap-icon">📦</span>
        <div><strong>Dejar para v2.0</strong>
        <div style="margin-top:8px;display:flex;flex-direction:column;gap:4px">
          ${mvpDjItems.map(x=>`<div style="font-size:12px;color:var(--muted2);display:flex;gap:6px"><span>→</span><span>${x}</span></div>`).join('')}
        </div></div>
      </div>`:''}

      ${primerPaso?`<div class="pb-roadmap-row" style="background:rgba(52,211,153,0.04);border:1px solid rgba(52,211,153,0.15);border-radius:10px;padding:12px;margin-top:4px">
        <span class="pb-roadmap-icon" style="background:rgba(52,211,153,0.1);border-color:rgba(52,211,153,0.2)">📌</span>
        <div><strong style="color:var(--accent3)">Próximo paso — esta semana</strong>
        <div style="color:var(--muted2);font-size:12px;margin-top:3px">${primerPaso}</div></div>
      </div>`:''}`;

    appendPbSection('pb-sec-roadmap','🗺️ Hoja de Ruta', roadHtml, 'producción + MVP');
  }

  // ════════════════════════════════════════════════════
  // BLOCK 7 — EVALUACIÓN (Sidebar)
  // ════════════════════════════════════════════════════
  const bEval = getBlock('EVALUACION');

  const verdict   = (field(bEval, 'DECISION') || 'GO').toUpperCase();
  const scoreRaw  = parseInt(field(bEval, 'SCORE')) || 0;
  // Score from AI if valid, otherwise derive
  const score = (scoreRaw >= 1 && scoreRaw <= 100) ? scoreRaw
    : verdict==='GO' ? 85 : verdict==='PIVOT' ? 63 : 38;

  const scoreColor = score>=80 ? '#34d399' : score>=60 ? '#fbbf24' : '#f87171';
  const R = 46, C = 2*Math.PI*R;
  const filled = (C*(score/100)).toFixed(2);
  const gap    = (C - C*(score/100)).toFixed(2);

  document.getElementById('pb-score-wrap').innerHTML = `
    <div style="position:relative;width:120px;height:120px">
      <svg width="120" height="120" viewBox="0 0 120 120" style="display:block;transform:rotate(-90deg)">
        <circle cx="60" cy="60" r="${R}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="10"/>
        <circle cx="60" cy="60" r="${R}" fill="none" stroke="${scoreColor}" stroke-width="10"
          stroke-linecap="round" stroke-dasharray="${filled} ${gap}"/>
      </svg>
      <div style="position:absolute;top:0;left:0;width:120px;height:120px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;pointer-events:none">
        <div style="font-family:var(--font-display);font-size:30px;font-weight:800;letter-spacing:-0.04em;color:${scoreColor};line-height:1">${score}</div>
        <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--muted2)">/100</div>
      </div>
    </div>
    <div class="score-verdict ${verdict.toLowerCase()}">${verdict}</div>`;

  // Strengths
  const strengths = [1,2,3,4].map(i => field(bEval,`FORTALEZA_${i}`)).filter(Boolean);
  const strCard = document.getElementById('pb-strengths-card');
  const strList = document.getElementById('pb-strengths-list');
  if (strengths.length) {
    strList.innerHTML = strengths.map(s=>
      `<div class="pb-list-item strength"><span class="pb-list-icon">✓</span><span>${s}</span></div>`
    ).join('');
    strCard.style.display = 'block';
  }

  // Risks
  const risks = [1,2,3,4].map(i => field(bEval,`RIESGO_${i}`)).filter(Boolean);
  const rkCard = document.getElementById('pb-risks-card');
  const rkList = document.getElementById('pb-risks-list');
  if (risks.length) {
    rkList.innerHTML = risks.map(r=>
      `<div class="pb-list-item risk"><span class="pb-list-icon">⚠</span><span>${r}</span></div>`
    ).join('');
    rkCard.style.display = 'block';
  }

  // Decision + reason
  const decisionRazon = field(bEval, 'DECISION_RAZON');
  const proximoPaso   = field(bEval, 'PROXIMO_PASO');
  const shrkCard = document.getElementById('pb-shark-card');
  const shrkText = document.getElementById('pb-shark-text');
  if (decisionRazon || proximoPaso) {
    shrkText.innerHTML = `
      ${decisionRazon?`<div style="margin-bottom:8px">${decisionRazon}</div>`:''}
      ${proximoPaso?`<div style="margin-top:8px;padding:10px;background:rgba(52,211,153,0.06);border:1px solid rgba(52,211,153,0.2);border-radius:8px;font-size:11px;color:var(--accent3)"><strong>📌 Esta semana:</strong> ${proximoPaso}</div>`:''}`;
    shrkCard.style.display = 'block';
  }

  // ════════════════════════════════════════════════════
  // "Ver información completa" modal
  // ════════════════════════════════════════════════════
  const rawOut = document.getElementById('producto-output');
  const esc = rawText
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/---(\w+)_(START|END)---/g,'<div style="font-size:10px;color:var(--muted);margin:12px 0 3px;letter-spacing:.05em">─── $1 ───</div>')
    .replace(/^([A-Z_]+_\d*[A-Z]*):(.+)$/gm,'<div style="padding:2px 0"><span style="color:var(--accent-bright);font-size:11px;font-weight:600">$1</span><span style="color:var(--muted2);font-size:12px">: $2</span></div>')
    .replace(/\n/g,'<br>');

  if (rawOut) rawOut.innerHTML = `
    <div style="margin-top:8px;display:flex;justify-content:center">
      <button class="btn btn-ghost" style="font-size:12px;gap:6px" onclick="openRawModal()">
        📄 Ver información completa
      </button>
    </div>
    <div id="pb-raw-modal" style="display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.88);backdrop-filter:blur(8px);overflow-y:auto;padding:20px" onclick="if(event.target===this)closeRawModal()">
      <div style="max-width:800px;margin:0 auto;background:var(--bg-elevated);border:1px solid var(--border2);border-radius:20px;padding:28px 32px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:22px">
          <div style="font-family:var(--font-display);font-size:16px;font-weight:700;color:var(--text)">📄 Análisis Completo del Producto</div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-copy" style="font-size:11px" onclick="navigator.clipboard.writeText(document.getElementById('pb-raw-text').innerText).then(()=>{this.textContent='✅ Copiado!';setTimeout(()=>{this.textContent='📋 Copiar'},2000)})">📋 Copiar todo</button>
            <button class="btn btn-ghost" style="font-size:11px;padding:6px 14px" onclick="closeRawModal()">✕ Cerrar</button>
          </div>
        </div>
        <div id="pb-raw-text" style="font-size:12px;line-height:1.9;color:var(--muted2)">${esc}</div>
      </div>
    </div>`;

  // Enable action buttons
  ['pb-action-landing','pb-action-pdf','btn-usar-en-landing'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.disabled=false;
  });
}

// Modal helpers
function openRawModal() {
  const m=document.getElementById('pb-raw-modal');
  if(m){m.style.display='block';document.body.style.overflow='hidden';}
}
function closeRawModal() {
  const m=document.getElementById('pb-raw-modal');
  if(m){m.style.display='none';document.body.style.overflow='';}
}

// Append collapsible section card into col-2 extra sections container
function appendPbSection(id, title, contentHtml, badge) {
  let container = document.getElementById('pb-extra-sections');
  if (!container) {
    const hero = document.getElementById('pb-product-hero');
    if (!hero || !hero.parentElement) return;
    container = document.createElement('div');
    container.id = 'pb-extra-sections';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '12px';
    hero.parentElement.appendChild(container);
  }
  const existing = document.getElementById(id);
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.id = id;
  el.className = 'pb-section';
  el.style.marginTop = '0';
  el.innerHTML = `
    <div class="pb-section-header" onclick="togglePbSection('${id}-body')">
      <span>${title}</span>
      <div style="display:flex;align-items:center;gap:8px">
        ${badge?`<span class="pb-section-count">${badge}</span>`:''}
        <span id="${id}-arrow" style="color:var(--muted2);font-size:12px">▾</span>
      </div>
    </div>
    <div class="pb-section-body" id="${id}-body">${contentHtml}</div>`;
  container.appendChild(el);
}

// Export product as plain text
function exportarProductoPDF() {
  const rawBody = document.getElementById('pb-raw-body');
  if (!rawBody || rawBody.style.display === 'none') {
    // open it first
    togglePbSection('pb-raw-body');
  }
  const text = rawBody ? rawBody.innerText : '';
  if (!text) { alert('Generá el producto primero'); return; }
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (appState.nombreProducto || 'producto') + '.txt';
  a.click();
}

async function generarProducto() {
  const desc = document.getElementById('producto-desc').value;
  const tipo = document.getElementById('tipo-producto').value;
  const precio = document.getElementById('precio').value;
  const transf = document.getElementById('transformacion').value;

  if (!desc) { alert('Describí tu producto primero'); return; }
  Object.assign(state, { producto: desc, precio, transformacion: transf });

  // Reset UI
  document.getElementById('pb-product-hero').classList.remove('visible');
  ['pb-modules-section','pb-bonuses-section','pb-pricing-section',
   'pb-strengths-card','pb-risks-card','pb-shark-card'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  document.getElementById('pb-score-wrap').innerHTML = `
    <div class="pb-sidebar-empty">
      <div class="pb-se-icon" style="animation:spin 1s linear infinite;display:inline-block">⟳</div>
      <div>Calculando viabilidad...</div>
    </div>`;

  const sys = `Eres arquitecto de infoproductos de alto ticket con 12+ años lanzando productos digitales rentables en Latinoamérica. Pensás como un Shark: maximizás valor percibido y poder de precio. Sos directo, estratégico y honesto. Respondés EXACTAMENTE en el formato solicitado usando los delimitadores indicados — esto es crítico para el sistema. Sin texto libre fuera de los delimitadores. Todo en español.`;

  const prompt = `Genera la arquitectura completa para este producto digital. DEBES usar EXACTAMENTE los delimitadores indicados — el sistema los necesita para procesar la respuesta.

PRODUCTO: ${desc}
FORMATO: ${tipo}
PRECIO OBJETIVO: ${precio || 'recomendar entre $197–$997'}
TRANSFORMACIÓN: ${transf || 'definir'}
NICHO: ${appState.nicho || 'General'}

---NOMBRES_START---
Devuelve exactamente 3 nombres. Para cada uno usa este formato EXACTO:

NOMBRE_1: [nombre completo del producto]
SUBTITULO_1: [subtítulo que amplía la promesa, 1 línea]
POR_QUE_1: [por qué vende — qué emoción activa, qué promesa hace, por qué es irresistible para el avatar]
RECOMENDADO: 1

NOMBRE_2: [nombre completo del producto]
SUBTITULO_2: [subtítulo]
POR_QUE_2: [por qué vende]

NOMBRE_3: [nombre completo del producto]
SUBTITULO_3: [subtítulo]
POR_QUE_3: [por qué vende]

TRANSFORMACION: [Estado actual doloroso] → [Estado deseado concreto y medible en tiempo específico]
---NOMBRES_END---

---MODULOS_START---
Exactamente 10 módulos. Formato EXACTO para cada uno:

MODULO_1_TITULO: [título orientado a beneficio, no a tema]
MODULO_1_LOGRO: [qué resultado tangible obtiene el cliente al terminar este módulo]
MODULO_1_CONTENIDO: [punto 1] | [punto 2] | [punto 3] | [punto 4]

(repite para MODULO_2 hasta MODULO_10)
---MODULOS_END---

---BONOS_START---
Exactamente 6 bonos. Formato EXACTO:

BONO_1_NOMBRE: [nombre del bono]
BONO_1_DESC: [qué es y qué resuelve, 1-2 líneas]
BONO_1_VALOR: $[número]

(repite para BONO_2 hasta BONO_6)

STACK_TOTAL: $[suma total de los bonos]
---BONOS_END---

---PRECIOS_START---
PRECIO_CORE: $[número]
PRECIO_CORE_DESC: [qué incluye el tier core en 1 línea]
PRECIO_CORE_JUST: [justificación del precio en 1-2 líneas]

PRECIO_PREMIUM: $[número]
PRECIO_PREMIUM_DESC: [qué incluye el tier premium en 1 línea]
PRECIO_ANCLAJE: $[precio de lista original, más alto]

PRECIO_FRAMING: [frase "menos de $X al día" calculada correctamente]
OFERTA_LANZAMIENTO: [descripción del descuento + elemento de urgencia/scarcity]
---PRECIOS_END---

---POSICIONAMIENTO_START---
CLAIM: [una frase poderosa que define el diferenciador real, difícil de copiar]

ANGULO_1: [primer ángulo de diferenciación completo, 1-2 líneas]
ANGULO_2: [segundo ángulo de diferenciación completo, 1-2 líneas]
ANGULO_3: [tercer ángulo de diferenciación completo, 1-2 líneas]

OBJECION: [la objeción #1 real del mercado, textualmente como la diría el cliente]
NEUTRALIZACION: [cómo se neutraliza antes de que aparezca, 2-3 líneas]
---POSICIONAMIENTO_END---

---ROADMAP_START---
TIEMPO: [estimación honesta en semanas, con condiciones]
HERRAMIENTAS: [lista de herramientas específicas separadas por coma]
MVP_INCLUIR: [qué incluir en el lanzamiento mínimo viable, lista separada por |]
MVP_DEJAR: [qué dejar para v2, lista separada por |]
PRIMER_PASO: [acción concreta a hacer esta semana, 1-2 líneas]
---ROADMAP_END---

---EVALUACION_START---
VEREDICTO: GO
SCORE: [número del 1 al 100 basado en viabilidad real]

FORTALEZA_1: [fortaleza real y específica del concepto]
FORTALEZA_2: [fortaleza real y específica del concepto]
FORTALEZA_3: [fortaleza real y específica del concepto]

RIESGO_1: [riesgo real y específico, no genérico]
RIESGO_2: [riesgo real y específico, no genérico]
RIESGO_3: [riesgo real y específico, no genérico]

DECISION: [GO / PIVOT / KILL]
DECISION_RAZON: [justificación ejecutiva en 2-3 líneas]
PROXIMO_PASO: [acción concreta esta semana]
---EVALUACION_END---`;

  // Use a custom handler instead of callClaude to capture raw text
  const outputEl = document.getElementById('producto-output');
  outputEl.innerHTML = '';

  // Also clear extra sections from previous run
  const prevExtra = document.getElementById('pb-extra-sections');
  if (prevExtra) prevExtra.remove();

  try {
    const raw = await callClaudeRaw(sys, prompt, outputEl, 'Construyendo arquitectura del producto...');
    if (raw) renderProductoUI(raw);
  } catch(e) {
    console.error('generarProducto error:', e);
  }

  markDone(1); incrementUsage();
}

// ─── Step 2: Landing ──────────────────────────────────────────────────────────
async function generarCopyLanding() {
  const nombre = document.getElementById('nombre-producto').value;
  const giro = document.getElementById('giro').value;
  const dolores = document.getElementById('dolores').value;
  const bonos = document.getElementById('bonos').value;

  if (!giro && !nombre) { alert('Completá al menos el giro o nombre del producto'); return; }
  Object.assign(state, { nombreProducto: nombre, giro });

  const sys = `Sos copywriter senior especializado en ventas de productos digitales para el mercado latinoamericano. Escribís copy que convierte sin mentir, sin exagerar y sin sonar a plantilla. Dominás la jerarquía de mensajes: el trabajo del headline es que lean el subheadline, el trabajo del subheadline es que lean el primer párrafo, y así hasta el CTA. Cada sección tiene un trabajo específico en el proceso de venta. Respondés en español, copy real y específico — nunca genérico ni de ejemplo.`;
  const prompt = `Copy completo de landing page de alta conversión para:
Producto: ${nombre || appState.producto || 'Producto digital'}
Propuesta central / hook: ${giro}
Dolores del cliente: ${dolores || 'a desarrollar basándote en el nicho'}
Bonos: ${bonos || 'a definir'}
Precio: ${appState.precio || 'a definir'}
Audiencia: ${appState.audiencia || 'emprendedores digitales LATAM'}
Transformación prometida: ${appState.transformacion || 'a definir'}

REGLAS DE ESCRITURA:
- Copy 100% real para este producto, no ejemplos entre corchetes
- Tono: directo, humano, empático — nunca corporativo ni de gurú
- Cada sección cumple una función específica en el proceso de venta
- Las objeciones se neutralizan antes de que aparezcan, no después

---

## 1. HEADLINE PRINCIPAL
3 versiones para A/B testing. Para cada una: el headline + el trabajo que hace (qué creencia activa / qué objeción neutraliza). Señalá la recomendada.

## 2. SUBHEADLINE
Refuerza la promesa del headline y presenta el mecanismo. 1-2 líneas. No repetir el headline — expandirlo.

## 3. LEAD / APERTURA (primer párrafo de la página)
El lector debe verse reflejado en las primeras 3 líneas. Describe el dolor con precisión quirúrgica usando su lenguaje, no el tuyo.

## 4. SECCIÓN DE PROBLEMA (Agitación)
Texto de 3-5 párrafos cortos. Escala el dolor emocional antes de presentar la solución. Terminá con una pregunta retórica que abre la mente a la solución.

## 5. INTRODUCCIÓN DE LA SOLUCIÓN
Transición del problema al producto. Presentación del nombre con su promesa central. No hacer el reveal demasiado abrupto.

## 6. BULLETS DE BENEFICIOS (8-12 bullets)
Formato: "Descubrís [benefit] para que puedas [outcome] sin [objection]". Alternará entre resultados emocionales y racionales.

## 7. DESCRIPCIÓN DE MÓDULOS / CONTENIDO
Para cada módulo clave: nombre + qué logra el cliente + 1 frase de beneficio directo.

## 8. STACK DE BONOS
Para cada bono: nombre + descripción de valor + "valorado en $X, tuyo gratis hoy".

## 9. SECCIÓN DE PRECIO CON ANCLAJE
Precio de lista tachado → precio real → framing por día → frase de reencuadre.

## 10. GARANTÍA
Texto completo listo para usar. Que elimine el riesgo percibido sin sonar desesperado.

## 11. TESTIMONIOS (3 testimonios ficticios pero creíbles y específicos)
Nombre latino real, ciudad, resultado concreto y medible, antes/después breve.

## 12. FAQ (5 preguntas)
Las 5 objeciones reales que frenan la compra. Respuestas directas, sin rodeos.

## 13. CTA FINAL (2 versiones)
Una para el botón principal, una para el cierre de página. Texto de acción específico.

## 14. POST-SCRIPT (P.D.)
1-2 líneas: resumen de la promesa + urgencia + costo de no actuar.`;

  const result = await callClaude(sys, prompt, 'landing-output', 'Escribiendo tu landing page...');
  if (result) {
    appState.copyLanding = result;
    markDone(2); incrementUsage();
    // Habilitar botón de transferencia
    document.getElementById('btn-enviar-copy-html').disabled = false;
  }
}

// ── Transferencia Producto → Landing ────────────────────────────────────────
function usarProductoEnLanding() {
  // Extraer nombre y precio del state (ya guardados por generarProducto)
  const nombre = appState.producto || '';
  const precio = appState.precio || '';
  const transf = appState.transformacion || '';

  // Pre-completar campos de la split-screen
  const campoNombre = document.getElementById('inp-main-product');
  const campoGiro   = document.getElementById('inp-hero-title');

  if (campoNombre && nombre) {
    campoNombre.value = nombre;
    if (!appState.finalCopy) appState.finalCopy = {};
    if (!appState.finalCopy.offer) appState.finalCopy.offer = {};
    appState.finalCopy.offer.main_product = nombre;
  }
  if (campoGiro && transf) {
    campoGiro.value = transf;
    if (!appState.finalCopy) appState.finalCopy = {};
    appState.finalCopy.hero_title = transf;
  }
  if (precio) {
    const priceDisc = document.getElementById('inp-price-discount');
    if (priceDisc) {
      const numPrice = parseFloat(precio.replace(/[^0-9.]/g, '')) || 27;
      priceDisc.value = numPrice;
      if (!appState.finalCopy.offer) appState.finalCopy.offer = {};
      appState.finalCopy.offer.price_discount = numPrice;
      
      const priceOrig = document.getElementById('inp-price-original');
      if (priceOrig) {
        priceOrig.value = numPrice * 3;
        appState.finalCopy.offer.price_original = numPrice * 3;
      }
    }
  }

  // Navegar al paso de Landing
  goStep(2);
  
  // Re-render
  updateLandingPreview();

  // Mostrar hint de confirmación
  const hint = document.getElementById('hint-usar-landing');
  if (hint) { hint.classList.add('show'); setTimeout(() => hint.classList.remove('show'), 4000); }

  // Flash visual en los campos para que el usuario sepa qué se rellenó
  [campoNombre, campoGiro].forEach(el => {
    if (el) {
      el.style.transition = 'box-shadow 0.3s';
      el.style.boxShadow = '0 0 0 2px rgba(108,99,255,0.6)';
      setTimeout(() => { el.style.boxShadow = ''; }, 1800);
    }
  });
}

// ── Transferencia Copy → Generador HTML ─────────────────────────────────────
function enviarCopyAlGenerador() {
  // Ir al paso 2 y actualizar preview
  goStep(2);
  populateLandingControlPanel();
  updateLandingPreview();
}

// ── Landing mode toggle ──────────────────────────────────────────────────────
let landingMode = 'web';
function setLandingMode(mode) {
  landingMode = mode;
  document.getElementById('mode-card-web').classList.toggle('active', mode === 'web');
  document.getElementById('mode-card-shopify').classList.toggle('active', mode === 'shopify');
  document.getElementById('shopify-fields').style.display = mode === 'shopify' ? 'block' : 'none';
  document.getElementById('web-fields').style.display = mode === 'web' ? 'block' : 'none';
}

// ── Guías de conversión para generación de landings ───────────────────────────
const LANDING_SALES_STRUCTURE = `
ESTRUCTURA OBLIGATORIA (landing de venta de infoproducto — orden exacto, no saltear secciones):

1) HERO (above the fold — lo primero que se ve)
   - Headline: promesa de transformación en máx. 12 palabras (resultado, no características).
   - Subheadline: para quién es + cómo lo logra (mecanismo del producto).
   - CTA primario visible sin scroll en móvil (texto orientado a acción: "Quiero acceder", "Empezar ahora").
   - Micro-confianza debajo del CTA: garantía, cantidad de alumnos, o badge "Acceso inmediato".
   - Jerarquía visual clara: 1 foco, sin competir con 3 mensajes distintos.

2) BARRA DE CONFIANZA (opcional pero recomendada)
   - 3-4 íconos cortos: acceso inmediato, pago seguro, soporte, actualizaciones.

3) PROBLEMA / AGITACIÓN ("¿Te pasa que...?" o "Si estás aquí es porque...")
   - 4 dolores específicos del avatar (situaciones reales, lenguaje emocional).
   - Cada dolor en card o bloque visual distinto; terminar con frase puente: "No es tu culpa, el sistema/método anterior falló".

4) PUENTE A LA SOLUCIÓN
   - 1 párrafo corto: "Por eso creé [producto]" — presentar el producto como vehículo único.

5) BENEFICIOS (transformación, no features)
   - 5-6 beneficios con resultado medible o emocional ("En 30 días...", "Sin tener que...").
   - Ícono o número por beneficio; alternar layout izq/der en desktop.

6) QUÉ INCLUYE / EL PRODUCTO
   - Mockup visual del producto (placeholder CSS elegante si no hay imagen).
   - Lista de módulos/capítulos con bullets; sensación de abundancia y claridad.

7) PRUEBA SOCIAL
   - 3 testimonios con nombre, contexto y resultado concreto (estilo WhatsApp/Instagram DM).
   - Evitar testimonios genéricos ("muy bueno"); usar cifras o antes/después.

8) STACK DE BONOS
   - 3 bonos con nombre, descripción, valor tachado y valor incluido "GRATIS".
   - Sumar valor percibido antes del precio.

9) OFERTA Y PRECIO (anclaje)
   - Precio tachado (valor total) vs precio hoy; destacar ahorro en % o monto.
   - Lista "Todo lo que llevás hoy" antes del botón de compra.
   - CTA repetido con mismo color que el hero.

10) GARANTÍA / REVERSIÓN DE RIESGO
    - Bloque destacado: 7, 15 o 30 días; tono seguro, sin letra chica agresiva.

11) FAQ (5 preguntas)
    - Objecciones reales: tiempo, experiencia previa, formato, acceso, reembolso.
    - Acordeón funcional; respuestas cortas y tranquilizadoras.

12) CTA FINAL + URGENCIA ÉTICA
    - Recap de la oferta en 3 bullets.
    - Countdown integrado al diseño (15 min) + escasez creíble (cupos o precio, no mentiras absurdas).
    - Botón final grande, mismo estilo que CTA del hero.

REGLAS DE COPY Y UX DE CONVERSIÓN:
- Un solo objetivo por pantalla: COMPRAR. Sin menús ni links que saquen del funnel.
- CTA cada 2-3 scrolls en móvil; siempre el mismo texto de acción principal.
- Contraste del botón CTA: mínimo 4.5:1 vs fondo; debe ser el color más "activo" de la paleta.
- Tipografía: título hero 2.5–4rem móvil / 4–6rem desktop; cuerpo 16–18px, line-height 1.6–1.75.
- Espaciado generoso entre secciones (80–120px desktop) para respirar y parecer premium.
- Mobile-first: columnas 1 en móvil; nada de texto ilegible < 15px.
`;

const COLOR_PSYCHOLOGY_SALES = `
PSICOLOGÍA DEL COLOR PARA VENTAS (aplicar con criterio, no saturar):

ROLES DE COLOR (regla 60-30-10):
- 60% color dominante (fondo): define el mood (confianza, energía, lujo, calma).
- 30% color secundario (cards, secciones alternas): profundidad y ritmo visual.
- 10% color de acción (CTA, badges, urgencia): el único que "grita" — máximo 1-2 tonos.

SIGNIFICADO Y USO EN LANDING:
- Naranja/Coral (#FF6B35, #E07A5F): acción, entusiasmo, accesible — CTAs en fitness, lifestyle, cursos masivos.
- Rojo (#DC2626, #B91C1C): urgencia, pasión — countdown, "últimas horas"; NUNCA como fondo dominante (ansiedad).
- Verde (#059669, #10B981): dinero, salud, crecimiento, "sí" — finanzas, bienestar, resultados positivos.
- Azul (#1E40AF, #2563EB): confianza, seguridad, profesionalismo — negocios, productividad, B2B.
- Violeta/Púrpura (#6D28D9, #7C3AED): transformación, premium digital, creatividad — coaching, espiritualidad, IA.
- Dorado/Ámbar (#D97706, #C9A84C): valor percibido, exclusividad, bonos — precios anclados, badges "premium".
- Negro/Gris oscuro (#0A0A0A–#1A1A2E): autoridad, lujo — fondos premium; texto blanco o crema.
- Blanco/Crema (#FAFAF9, #F5F0E8): claridad, honestidad — fondos minimal; más conversión en productos "serios".

COMBINACIONES QUE CONVIERTEN (elegir UNA según nicho):
- Finanzas/negocios: fondo oscuro + verde esmeralda CTA + dorado acentos en precio.
- Salud/fitness: blanco o gris claro + naranja/coral CTA + verde para checks/logros.
- Relaciones/seducción: borgoña/vino + rosa dust + crema; CTA coral o rojo oscuro.
- Productividad/mindset: azul profundo + blanco + acento violeta suave; CTA verde o azul brillante.
- Cocina: crema/marrón tierra + naranja quemado CTA + verde oliva decorativo.
- Tecnología/SaaS: slate/azul noche + cyan o violeta CTA + glassmorphism sutil.

PROHIBIDO:
- Más de 3 colores fuertes compitiendo.
- CTA gris o del mismo tono que el fondo.
- Violeta genérico "startup" sin relación con el nicho.
- Gradientes arcoíris en toda la página (solo hero o CTA si aplica).
`;

// ── Style personas for creative prompts ──────────────────────────────────────
const STYLE_PROMPTS = {
  'dark-luxury': `ESTILO: Dark Luxury Premium.
- Psicología: negro = exclusividad; dorado = valor y estatus; crema = legibilidad premium.
- Paleta: negro profundo (#050508), dorado (#c9a84c), crema (#f5f0e8). CTA en dorado o verde esmeralda (#10B981). NADA de violeta genérico.
- Tipografía: Cormorant Garamond para títulos (enorme, 80-120px en hero), Jost para cuerpo.
- Layout: mucho espacio en blanco negro, elementos centrados con márgenes generosos.
- Efectos: líneas doradas finas como separadores, texto con letter-spacing amplio, hover con brillo dorado.
- Sensación: revista de lujo, exclusividad, "solo para los que entienden".`,

  'neon-bold': `ESTILO: Neon Bold Energético.
- Psicología: neón = energía y FOMO; verde neón = "go"; rosa = atención juvenil. Ideal fitness, gaming, ofertas flash.
- Paleta: negro (#000), verde neón (#00ff87) para CTA principal, rosa neón (#ff0077) acento, amarillo (#ffdd00) urgencia.
- Tipografía: Space Grotesk o Bebas Neue, texto en mayúsculas, bold extremo.
- Layout: asimétrico, elementos rotados levemente (-2deg, +1deg), bordes gruesos, sombras de colores neón.
- Efectos: glow neón en botones (box-shadow con color neón), texto con outline, backgrounds con gradientes diagonales.
- Sensación: underground, disruptivo, energía joven, FOMO extremo.`,

  'minimal-clean': `ESTILO: Minimal Editorial Clean.
- Psicología: blanco = confianza y claridad; un solo acento = foco en CTA. Ideal productos "serios", B2B, salud premium.
- Paleta: blanco (#ffffff), negro (#111), CTA coral (#E07A5F) o verde sage (#87A878) — solo UN acento fuerte.
- Tipografía: Plus Jakarta Sans o Inter, títulos enormes en negro, mucho espacio negativo.
- Layout: grid estricto, una columna centrada max 680px, líneas HR simples como separadores.
- Efectos: casi ninguna sombra, transiciones suaves, íconos simples en SVG.
- Sensación: Apple, Notion, confianza instantánea, high-end sin gritar.`,

  'gradient-vivid': `ESTILO: Gradient Vivid Moderno.
- Psicología: gradiente = innovación y optimismo; usar 2 colores máximo (ej. violeta→naranja). CTA sólido sin gradiente para contraste.
- Paleta: elegir según nicho (púrpura→naranja transformación, azul→cyan tech, verde→lima salud). Fondos alternos sólidos entre secciones.
- Tipografía: Outfit o Poppins, pesos mixtos (900 para hero, 400 para cuerpo).
- Layout: secciones con fondos alternados usando el gradiente, cards con glassmorphism sobre fondo coloreado.
- Efectos: botones con gradiente animado (background-size: 200%), texto con clip-path gradient, partículas CSS sutiles.
- Sensación: SaaS moderno, startup actual, fresco y optimista.`,

  'editorial': `ESTILO: Editorial Magazine.
- Psicología: crema = credibilidad intelectual; rojo editorial = urgencia puntual (CTA o badges). Ideal autoridad y contenido educativo.
- Paleta: crema (#faf8f4), negro (#1a1a1a), CTA rojo editorial (#d63638) o verde bosque (#2D6A4F).
- Tipografía: Playfair Display para títulos (serif grande), Source Sans Pro para cuerpo. Mix serif+sans.
- Layout: columnas tipo revista, texto en 2 columnas en desktop, pull quotes grandes, numeración de secciones.
- Efectos: underline animado en links, drop-cap en primer párrafo del hero, fotos con caption estilo revista.
- Sensación: New York Times, credibilidad absoluta, autoridad intelectual.`,

  '3d-glass': `ESTILO: 3D Glassmorphism Profundidad.
- Psicología: oscuro + glass = tech premium; acento cyan o violeta = innovación. CTA en color sólido brillante (#22D3EE o #A78BFA).
- Paleta: fondo #0d0d1a→#1a0d2e, cards blur, CTA cyan (#06B6D4) o violeta (#8B5CF6) — nunca CTA transparente.
- Tipografía: Syne para títulos, DM Sans para cuerpo, colores con opacidad variable.
- Layout: cards flotantes con múltiples capas de profundidad, elementos que se superponen, z-index visible.
- Efectos: backdrop-filter: blur(20px), bordes con gradiente (border-image), sombras en capas múltiples, pseudo-elementos ::before con gradients que rotan en hover.
- Sensación: ultra moderno, tecnológico, dashboard futurista.`,

  'brutalist': `ESTILO: Brutalist Raw Impact.
- Psicología: alto contraste = memorabilidad; amarillo = alerta/valor; rojo = urgencia. CTA siempre el color ácido sobre negro o blanco.
- Paleta: blanco (#fff), negro (#000), UN ácido (amarillo #f5d800 CTA principal o rojo #ff3300). Sin grises.
- Tipografía: Arial Black o Impact, texto ENORME (100-150px en hero), todo en mayúsculas.
- Layout: bordes gruesos negros en todos los elementos (border: 3px solid #000), sombras sólidas desplazadas (box-shadow: 6px 6px 0 #000), sin border-radius.
- Efectos: hover mueve el elemento (-3px, -3px) con cambio de sombra, fondos que alternan blanco/negro por sección.
- Sensación: imposible de ignorar, memorable, anti-genérico, arte contemporáneo.`,

  'cinematic': `ESTILO: Cinematic Full-Screen.
- Psicología: negro = drama y exclusividad; ámbar/dorado = deseo y valor; rojo = decisión final. Hero 100vh con overlay oscuro 60%.
- Paleta: negro (#000), texto crema (#FAFAF9), CTA ámbar (#f59e0b) o rojo (#dc2626) — mismo color en todos los botones.
- Tipografía: títulos en Oswald o Bebas Neue, ENORME (120px+), cuerpo en Lato ligero.
- Layout: hero 100vh con texto centrado y fondo con overlay oscuro, secciones que ocupan 80-100vh, parallax con CSS.
- Efectos: texto aparece con animación fade+translateY al entrar en viewport (Intersection Observer), línea de acento horizontal bajo el hero, countdown dramático.
- Sensación: película de Hollywood, lanzamiento de producto Apple, drama máximo.`
};

// ── Master landing generator ──────────────────────────────────────────────────
async function generarLanding() {
  const out = document.getElementById('landing-output');
  const nombreProducto = appState.nombreProducto || appState.producto || 'Producto Digital';
  const precio = appState.precio || '$XX';
  const styleKey = document.getElementById('landing-type')?.value || 'autoridad';
  const nicho = appState.nicho || appState.giro || '';
  const copyBase = appState.copyLanding ? appState.copyLanding.substring(0, 2000) : '';

  // Actualización: mapeo correcto de estilos a prompts
  const STYLE_MAP = {
    'autoridad': 'editorial',
    'dolor': 'brutalist',
    'oferta': 'neon-bold',
    'visionario': 'cinematic',
    'social': 'minimal-clean'
  };

  const styleDirective = `${STYLE_PROMPTS[STYLE_MAP[styleKey] || styleKey] || STYLE_PROMPTS['3d-glass']}\n${productProfile.paletteHint}`;

  let buyUrl = '', modeInstructions = '', downloadLabel = '', successLabel = '';

  if (landingMode === 'shopify') {
    const variantId = document.getElementById('shopify-variant-id').value.trim();
    const domain = document.getElementById('shopify-domain').value.trim();
    const mode = document.getElementById('shopify-mode').value;
    if (!variantId) { alert('Ingresá el Variant ID de tu producto en Shopify'); return; }
    buyUrl = mode === 'checkout'
      ? (domain ? `https://${domain.replace(/https?:\/\//,'')}` : '') + `/checkout/?variant=${variantId}&quantity=1`
      : `/cart/add?id=${variantId}&quantity=1`;
    modeInstructions = `MODO SHOPIFY: Los botones de compra son <a href="${buyUrl}"> links directos. NO usar modales ni JS para la compra. El checkout lo maneja Shopify.`;
    downloadLabel = 'liquid';
    successLabel = 'Landing Shopify generada';
  } else {
    const payLink = document.getElementById('web-payment-link').value.trim();
    buyUrl = payLink || '#checkout';
    modeInstructions = payLink
      ? `MODO WEB: Los botones de compra son links a ${payLink}. Al hacer click van directo a esa URL de pago.`
      : `MODO WEB: Los botones de compra abren un modal de checkout integrado. Incluí un modal con formulario (nombre, email, país) y mensaje de confirmación. El modal debe ser bello y coherente con el diseño general.`;
    downloadLabel = 'html';
    successLabel = 'Landing Web generada';
  }

  const sys = `Eres desarrollador frontend senior y experto en CRO especializado en landing pages de alta conversión para infoproductos en Latinoamérica ${getAppYear()}. Tu objetivo es máxima conversión: cada elemento tiene un trabajo específico en el proceso de venta.

REGLAS ABSOLUTAS DE CÓDIGO:
1. HTML puro — empieza con <!DOCTYPE html>, termina con </html>. Cero texto fuera del HTML.
2. CSS completo en <style> con variables :root bien definidas. Mobile-first con media queries @media (max-width: 768px).
3. Todo el texto REAL y específico para el producto — prohibido Lorem ipsum, "Texto aquí" o placeholders.
4. JavaScript mínimo al final del body: solo FAQ acordeón y countdown. Sin librerías externas.
5. Imágenes: mockups con CSS puro (gradientes, border-radius, box-shadow). Sin URLs de imágenes externas.
6. Tipografía: system-ui, -apple-system, sans-serif. Sin Google Fonts externos.
7. Performance: 100% self-contained, sin CDNs externos.

REGLAS DE CONVERSIÓN (no negociables):
- Hero completamente visible sin scroll en móvil (max-height: 100dvh)
- Flujo lógico de alta conversión: Hero → Problema → Solución → Beneficios → Bonos → Precio → Testimonios → FAQ → CTA Final
- CTAs con alto contraste, repetidos cada 2-3 secciones, texto de acción específico (no "Comprar ahora" genérico)
- FAQ funcional con acordeón que responde las 5 objeciones reales que frenan la compra
- Countdown de urgencia de 15 minutos visible antes del precio
- 3 testimonios latinos con nombres reales, ciudades y resultados concretos y medibles
- Garantía de 7 días visible y prominente cerca del precio
- Micro-copy de confianza bajo cada CTA: "✓ Acceso inmediato · ✓ Garantía 7 días · ✓ Pago seguro"
- Sin distracciones: 1 solo objetivo en toda la página, cero links de salida`;

  const paletteHint = detectProductPersonality(nombreProducto, nicho).paletteHint;

  const loadingMsgs = [
    '🎨 Diseñando hero y estructura visual...',
    '✍️ Escribiendo copy de alta conversión...',
    '⚡ Generando secciones de ventas...',
    '🔧 Construyendo precio, FAQ y cierre...',
    '🚀 Finalizando tu landing page premium...'
  ];

  const landingLoaderId = 'loader-landing-gen';
  let msgIdx = 0;
  out.innerHTML = `
  <div class="output-area loading" style="padding:32px 20px;">
    <div class="loader">
      <div class="loader-step-dots">
        <div class="loader-dot active" id="${landingLoaderId}-d0"></div>
        <div class="loader-dot" id="${landingLoaderId}-d1"></div>
        <div class="loader-dot" id="${landingLoaderId}-d2"></div>
        <div class="loader-dot" id="${landingLoaderId}-d3"></div>
      </div>
      <div class="progress-wrap" style="width:280px;">
        <div class="progress-bar" id="${landingLoaderId}-bar" style="width:0%"></div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <span class="progress-pct" id="${landingLoaderId}-pct">0%</span>
        <div class="loader-text" id="landing-loading-msg">${loadingMsgs[0]}</div>
      </div>
    </div>
  </div>`;

  const landingSteps = [
    { pct: 8,  dot: 0, msg: loadingMsgs[0] },
    { pct: 30, dot: 1, msg: loadingMsgs[1] },
    { pct: 55, dot: 2, msg: loadingMsgs[2] },
    { pct: 75, dot: 2, msg: loadingMsgs[3] },
  ];
  let landingStepIdx = 0;
  const msgInterval = setInterval(() => {
    if (landingStepIdx >= landingSteps.length) return;
    const s = landingSteps[landingStepIdx];
    const bar = document.getElementById(landingLoaderId + '-bar');
    const pct = document.getElementById(landingLoaderId + '-pct');
    const msg = document.getElementById('landing-loading-msg');
    if (bar) bar.style.width = s.pct + '%';
    if (pct) pct.textContent = s.pct + '%';
    if (msg) msg.textContent = s.msg;
    for (let i = 0; i < 4; i++) {
      const d = document.getElementById(landingLoaderId + '-d' + i);
      if (d) d.classList.toggle('active', i <= s.dot);
    }
    landingStepIdx++;
  }, 4000);

  try {
    const _okL = await checkUsageLimit();
    if (!_okL) { clearInterval(msgInterval); return; }

    // ── PARTE 1: <!DOCTYPE html> → Sección TESTIMONIOS ───────────────────────
    const promptParte1 = `Genera la PRIMERA MITAD de una landing page de ventas de alta conversión.

DATOS DEL PRODUCTO:
- Nombre: "${nombreProducto}"
- Nicho: ${nicho || 'digital'}
- Precio de venta: ${precio}
- Estilo visual: ${styleKey === 'auto' ? `AUTO — detecta el estilo más efectivo para este nicho. ${paletteHint}` : styleDirective}
${copyBase ? `- Copy base (adapta y mejora):\n${copyBase.substring(0, 600)}` : ''}
- Checkout: ${modeInstructions}

INSTRUCCIÓN: Genera desde <!DOCTYPE html> hasta justo antes de la sección PRECIO.
Incluye TODO el CSS en <style> con variables :root completas.
NO cierres </body> ni </html> — la segunda parte continuará.

SECCIONES A GENERAR (en este orden exacto):

### SECCIÓN 1 — HERO (el más importante)
- Fondo: color sólido oscuro o gradiente sutil según el estilo elegido
- Badge superior: pequeño texto en píldora ("Nuevo" / "Edición ${new Date().getFullYear()}" / emoji relevante)
- H1: headline de impacto máximo, máx 10 palabras, GRANDE (font-size: clamp(36px, 6vw, 72px))
- Subheadline: 2 líneas explicando el beneficio principal (font-size: 18-20px, color más suave)
- CTA principal: botón grande, color MUY contrastante, texto de acción específico ("Quiero [resultado]")
- Micro-copy bajo el botón: "✓ Acceso inmediato · ✓ Garantía 7 días · ✓ Sin mensualidades"
- Diseño: centrado, padding generoso, sin elementos recargados

### SECCIÓN 2 — BARRA DE CONFIANZA
- Fondo: ligeramente distinto al hero (borde top/bottom sutil)
- 4 elementos en fila horizontal con ícono SVG inline + texto:
  "⚡ Acceso Inmediato" | "🔒 Pago 100% Seguro" | "✅ Garantía ${precio.includes('$') ? '7' : '7'} días" | "💬 Soporte Incluido"
- En mobile: 2x2 grid

### SECCIÓN 3 — EL PROBLEMA
- H2 corto y directo que haga sentir al lector identificado
- 3 cards en grid (1 columna mobile, 3 desktop):
  Cada card: emoji grande + título del dolor + 1 frase descripción
- Colores: fondo oscuro/neutro, border sutil, sin sombras excesivas

### SECCIÓN 4 — LA SOLUCIÓN (presentación del producto)
- H2: "La solución que estabas buscando:" + nombre del producto en color acento
- Mockup CSS del producto: caja estilizada con gradiente, sombra profunda, nombre del producto dentro
- Lista de 5 puntos de lo que incluye (checkmarks con color acento)
- CTA secundario al final

### SECCIÓN 5 — TESTIMONIOS
- H2: "Lo que dicen nuestros clientes" (o variante según nicho)
- 3 testimonios en grid (1 col mobile, 3 desktop):
  Cada uno: avatar CSS (círculo con iniciales en color, fondo degradado) + comillas + texto del testimonio (resultado concreto y específico) + nombre + ciudad/país
- Los nombres deben ser latinos reales y creíbles

Empieza con <!DOCTYPE html>. Texto 100% real para "${nombreProducto}".`;

    const res1 = await fetch('https://aibusiness.adrianbada0309.workers.dev', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemPrompt: withDateContext(sys),
        prompt: promptParte1,
        maxTokens: 65536,
        temperature: 0.85
      })
    });

    if (!res1.ok) throw new Error('Error parte 1: ' + res1.status);
    const data1 = await res1.json();
    let parte1 = data1.text || '';

    parte1 = parte1.replace(/^```html?\n?/i, '').replace(/```\s*$/i, '').trim();
    const doctypeIdx = parte1.toLowerCase().indexOf('<!doctype html>');
    if (doctypeIdx > 0) parte1 = parte1.substring(doctypeIdx);
    if (!parte1 || parte1.length < 1000) throw new Error('Parte 1 incompleta. Intentá de nuevo.');

    // ── Extraer contexto CSS de parte1 para garantizar continuidad visual ──
    const styleMatch = parte1.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    const cssContext = styleMatch ? styleMatch[1].substring(0, 1500) : '';
    // Extraer variables :root para continuidad visual
    const rootStart = cssContext.indexOf(':root');
    const rootEnd = rootStart > -1 ? cssContext.indexOf('}', rootStart) + 1 : -1;
    const rootVars = rootStart > -1 && rootEnd > rootStart ? cssContext.slice(rootStart, rootEnd) : '';

    const el2 = document.getElementById(landingLoaderId + '-bar');
    const pct2 = document.getElementById(landingLoaderId + '-pct');
    const msg2 = document.getElementById('landing-loading-msg');
    if (el2) el2.style.width = '55%';
    if (pct2) pct2.textContent = '55%';
    if (msg2) msg2.textContent = '🔧 Generando precio, FAQ y cierre final...';

    // ── PARTE 2: PRECIO → </html> ─────────────────────────────────────────────
    const promptParte2 = `Genera la SEGUNDA MITAD de una landing page de ventas. Esta es la continuación directa de un HTML ya iniciado.

DATOS:
- Producto: "${nombreProducto}"
- Precio: ${precio}
- Checkout: ${modeInstructions}

CONTEXTO VISUAL OBLIGATORIO (usa EXACTAMENTE estas variables CSS para mantener coherencia con la primera mitad):
${rootVars || 'Usa colores oscuros profesionales coherentes con una landing de alta conversión.'}

INSTRUCCIÓN CRÍTICA: Genera SOLO el HTML faltante. NO incluyas <!DOCTYPE html>, <head> ni <style>.
Si necesitas estilos adicionales, agrégalos en una etiqueta <style> al inicio de tu respuesta.
Empieza directamente con la sección PRECIO. Termina cerrando </body></html>.
TODOS los textos, headings y secciones deben estar CENTRADOS (text-align: center) salvo las listas de items.
Usa las MISMAS clases, colores y espaciados de la primera parte.

SECCIONES A GENERAR (en este orden):

### SECCIÓN 6 — PRECIO Y OFERTA
- H2: "Todo lo que obtienes hoy con ${nombreProducto}"
- Lista completa de lo que incluye (producto principal + bonos si aplica)
- Bloque de precio con anclaje:
  - Valor total tachado: precio original (2-3x el precio real)
  - Precio real en GRANDE con etiqueta "HOY" o descuento en %
  - Framing: "Menos de $X al día" o "Inversión única"
- CTA grande y contrastante con texto de acción específico
- Bajo el CTA: "🔒 Pago seguro · ✅ Garantía de 7 días · ⚡ Acceso inmediato"
- Garantía: párrafo corto con ícono de escudo explicando la garantía de satisfacción

### SECCIÓN 7 — FAQ (acordeón funcional)
- H2: "Preguntas frecuentes"
- 5 preguntas respondiendo objeciones reales:
  1. ¿En qué formato está y cómo accedo?
  2. ¿Cuánto tiempo necesito para ver resultados?
  3. ¿Funciona si soy principiante / no tengo experiencia?
  4. ¿Qué pasa si no me gusta o no me funciona?
  5. ¿Tengo acceso de por vida?
- Acordeón con JavaScript: click en pregunta muestra/oculta respuesta con transición suave
- Diseño: border sutil entre preguntas, flecha que rota al abrir

### SECCIÓN 8 — CIERRE FINAL
- H2 de impacto: 1 sola línea que resuma la transformación prometida
- Countdown de urgencia: "Esta oferta expira en:" + timer JavaScript 15:00 minutos (formato MM:SS)
- Recuerda 3 bullets del valor principal
- CTA final: el más grande de toda la página
- Footer mínimo: © ${new Date().getFullYear()} ${nombreProducto} · Todos los derechos reservados

JAVASCRIPT AL FINAL DEL BODY:
1. Acordeón FAQ: toggle con transición CSS (max-height)
2. Countdown: setInterval cada segundo, cuando llega a 0 se resetea a 15:00

Cierra con </body></html>. Texto 100% real para "${nombreProducto}".`;

    // ── PARTE 2: Secciones 8-12 + cierre ─────────────────────────────────────
    const res2 = await fetch('https://aibusiness.adrianbada0309.workers.dev', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemPrompt: withDateContext(sys),
        prompt: promptParte2,
        maxTokens: 65536,
        temperature: 0.85
      })
    });

    clearInterval(msgInterval);
    if (!res2.ok) throw new Error('Error parte 2: ' + res2.status);
    const data2 = await res2.json();
    let parte2 = data2.text || '';

    // Limpiar markdown
    parte2 = parte2.replace(/^```html?\n?/i, '').replace(/```\s*$/i, '').trim();
    // Remover cualquier DOCTYPE repetido que pueda venir
    if (parte2.toLowerCase().includes('<!doctype')) {
      parte2 = parte2.substring(parte2.toLowerCase().indexOf('<section') > -1
        ? parte2.toLowerCase().indexOf('<section')
        : parte2.toLowerCase().indexOf('<div'));
    }

    // ── Unir las dos partes ───────────────────────────────────────────────────
    // Remover el cierre prematuro de body/html de la parte 1 si lo tiene
    parte1 = parte1.replace(/<\/body>\s*<\/html>\s*$/i, '').trim();

    let code = parte1 + '\n\n' + parte2;

    // Validación final
    if (!code || code.length < 5000) throw new Error('Landing incompleta. Intentá de nuevo.');

    appState.codigoHTML = code;
    incrementUsage();

    const shopifyInstructions = landingMode === 'shopify' ? `
        <div style="background:rgba(52,211,153,0.08);border:1px solid rgba(52,211,153,0.2);border-radius:10px;padding:12px 14px;margin-bottom:12px;font-size:12px;color:var(--accent3)">
          🛍️ <strong>Checkout URL:</strong> <code style="color:var(--accent2);font-size:11px">${buyUrl}</code>
        </div>
        <div style="background:rgba(56,189,248,0.06);border:1px solid rgba(56,189,248,0.18);border-radius:10px;padding:12px 14px;margin-bottom:12px;font-size:12px;color:var(--muted2)">
          <strong style="color:var(--accent-bright)">📋 Subir a Shopify:</strong><br>
          Admin → Tienda online → Páginas → Nueva página → editor &lt;/&gt; → pegá el código → Guardar
        </div>` : '';

    out.innerHTML = `
      <div class="output-area">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
          <span style="font-size:13px;color:var(--accent3);font-weight:600">✅ ${successLabel} (${Math.round(code.length/1024)}KB)</span>
          <div class="action-row" style="margin:0">
            <button class="btn btn-copy" onclick="previsualizarHTML()">👁️ Preview</button>
            <button class="btn btn-primary" style="font-size:12px;padding:7px 14px" onclick="abrirEditor()">✏️ Editar</button>
            <button class="btn btn-copy" onclick="copiarCodigo()">📋 Copiar</button>
            <button class="btn btn-copy" onclick="${downloadLabel==='liquid'?'descargarLiquid()':'descargarHTML()'}">⬇️ Descargar</button>
          </div>
        </div>
        ${shopifyInstructions}
        <pre style="max-height:280px;overflow-y:auto;font-size:11px;line-height:1.5;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:16px;color:#a0ffb0;white-space:pre-wrap;word-break:break-all">${code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>
      </div>`;

    markDone(2);
  } catch(err) {
    clearInterval(msgInterval);
    out.innerHTML = `<div class="error-msg">⚠️ Error generando landing<br><small>${err.message}</small></div>`;
  }
}

function detectProductPersonality(nombre, nicho) {
  const n = (nombre + ' ' + nicho).toLowerCase();

  const profiles = [
    {
      match: /fitness|gym|cuerpo|musculo|peso|dieta|salud|nutri|entrenamiento/,
      styleHint: 'Estilo recomendado: Neon Bold o Minimal Clean con before/after visual. Energía, acción, resultados físicos.',
      paletteHint: 'Paleta: fondo #FAFAFA o #0F0F0F | secundario #F4F4F5 | CTA #FF6B35 o #EA580C (acción) | acentos verde #10B981 (logros). Evitar violeta.'
    },
    {
      match: /dinero|ingresos|negocio|emprender|ventas|trading|crypto|finanz|invers|libertad financ/,
      styleHint: 'Estilo recomendado: Dark Luxury o Editorial. Autoridad, números grandes, sensación de sistema probado.',
      paletteHint: 'Paleta: fondo #0A0A0F | superficie #14141F | CTA #10B981 o #059669 (dinero/crecimiento) | dorado #C9A84C en precios y badges. Evitar rosa o neón.'
    },
    {
      match: /amor|relacion|pareja|seduccion|citas|romance|ligar|conquist/,
      styleHint: 'Estilo recomendado: Cinematic o Dark Luxury. Emoción, intimidad, storytelling en primera persona.',
      paletteHint: 'Paleta: fondo #1A0A0F o #2D1B1B | texto crema #F5E6E0 | CTA #E07A5F o #BE123C | acento borgoña #7F1D1D. Evitar azul corporativo.'
    },
    {
      match: /mindset|productividad|habitos|meditacion|ansiedad|mental|coaching|disciplina/,
      styleHint: 'Estilo recomendado: Minimal Clean o 3D Glass. Calma, claridad, transformación personal.',
      paletteHint: 'Paleta: fondo #F8FAFC o #0F172A | CTA #6366F1 o #4F46E5 (transformación) | sage #87A878 decorativo. Evitar rojo agresivo.'
    },
    {
      match: /cocina|receta|comida|chef|gastronom|reposter/,
      styleHint: 'Estilo recomendado: Editorial o Gradient Vivid cálido. Calidez, apetito visual, comunidad.',
      paletteHint: 'Paleta: fondo #FAF8F4 crema | texto #1C1917 | CTA #EA580C o #C2410C | acentos #65A30D oliva. Evitar azul frío.'
    },
    {
      match: /arte|diseño|creatividad|fotografia|musica|marketing|copy|redes|contenido/,
      styleHint: 'Estilo recomendado: Brutalist o Gradient Vivid. Creatividad visible en layout, tipografía con personalidad.',
      paletteHint: 'Paleta: fondo #0C0C0C o #FFF | CTA #8B5CF6 o #EC4899 | acento #F59E0B. Permitido ser audaz pero CTA único.'
    },
    {
      match: /idioma|ingles|curso|aprend|estudi|academ|univers|exam/,
      styleHint: 'Estilo recomendado: Editorial o Minimal Clean. Credibilidad, progreso, estructura clara de módulos.',
      paletteHint: 'Paleta: fondo #FFFFFF | texto #1E293B | CTA #2563EB (confianza) | acento #0EA5E9. Sensación educativa premium.'
    },
    {
      match: /belleza|skincare|maquillaje|estetic|antiage|cosmet/,
      styleHint: 'Estilo recomendado: Minimal Clean o Cinematic suave. Aspiracional, limpio, resultados visuales.',
      paletteHint: 'Paleta: fondo #FFFBF7 rosa nude | texto #44403C | CTA #DB2777 o #BE185D | dorado #D4A574 en premium.'
    }
  ];

  for (const p of profiles) {
    if (p.match.test(n)) return p;
  }

  return {
    styleHint: 'Estilo recomendado: 3D Glass o Gradient Vivid moderno. Producto digital genérico premium.',
    paletteHint: 'Paleta: fondo #0D0D1A | superficie glass rgba(255,255,255,0.06) | CTA #7C5CFC o #06B6D4 | texto #EEEEF8. Regla 60-30-10 estricta.'
  };
}


function previsualizarHTML() {
  if (!appState.codigoHTML) return;
  const blob = new Blob([appState.codigoHTML], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

function abrirEditor() {
  if (!appState.codigoHTML) { alert('Primero generá una landing page'); return; }
  // Store the landing HTML so the editor can read it
  localStorage.setItem('editor_landing_html', appState.codigoHTML);
  // Build editor as blob and open in new tab
  const editorHTML = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Editor de Landing Page</title>
<style>
  :root {
    --bg: #0a0a0f;
    --surface: #13131a;
    --surface2: #1a1a24;
    --border: rgba(255,255,255,0.07);
    --border2: rgba(255,255,255,0.13);
    --text: #e8e8f0;
    --muted: #6b6b80;
    --muted2: #9090a8;
    --accent: #7c5cfc;
    --accent2: #9d7fff;
    --accent3: #34d399;
    --danger: #ef4444;
    --warn: #f59e0b;
    --panel: 280px;
    --header: 52px;
    --code-panel: 220px;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text); font-family: 'Inter', system-ui, sans-serif; font-size: 13px; overflow: hidden; height: 100vh; display: flex; flex-direction: column; }

  /* ── Header ─────────────────────────────────────────────── */
  .editor-header {
    height: var(--header); background: var(--surface); border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between; padding: 0 16px; flex-shrink: 0; gap: 12px; z-index: 10;
  }
  .editor-logo { font-weight: 700; font-size: 14px; color: var(--text); display: flex; align-items: center; gap: 8px; }
  .editor-logo span { color: var(--accent2); }
  .header-center { display: flex; align-items: center; gap: 6px; }
  .viewport-btn {
    padding: 5px 12px; border-radius: 6px; border: 1px solid var(--border2);
    background: transparent; color: var(--muted2); cursor: pointer; font-size: 12px; transition: all .15s;
  }
  .viewport-btn.active, .viewport-btn:hover { background: rgba(124,92,252,0.15); border-color: var(--accent); color: var(--text); }
  .header-actions { display: flex; align-items: center; gap: 8px; }
  .hbtn {
    padding: 6px 14px; border-radius: 8px; border: none; cursor: pointer;
    font-size: 12px; font-weight: 600; transition: all .15s;
  }
  .hbtn-ghost { background: transparent; border: 1px solid var(--border2); color: var(--muted2); }
  .hbtn-ghost:hover { border-color: var(--border2); color: var(--text); background: var(--surface2); }
  .hbtn-primary { background: linear-gradient(135deg, #7c5cfc, #5b3df5); color: #fff; box-shadow: 0 2px 12px rgba(124,92,252,0.3); }
  .hbtn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(124,92,252,0.4); }
  .hbtn-success { background: linear-gradient(135deg, #059669, #34d399); color: #fff; }
  .hbtn-success:hover { transform: translateY(-1px); }
  .undo-redo { display: flex; gap: 2px; }
  .undo-redo button {
    width: 28px; height: 28px; border-radius: 6px; border: 1px solid var(--border);
    background: transparent; color: var(--muted); cursor: pointer; font-size: 14px;
    display: flex; align-items: center; justify-content: center; transition: all .15s;
  }
  .undo-redo button:hover:not(:disabled) { color: var(--text); border-color: var(--border2); background: var(--surface2); }
  .undo-redo button:disabled { opacity: .3; cursor: not-allowed; }

  /* ── Main layout ─────────────────────────────────────────── */
  .editor-body { display: flex; flex: 1; overflow: hidden; }

  /* ── Left panel: sections tree ──────────────────────────── */
  .left-panel {
    width: var(--panel); background: var(--surface); border-right: 1px solid var(--border);
    display: flex; flex-direction: column; flex-shrink: 0; overflow: hidden;
  }
  .panel-header {
    padding: 12px 14px 10px; border-bottom: 1px solid var(--border);
    font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--muted);
    display: flex; align-items: center; justify-content: space-between;
  }
  .sections-list { overflow-y: auto; flex: 1; padding: 8px; }
  .section-item {
    display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 8px;
    cursor: pointer; transition: all .15s; margin-bottom: 2px; border: 1px solid transparent;
    user-select: none;
  }
  .section-item:hover { background: var(--surface2); }
  .section-item.selected { background: rgba(124,92,252,0.12); border-color: rgba(124,92,252,0.3); }
  .section-item.hidden-section { opacity: .4; }
  .section-drag-handle { color: var(--muted); font-size: 14px; cursor: grab; flex-shrink: 0; }
  .section-drag-handle:active { cursor: grabbing; }
  .section-icon { font-size: 15px; flex-shrink: 0; }
  .section-name { flex: 1; font-size: 12px; color: var(--muted2); font-weight: 500; }
  .section-item.selected .section-name { color: var(--text); }
  .section-actions { display: flex; gap: 2px; opacity: 0; transition: opacity .15s; }
  .section-item:hover .section-actions { opacity: 1; }
  .sec-btn {
    width: 22px; height: 22px; border-radius: 5px; border: none;
    background: transparent; cursor: pointer; color: var(--muted); font-size: 12px;
    display: flex; align-items: center; justify-content: center; transition: all .15s;
  }
  .sec-btn:hover { background: var(--surface); color: var(--text); }
  .sec-btn.danger:hover { color: var(--danger); }

  /* ── Center: canvas ──────────────────────────────────────── */
  .canvas-wrap {
    flex: 1; background: #1a1a2e; display: flex; flex-direction: column;
    align-items: center; overflow: hidden; position: relative;
  }
  .canvas-toolbar {
    width: 100%; padding: 8px 16px; background: var(--surface);
    border-bottom: 1px solid var(--border); display: flex; align-items: center;
    justify-content: center; gap: 8px; flex-shrink: 0; font-size: 11px; color: var(--muted);
  }
  .canvas-scroll { flex: 1; overflow-y: auto; width: 100%; display: flex; justify-content: center; padding: 20px; }
  .iframe-wrapper {
    background: #fff; border-radius: 8px; overflow: hidden;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5); transition: width .3s ease;
    flex-shrink: 0; position: relative;
  }
  .iframe-wrapper iframe { display: block; border: none; width: 100%; }

  /* Selected element highlight overlay */
  .select-hint {
    position: absolute; top: 8px; left: 50%; transform: translateX(-50%);
    background: rgba(124,92,252,0.9); color: #fff; padding: 4px 12px; border-radius: 20px;
    font-size: 11px; font-weight: 600; pointer-events: none; opacity: 0; transition: opacity .2s;
    z-index: 10; white-space: nowrap;
  }
  .select-hint.visible { opacity: 1; }

  /* ── Right panel: properties ─────────────────────────────── */
  .right-panel {
    width: var(--panel); background: var(--surface); border-left: 1px solid var(--border);
    display: flex; flex-direction: column; flex-shrink: 0; overflow: hidden;
  }
  .props-scroll { flex: 1; overflow-y: auto; padding: 12px; }
  .prop-section { margin-bottom: 18px; }
  .prop-section-title {
    font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em;
    color: var(--muted); margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid var(--border);
  }
  .prop-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .prop-label { font-size: 11px; color: var(--muted2); width: 70px; flex-shrink: 0; }
  .prop-input {
    flex: 1; padding: 6px 9px; background: var(--surface2); border: 1px solid var(--border2);
    border-radius: 7px; color: var(--text); font-size: 12px; outline: none; transition: border-color .15s;
    font-family: inherit; width: 100%;
  }
  .prop-input:focus { border-color: var(--accent); }
  .prop-input[type=color] { padding: 2px 4px; height: 30px; cursor: pointer; }
  .prop-input[type=range] { padding: 0; cursor: pointer; accent-color: var(--accent); }
  .prop-select {
    flex: 1; padding: 6px 9px; background: var(--surface2); border: 1px solid var(--border2);
    border-radius: 7px; color: var(--text); font-size: 12px; outline: none;
    cursor: pointer; transition: border-color .15s;
  }
  .prop-select:focus { border-color: var(--accent); }
  .prop-textarea {
    width: 100%; padding: 8px 10px; background: var(--surface2); border: 1px solid var(--border2);
    border-radius: 7px; color: var(--text); font-size: 12px; outline: none; resize: vertical;
    min-height: 80px; font-family: inherit; transition: border-color .15s;
  }
  .prop-textarea:focus { border-color: var(--accent); }
  .no-selection {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    height: 200px; color: var(--muted); font-size: 12px; text-align: center; gap: 8px; padding: 20px;
  }
  .no-selection-icon { font-size: 32px; opacity: .3; }

  /* ── Code panel ──────────────────────────────────────────── */
  .code-panel {
    height: 0; background: var(--surface); border-top: 1px solid var(--border);
    transition: height .25s ease; overflow: hidden; flex-shrink: 0; display: flex; flex-direction: column;
  }
  .code-panel.open { height: var(--code-panel); }
  .code-header {
    padding: 8px 14px; display: flex; align-items: center; justify-content: space-between;
    border-bottom: 1px solid var(--border); flex-shrink: 0;
  }
  .code-header-left { display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 600; color: var(--muted2); }
  .code-toggle-btn {
    padding: 3px 10px; border-radius: 5px; border: 1px solid var(--border2);
    background: transparent; color: var(--muted); cursor: pointer; font-size: 11px; transition: all .15s;
  }
  .code-toggle-btn:hover { color: var(--text); border-color: var(--border2); }
  .code-toggle-btn.active { background: rgba(124,92,252,0.15); border-color: var(--accent); color: var(--accent2); }
  #code-editor {
    flex: 1; padding: 12px 14px; background: var(--bg); color: #a0ffb0;
    font-family: 'Fira Code', 'Consolas', monospace; font-size: 11px;
    border: none; outline: none; resize: none; line-height: 1.6; overflow-y: auto;
  }
  .apply-code-btn {
    position: absolute; bottom: 10px; right: 14px; padding: 5px 14px; border-radius: 6px;
    background: var(--accent); color: #fff; border: none; cursor: pointer; font-size: 11px;
    font-weight: 600; transition: all .15s; z-index: 5;
  }
  .apply-code-btn:hover { background: var(--accent2); }
  .code-panel { position: relative; }

  /* ── Drag over ───────────────────────────────────────────── */
  .section-item.drag-over { background: rgba(124,92,252,0.2); border-color: var(--accent); }
  .section-item.dragging { opacity: .4; }

  /* ── Loading screen ──────────────────────────────────────── */
  .loading-screen {
    position: fixed; inset: 0; background: var(--bg); z-index: 100;
    display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 16px;
  }
  .spinner-lg {
    width: 40px; height: 40px; border: 3px solid var(--border2);
    border-top-color: var(--accent); border-radius: 50%; animation: spin .8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .loading-text { font-size: 14px; color: var(--muted2); }

  /* ── Scrollbars ──────────────────────────────────────────── */
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 99px; }

  /* ── Toast ───────────────────────────────────────────────── */
  .toast {
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(80px);
    background: var(--surface2); border: 1px solid var(--border2); color: var(--text);
    padding: 10px 20px; border-radius: 10px; font-size: 12px; font-weight: 600;
    transition: transform .3s ease; z-index: 999; white-space: nowrap;
  }
  .toast.show { transform: translateX(-50%) translateY(0); }
<\/style>
</head>
<body>

<div class="loading-screen" id="loading-screen">
  <div class="spinner-lg"></div>
  <div class="loading-text">Cargando editor...</div>
</div>

<!-- Header -->
<div class="editor-header">
  <div class="editor-logo">✏️ <span>Editor</span> Visual</div>

  <div class="header-center">
    <button class="viewport-btn active" onclick="setViewport('desktop')" id="vp-desktop" title="Desktop">🖥️</button>
    <button class="viewport-btn" onclick="setViewport('tablet')" id="vp-tablet" title="Tablet">📱</button>
    <button class="viewport-btn" onclick="setViewport('mobile')" id="vp-mobile" title="Mobile">📲</button>
    <div class="undo-redo">
      <button onclick="undo()" id="btn-undo" title="Deshacer" disabled>↩</button>
      <button onclick="redo()" id="btn-redo" title="Rehacer" disabled>↪</button>
    </div>
  </div>

  <div class="header-actions">
    <button class="code-toggle-btn" id="code-panel-btn" onclick="toggleCodePanel()">💻 Código</button>
    <button class="hbtn hbtn-ghost" onclick="copiarCodigoEditado()">📋 Copiar</button>
    <button class="hbtn hbtn-primary" onclick="descargarEditado()">⬇️ Descargar</button>
  </div>
</div>

<!-- Body -->
<div class="editor-body">

  <!-- Left: sections -->
  <div class="left-panel">
    <div class="panel-header">
      <span>Secciones</span>
      <span id="section-count" style="color:var(--muted)">—</span>
    </div>
    <div class="sections-list" id="sections-list"></div>
  </div>

  <!-- Center: canvas -->
  <div class="canvas-wrap">
    <div class="canvas-scroll" id="canvas-scroll">
      <div class="iframe-wrapper" id="iframe-wrapper">
        <div class="select-hint" id="select-hint">Click en cualquier elemento para editar</div>
        <iframe id="preview-frame" title="Preview"></iframe>
      </div>
    </div>
  </div>

  <!-- Right: properties -->
  <div class="right-panel">
    <div class="panel-header">
      <span>Propiedades</span>
      <span id="selected-tag" style="color:var(--accent2);font-size:10px"></span>
    </div>
    <div class="props-scroll" id="props-panel">
      <div class="no-selection">
        <div class="no-selection-icon">👆</div>
        <div>Clickeá un elemento en la página para editar sus propiedades</div>
      </div>
    </div>
  </div>
</div>

<!-- Code panel -->
<div class="code-panel" id="code-panel">
  <div class="code-header">
    <div class="code-header-left">💻 Editor de código — HTML completo</div>
    <div style="display:flex;gap:6px">
      <button class="code-toggle-btn" onclick="applyCode()" style="color:var(--accent3);border-color:rgba(52,211,153,0.4)">✅ Aplicar cambios</button>
      <button class="code-toggle-btn" onclick="resetCode()">↩ Restaurar</button>
    </div>
  </div>
  <textarea id="code-editor" spellcheck="false"></textarea>
</div>

<div class="toast" id="toast"></div>

<scr"+"ipt>
// ── State ────────────────────────────────────────────────────────────────────
let originalHTML = '';
let currentHTML = '';
let history = [];
let historyIdx = -1;
let selectedEl = null;
let sections = [];
let dragSrcIdx = null;
const VIEWPORTS = { desktop: 1200, tablet: 768, mobile: 375 };
let currentViewport = 'desktop';

// ── Init ─────────────────────────────────────────────────────────────────────
window.addEventListener('load', () => {
  // Try localStorage first (set by parent app)
  const html = localStorage.getItem('editor_landing_html');
  if (html && html.length > 100) {
    initEditor(html);
  } else {
    document.getElementById('loading-screen').innerHTML = \`
      <div style="text-align:center;padding:40px;max-width:400px">
        <div style="font-size:40px;margin-bottom:16px">⚠️</div>
        <div style="font-size:16px;color:#e8e8f0;margin-bottom:8px">No hay landing para editar</div>
        <div style="font-size:13px;color:#6b6b80">Generá una landing page primero desde la app y hacé click en "Editar".</div>
      </div>\`;
  }
});

function initEditor(html) {
  originalHTML = html;
  currentHTML = html;
  pushHistory(html);
  loadPreview(html);
  buildSectionsList(html);
  document.getElementById('code-editor').value = html;
  setTimeout(() => {
    document.getElementById('loading-screen').style.display = 'none';
    showHint('Click en cualquier elemento para editar · Arrastrá secciones para reordenar');
  }, 600);
}

// ── Preview ──────────────────────────────────────────────────────────────────
function loadPreview(html) {
  const frame = document.getElementById('preview-frame');
  const injected = injectEditorBridge(html);
  const blob = new Blob([injected], { type: 'text/html' });
  frame.src = URL.createObjectURL(blob);
  frame.onload = () => {
    setViewport(currentViewport, true);
  };
}

function injectEditorBridge(html) {
  const bridge = \`
<style>
  [data-editable]:hover { outline: 2px dashed rgba(124,92,252,0.6) !important; outline-offset: 2px !important; cursor: pointer !important; }
  [data-editable].ed-selected { outline: 2px solid #7c5cfc !important; outline-offset: 2px !important; }
<\/style>
<scr"+"ipt>
(function() {
  var editorReady = false;

  function markAll() {
    // Mark editable leaf elements
    var idx = 0;
    ['h1','h2','h3','h4','h5','h6','p','span','a','button','li','label','strong','em'].forEach(function(tag) {
      document.querySelectorAll(tag).forEach(function(el) {
        el.setAttribute('data-editable', idx++);
      });
    });

    // Mark sections: prefer <section>/<header>/<footer>, fallback to direct body children
    var secEls = Array.from(document.querySelectorAll('section, header, footer, nav, main'));
    if (secEls.length < 2) {
      secEls = Array.from(document.body.children).filter(function(el) {
        return !['SCRIPT','STYLE','LINK','META'].includes(el.tagName);
      });
    }
    secEls.forEach(function(el, i) { el.setAttribute('data-sec-idx', i); });

    // Send section list to parent
    var list = secEls.map(function(el, i) {
      var h = el.querySelector('h1,h2,h3,h4,h5,h6');
      var name = h ? h.textContent.trim().substring(0,40) : (el.id || el.className.split(' ')[0] || el.tagName + ' ' + i);
      return { idx: i, name: name.substring(0,40), tag: el.tagName.toLowerCase(), visible: el.style.display !== 'none' };
    });
    window.parent.postMessage({ type: 'sectionList', sections: list }, '*');
    editorReady = true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', markAll);
  } else {
    setTimeout(markAll, 300);
  }

  // Click handler — select editable element
  document.addEventListener('click', function(e) {
    e.preventDefault(); e.stopPropagation();
    var el = e.target.closest('[data-editable]');
    if (!el) return;
    document.querySelectorAll('.ed-selected').forEach(function(x) { x.classList.remove('ed-selected'); });
    el.classList.add('ed-selected');
    var cs = window.getComputedStyle(el);
    window.parent.postMessage({
      type: 'elementSelected',
      idx: el.getAttribute('data-editable'),
      tag: el.tagName.toLowerCase(),
      text: el.textContent.trim(),
      styles: {
        color: cs.color, backgroundColor: cs.backgroundColor,
        fontSize: cs.fontSize, fontWeight: cs.fontWeight,
        fontFamily: cs.fontFamily, textAlign: cs.textAlign,
        lineHeight: cs.lineHeight, padding: cs.padding,
        borderRadius: cs.borderRadius,
        href: el.tagName === 'A' ? (el.getAttribute('href') || '') : null
      }
    }, '*');
  }, true);

  // Message handler — receive commands from editor
  window.addEventListener('message', function(e) {
    var d = e.data;
    if (!d || !d.type) return;

    if (d.type === 'applyStyle') {
      var el = document.querySelector('[data-editable="' + d.idx + '"]');
      if (!el) return;
      if (d.prop === 'textContent') { el.textContent = d.value; return; }
      if (d.prop === 'href') { el.setAttribute('href', d.value); return; }
      el.style[d.prop] = d.value;
    }

    if (d.type === 'scrollToSection') {
      var sec = document.querySelector('[data-sec-idx="' + d.idx + '"]');
      if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    if (d.type === 'toggleSection') {
      var sec = document.querySelector('[data-sec-idx="' + d.idx + '"]');
      if (sec) sec.style.display = d.visible ? '' : 'none';
    }

    if (d.type === 'rearrange') {
      var all = Array.from(document.querySelectorAll('[data-sec-idx]'));
      var from = all.find(function(el) { return el.getAttribute('data-sec-idx') == d.fromIdx; });
      var to   = all.find(function(el) { return el.getAttribute('data-sec-idx') == d.toIdx; });
      if (from && to && from.parentNode === to.parentNode) {
        if (d.fromIdx < d.toIdx) { to.parentNode.insertBefore(from, to.nextSibling); }
        else { to.parentNode.insertBefore(from, to); }
      }
    }

    if (d.type === 'getHTML') {
      // Strip editor attributes before exporting clean HTML
      document.querySelectorAll('[data-editable]').forEach(function(el) { el.removeAttribute('data-editable'); });
      document.querySelectorAll('[data-sec-idx]').forEach(function(el) { el.removeAttribute('data-sec-idx'); });
      document.querySelectorAll('.ed-selected').forEach(function(el) { el.classList.remove('ed-selected'); });
      window.parent.postMessage({ type: 'currentHTML', html: '<!DOCTYPE html>\n' + document.documentElement.outerHTML }, '*');
      // Re-mark after export
      setTimeout(markAll, 150);
    }
  });
})();
<\/script>\`;
  return html.replace('</head>', bridge + '</head>');
}

// ── Message handler ──────────────────────────────────────────────────────────
window.addEventListener('message', (e) => {
  if (!e.data || !e.data.type) return;
  if (e.data.type === 'elementSelected') {
    selectedEl = e.data;
    buildPropsPanel(e.data);
    document.getElementById('selected-tag').textContent = '<' + e.data.tag + '>';
  }
  if (e.data.type === 'currentHTML') {
    currentHTML = e.data.html;
    document.getElementById('code-editor').value = currentHTML;
    pushHistory(currentHTML);
  }
  // Receive real section list from the iframe
  if (e.data.type === 'sectionList') {
    sections = e.data.sections.map(s => ({ ...s, visible: true }));
    renderSectionsList();
    document.getElementById('section-count').textContent = sections.length + ' secciones';
  }
});

// ── Apply style from props ───────────────────────────────────────────────────
function applyStyleToFrame(prop, value) {
  if (!selectedEl) return;
  document.getElementById('preview-frame').contentWindow.postMessage({
    type: 'applyStyle', idx: selectedEl.idx, prop, value
  }, '*');
  // Request updated HTML after a small delay
  setTimeout(requestHTMLFromFrame, 200);
}

function requestHTMLFromFrame() {
  document.getElementById('preview-frame').contentWindow.postMessage({ type: 'getHTML' }, '*');
}

// ── Properties panel ─────────────────────────────────────────────────────────
function buildPropsPanel(el) {
  const panel = document.getElementById('props-panel');
  const s = el.styles;

  const isTextEl = ['h1','h2','h3','h4','h5','h6','p','span','li','td','label','strong'].includes(el.tag);
  const isBtn = ['a','button'].includes(el.tag);

  panel.innerHTML = \`
    <div class="prop-section">
      <div class="prop-section-title">✏️ Contenido</div>
      \${isBtn ? \`
        <div class="prop-row">
          <div class="prop-label">Texto</div>
          <input class="prop-input" type="text" value="\${escHtml(el.text)}" oninput="applyStyleToFrame('textContent', this.value)" />
        </div>
        <div class="prop-row">
          <div class="prop-label">Link URL</div>
          <input class="prop-input" type="text" value="\${escHtml(s.href||'')}" oninput="applyStyleToFrame('href', this.value)" />
        </div>
      \` : \`
        <div class="prop-row" style="flex-direction:column;align-items:stretch">
          <div class="prop-label" style="width:auto;margin-bottom:5px">Texto</div>
          <textarea class="prop-textarea" oninput="applyStyleToFrame('textContent', this.value)">\${escHtml(el.text)}</textarea>
        </div>
      \`}
    </div>

    <div class="prop-section">
      <div class="prop-section-title">🎨 Colores</div>
      <div class="prop-row">
        <div class="prop-label">Texto</div>
        <input class="prop-input" type="color" value="\${rgbToHex(s.color)}" oninput="applyStyleToFrame('color', this.value)" />
        <input class="prop-input" type="text" value="\${rgbToHex(s.color)}" style="flex:1;font-size:11px" oninput="applyStyleToFrame('color', this.value)" />
      </div>
      <div class="prop-row">
        <div class="prop-label">Fondo</div>
        <input class="prop-input" type="color" value="\${rgbToHex(s.backgroundColor)}" oninput="applyStyleToFrame('backgroundColor', this.value)" />
        <input class="prop-input" type="text" value="\${rgbToHex(s.backgroundColor)}" style="flex:1;font-size:11px" oninput="applyStyleToFrame('backgroundColor', this.value)" />
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">🔤 Tipografía</div>
      <div class="prop-row">
        <div class="prop-label">Fuente</div>
        <select class="prop-select" onchange="applyStyleToFrame('fontFamily', this.value)">
          \${['Inter','Syne','DM Sans','Poppins','Outfit','Montserrat','Playfair Display','Oswald','Raleway','Lato','Roboto','Space Grotesk'].map(f =>
            \`<option value="\${f}" \${s.fontFamily.includes(f)?'selected':''}>\${f}</option>\`
          ).join('')}
        </select>
      </div>
      <div class="prop-row">
        <div class="prop-label">Tamaño</div>
        <input class="prop-input" type="number" value="\${parseInt(s.fontSize)||16}" min="8" max="200"
          oninput="applyStyleToFrame('fontSize', this.value+'px')" style="flex:1" />
        <span style="color:var(--muted);font-size:11px">px</span>
      </div>
      <div class="prop-row">
        <div class="prop-label">Peso</div>
        <select class="prop-select" onchange="applyStyleToFrame('fontWeight', this.value)">
          \${['300','400','500','600','700','800','900'].map(w =>
            \`<option value="\${w}" \${s.fontWeight==w?'selected':''}>\${w}</option>\`
          ).join('')}
        </select>
      </div>
      <div class="prop-row">
        <div class="prop-label">Alineación</div>
        <div style="display:flex;gap:4px;flex:1">
          \${['left','center','right'].map(a =>
            \`<button onclick="applyStyleToFrame('textAlign','\${a}')" style="flex:1;padding:5px;border-radius:6px;border:1px solid var(--border2);background:\${s.textAlign===a?'rgba(124,92,252,0.2)':'transparent'};color:\${s.textAlign===a?'var(--accent2)':'var(--muted)'};cursor:pointer;font-size:13px">\${a==='left'?'⬅️':a==='center'?'↔️':'➡️'}</button>\`
          ).join('')}
        </div>
      </div>
      <div class="prop-row">
        <div class="prop-label">Interlineado</div>
        <input class="prop-input" type="range" min="1" max="3" step="0.1"
          value="\${parseFloat(s.lineHeight)||1.5}" oninput="applyStyleToFrame('lineHeight', this.value)" style="flex:1" />
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">📐 Espaciado</div>
      <div class="prop-row">
        <div class="prop-label">Padding</div>
        <input class="prop-input" type="text" value="\${s.padding||'0'}" placeholder="ej: 12px 20px"
          oninput="applyStyleToFrame('padding', this.value)" />
      </div>
      <div class="prop-row">
        <div class="prop-label">Border R.</div>
        <input class="prop-input" type="text" value="\${s.borderRadius||'0'}" placeholder="ej: 8px"
          oninput="applyStyleToFrame('borderRadius', this.value)" />
      </div>
    </div>\`;
}

// ── Sections panel ───────────────────────────────────────────────────────────
function buildSectionsList(html) {
  // Sections come from the iframe via 'sectionList' message after it loads.
  // Show a placeholder until the iframe responds.
  sections = [];
  document.getElementById('sections-list').innerHTML =
    '<div style="padding:16px;color:var(--muted);font-size:12px;text-align:center">Cargando secciones...</div>';
  document.getElementById('section-count').textContent = '—';
}

function renderSectionsList() {
  const icons = { header: '🎯', hero: '⭐', section: '📦', footer: '📄', nav: '🧭', div: '▫️' };
  const list = document.getElementById('sections-list');
  list.innerHTML = sections.map((s, i) => \`
    <div class="section-item \${s.visible ? '' : 'hidden-section'}" data-idx="\${i}"
      draggable="true"
      ondragstart="dragStart(\${i})" ondragover="dragOver(event,\${i})" ondrop="drop(event,\${i})" ondragleave="dragLeave(event)"
      onclick="scrollToSection(\${i})">
      <span class="section-drag-handle">⠿</span>
      <span class="section-icon">\${icons[s.tag] || '📦'}</span>
      <span class="section-name">\${escHtml(s.name)}</span>
      <div class="section-actions">
        <button class="sec-btn" onclick="event.stopPropagation();moveSection(\${i},-1)" title="Subir">↑</button>
        <button class="sec-btn" onclick="event.stopPropagation();moveSection(\${i},1)" title="Bajar">↓</button>
        <button class="sec-btn" onclick="event.stopPropagation();toggleSection(\${i})" title="\${s.visible?'Ocultar':'Mostrar'}">\${s.visible?'👁':'🚫'}</button>
      </div>
    </div>\`).join('');
}

function scrollToSection(idx) {
  const frame = document.getElementById('preview-frame');
  const sec = sections[idx];
  if (sec) {
    frame.contentWindow.postMessage({ type: 'scrollToSection', idx: sec.idx }, '*');
  }
  document.querySelectorAll('.section-item').forEach((el, i) => el.classList.toggle('selected', i === idx));
}

function moveSection(idx, dir) {
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= sections.length) return;
  [sections[idx], sections[newIdx]] = [sections[newIdx], sections[idx]];
  renderSectionsList();
  rearrangeSectionsInFrame(idx, newIdx);
}

function toggleSection(idx) {
  sections[idx].visible = !sections[idx].visible;
  renderSectionsList();
  document.getElementById('preview-frame').contentWindow.postMessage({
    type: 'toggleSection', idx: sections[idx].idx, visible: sections[idx].visible
  }, '*');
}

function rearrangeSectionsInFrame(fromIdx, toIdx) {
  document.getElementById('preview-frame').contentWindow.postMessage({
    type: 'rearrange', fromIdx: sections[fromIdx]?.idx ?? fromIdx, toIdx: sections[toIdx]?.idx ?? toIdx
  }, '*');
  setTimeout(requestHTMLFromFrame, 300);
}

// ── Drag & Drop sections ─────────────────────────────────────────────────────
function dragStart(idx) { dragSrcIdx = idx; setTimeout(() => document.querySelectorAll('.section-item')[idx]?.classList.add('dragging'), 0); }
function dragOver(e, idx) { e.preventDefault(); document.querySelectorAll('.section-item').forEach(el => el.classList.remove('drag-over')); document.querySelectorAll('.section-item')[idx]?.classList.add('drag-over'); }
function dragLeave(e) { e.target.closest('.section-item')?.classList.remove('drag-over'); }
function drop(e, toIdx) {
  e.preventDefault();
  document.querySelectorAll('.section-item').forEach(el => { el.classList.remove('drag-over'); el.classList.remove('dragging'); });
  if (dragSrcIdx === null || dragSrcIdx === toIdx) return;
  moveSection(dragSrcIdx, toIdx > dragSrcIdx ? 1 : -1);
  dragSrcIdx = null;
}

// ── Viewport ─────────────────────────────────────────────────────────────────
function setViewport(vp, force) {
  if (vp === currentViewport && !force) return;
  currentViewport = vp;
  ['desktop','tablet','mobile'].forEach(v => {
    document.getElementById('vp-' + v).classList.toggle('active', v === vp);
  });
  const wrap = document.getElementById('iframe-wrapper');
  const scroll = document.getElementById('canvas-scroll');
  const scrollW = scroll.clientWidth - 40;
  const w = Math.min(VIEWPORTS[vp], scrollW);
  wrap.style.width = w + 'px';
  const frame = document.getElementById('preview-frame');
  frame.style.height = (window.innerHeight - 120) + 'px';
}

window.addEventListener('resize', () => setViewport(currentViewport, true));

// ── Code panel ───────────────────────────────────────────────────────────────
let codePanelOpen = false;
function toggleCodePanel() {
  codePanelOpen = !codePanelOpen;
  document.getElementById('code-panel').classList.toggle('open', codePanelOpen);
  document.getElementById('code-panel-btn').classList.toggle('active', codePanelOpen);
  if (codePanelOpen) {
    document.getElementById('code-editor').value = currentHTML;
  }
}

function applyCode() {
  const code = document.getElementById('code-editor').value;
  currentHTML = code;
  pushHistory(code);
  loadPreview(code);
  buildSectionsList(code);
  showToast('✅ Código aplicado');
}

function resetCode() {
  document.getElementById('code-editor').value = currentHTML;
}

// ── History ───────────────────────────────────────────────────────────────────
function pushHistory(html) {
  history = history.slice(0, historyIdx + 1);
  history.push(html);
  historyIdx = history.length - 1;
  updateUndoRedo();
}

function undo() {
  if (historyIdx <= 0) return;
  historyIdx--;
  currentHTML = history[historyIdx];
  loadPreview(currentHTML);
  updateUndoRedo();
}

function redo() {
  if (historyIdx >= history.length - 1) return;
  historyIdx++;
  currentHTML = history[historyIdx];
  loadPreview(currentHTML);
  updateUndoRedo();
}

function updateUndoRedo() {
  document.getElementById('btn-undo').disabled = historyIdx <= 0;
  document.getElementById('btn-redo').disabled = historyIdx >= history.length - 1;
}

// ── Export ────────────────────────────────────────────────────────────────────
function descargarEditado() {
  requestHTMLFromFrame();
  setTimeout(() => {
    const blob = new Blob([currentHTML], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'landing-editada.html';
    a.click();
    showToast('⬇️ Descargando...');
  }, 300);
}

function copiarCodigoEditado() {
  requestHTMLFromFrame();
  setTimeout(() => {
    navigator.clipboard.writeText(currentHTML).then(() => showToast('📋 Código copiado'));
  }, 300);
}

// ── Utils ─────────────────────────────────────────────────────────────────────
function rgbToHex(rgb) {
  if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return '#000000';
  if (rgb.startsWith('#')) return rgb;
  const result = rgb.match(/\\d+/g);
  if (!result || result.length < 3) return '#000000';
  return '#' + result.slice(0,3).map(x => parseInt(x).toString(16).padStart(2,'0')).join('');
}

function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function showHint(msg) {
  const h = document.getElementById('select-hint');
  h.textContent = msg;
  h.classList.add('visible');
  setTimeout(() => h.classList.remove('visible'), 3500);
}
<\/script>
</body>
</html>
`;
  const blob = new Blob([editorHTML], { type: 'text/html' });
  window.open(URL.createObjectURL(blob), '_blank');
}

function copiarCodigo() {
  if (appState.codigoHTML) {
    navigator.clipboard.writeText(appState.codigoHTML).then(() => {
      alert('✅ Código copiado al portapapeles');
    });
  }
}

function descargarHTML() {
  if (!appState.codigoHTML) return;
  const blob = new Blob([appState.codigoHTML], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (appState.nombreProducto || 'landing-page').replace(/\s+/g, '-').toLowerCase() + '.html';
  a.click();
}

function descargarIndexHTML() {
  if (!appState.codigoHTML) return;
  const blob = new Blob([appState.codigoHTML], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'index.html';
  a.click();
}

function descargarLiquid() {
  if (!appState.codigoHTML) return;
  const blob = new Blob([appState.codigoHTML], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (appState.nombreProducto || 'landing-page').replace(/\s+/g, '-').toLowerCase() + '.liquid';
  a.click();
}

// ─── Step 3: Contenido ────────────────────────────────────────────────────────
async function generarContenido() {
  const platform = appState.platform || 'TikTok';
  const contentType = appState.contentType || 'Antes/Después del resultado';
  const cant = document.getElementById('cant-guiones').value;

  const sys = `Eres director creativo de contenido viral sin cara para el mercado hispanohablante. Dominás los mecanismos de distribución de ${platform} en ${getAppYear()}: qué señales mide el algoritmo, qué patrones de atención retienen el scroll y cómo construir un embudo de contenido que convierte audiencia en compradores. Entregás guiones ejecutables con texto literal listo para grabar — no descripciones de guiones ni estructuras vacías. Cada recomendación está calibrada para producción sin mostrar cara: texto en pantalla, B-roll, mockups, voice-over, animaciones de texto.`;
  const prompt = `${cant} guiones de contenido viral sin cara para ${platform} (${getAppYear()}).
Producto: ${appState.nombreProducto || appState.producto || 'Producto digital'}
Nicho: ${appState.nicho || 'General'}
Tipo de contenido: ${contentType}
Promesa/hook del producto: ${appState.giro || 'transformación del cliente'}
Audiencia objetivo: ${appState.audiencia || 'hispanohablantes interesados en el nicho'}

REGLA CRÍTICA: Cada guión debe tener un ángulo psicológico completamente distinto. No es el mismo concepto con diferente hook — son estrategias narrativas diferentes.

Para CADA guión usá este formato exacto:

---
## 🎬 GUIÓN [N]: [NOMBRE DEL ÁNGULO] | [duración en seg] | [emoción dominante]

**HOOK (0–3s) — EL MÁS IMPORTANTE:**
Texto literal en pantalla: "[...]"
Qué se ve visualmente: [descripción específica]
Por qué para el scroll: [mecanismo psicológico en 1 línea]

**DESARROLLO (segundo a segundo):**
[0:03–0:08] Texto en pantalla: "[...]" | Visual: [qué se ve]
[0:08–0:15] Texto en pantalla: "[...]" | Visual: [qué se ve]
[continúa hasta el final]

**CTA (últimos 3–5 segundos):**
Texto en pantalla: "[...]"
Acción específica que pide: [qué hace el espectador]
Puente al producto: [cómo conecta con la venta sin vender directamente]

**PRODUCCIÓN:**
Audio: [tipo de música/sonido] | Por qué funciona para este contenido
Transiciones: [ritmo de cortes, efectos si aplica]
Herramientas: [CapCut / Canva / pantalla de teléfono / etc.]
Dificultad de producción: ★☆☆ / ★★☆ / ★★★

**MÉTRICAS ESPERADAS:**
Tasa de retención objetivo: [%] | Por qué este formato la logra
Señal principal al algoritmo: [qué métrica prioriza este guión]
---

## 📅 CALENDARIO 7 DÍAS
| Día | Guión # | Mejor hora LATAM | Objetivo del día (awareness / consideración / conversión) |
Incluí variedad de ángulos y una progresión lógica de frío a caliente.`;

  const contResult = await callClaude(sys, prompt, 'contenido-output', 'Generando guiones de contenido...', TEMP.viral);
  if (contResult) { const contOut = document.getElementById('contenido-output'); if (contOut) renderOutput(contOut, contResult, 'hooks'); }
  markDone(3); incrementUsage();
}

// ─── Step 4: Anuncios ─────────────────────────────────────────────────────────
async function generarAnuncios() {
  const tipoAd = appState.adType || 'Imagen estática + texto';
  const objetivo = document.getElementById('objetivo-ad').value;
  const cant = document.getElementById('cant-ads').value;

  const sys = `Eres media buyer y copywriter de respuesta directa especializado en Meta Ads para productos digitales en Latinoamérica. Tu trabajo es generar anuncios que detengan el scroll, activen una emoción específica y conduzcan a un clic con intención de compra. Conocés las políticas de Meta, los formatos de mayor CTR en ${getAppYear()} y cómo estructurar copy que funciona tanto en frío como en retargeting. No escribís plantillas — escribís anuncios reales listos para publicar.`;
  const prompt = `${cant} ángulos de anuncio para Meta Ads:
Producto: ${appState.nombreProducto || appState.producto || 'Producto digital'} · Nicho: ${appState.nicho || 'General'} · Precio: ${appState.precio || 'A definir'} · Tipo de creativo: ${tipoAd} · Objetivo: ${objetivo} · Promesa central: ${appState.giro || appState.transformacion || 'transformación del cliente'}

REGLA: Cada ángulo debe atacar una motivación psicológica diferente. No varíes solo el tono — cambiá el argumento central.

Para CADA ángulo:

---
## 📣 ÁNGULO [N]: [NOMBRE DESCRIPTIVO DEL ARGUMENTO]

**Disparador psicológico:** [motivación específica que activa — FOMO / dolor / identidad / aspiración / prueba social / etc.] + por qué funciona para esta audiencia

**TEXTO PRINCIPAL (primary text):**
[Copy completo listo para pegar. Párrafos cortos. Emojis estratégicos si aplica. Máx 150 palabras para mobile.]

**HEADLINE:** [máx 40 caracteres — el argumento de venta más fuerte en una línea]

**DESCRIPCIÓN:** [1 línea que refuerza el headline sin repetirlo]

**CTA:** [botón específico: Más información / Comprar / Descargar / Ver más]

**CREATIVIDAD RECOMENDADA:**
Formato: [imagen estática / video / carrusel / reels]
Qué mostrar visualmente: [descripción específica de qué ver]
Texto en imagen/video: [si aplica, qué texto superponer]

**SEGMENTACIÓN SUGERIDA:**
Audiencia de intereses: [3-5 intereses específicos de Meta]
Edad y género: [rango específico justificado]
Tipo de campaña: [Frío / Lookalike / Retargeting]

**KPI OBJETIVO:** [CTR esperado / métrica que indica que funciona]
---

## 🔬 RECOMENDACIÓN DE TEST
Orden de prioridad para testear estos ángulos, con justificación. Presupuesto mínimo por ángulo para obtener datos estadísticamente significativos.`;

  const adResult = await callClaude(sys, prompt, 'anuncios-output', 'Generando ángulos y copy de anuncios...', TEMP.creativo);
  if (adResult) { const adOut = document.getElementById('anuncios-output'); if (adOut) renderOutput(adOut, adResult, 'ads'); }
  markDone(4); incrementUsage();
}

// ─── Step 5: Emails ───────────────────────────────────────────────────────────
async function generarEmails() {
  const leadMagnet = document.getElementById('lead-magnet').value;
  const tipo = document.getElementById('tipo-email').value;
  Object.assign(state, { leadMagnet, tipoEmail: tipo });

  const sys = `Eres copywriter senior especializado en email marketing para productos digitales en el mercado latinoamericano. Escribís emails que se abren, se leen hasta el final y convierten — porque parecen escritos por una persona real, no por un sistema. Dominás la progresión psicológica de una secuencia: construís confianza primero, después vendés. Cada email tiene un trabajo específico. Los asuntos no hacen click-bait — generan expectativa genuina. El copy no grita — persuade.`;
  const prompt = `Secuencia completa de emails: ${tipo}
Producto: ${appState.nombreProducto || appState.producto || 'Producto digital'}
Precio: ${appState.precio || 'a definir'}
Lead magnet entregado: ${leadMagnet || 'recurso gratuito del nicho'}
Nicho: ${appState.nicho || 'General'}
Audiencia: ${appState.audiencia || 'emprendedores digitales LATAM'}

REGLAS DE ESCRITURA:
- Asunto: máx 50 caracteres, sin spam words (gratis, URGENTE!, $$$), que genere curiosidad genuina
- Apertura: siempre con historia, pregunta o situación — nunca "Hola soy [nombre]..."
- Párrafos de máximo 3 líneas — respira en mobile
- 1 solo CTA por email, claro y específico
- Urgencia: construida narrativamente, no declarada
- Tono: como un amigo que sabe más que vos sobre el tema — no gurú, no vendedor

---
Para CADA email:

## 📧 EMAIL [N] — [NOMBRE DEL PROPÓSITO]

**📅 Cuándo enviar:** [día y hora exacta + justificación]
**🎯 Trabajo de este email:** [qué debe sentir / creer / hacer el lector después de leerlo]
**📊 Métrica de éxito:** [open rate objetivo / click rate objetivo]

**ASUNTO — 3 opciones para A/B test:**
A: [asunto 1] — [disparador psicológico]
B: [asunto 2] — [disparador psicológico]
C: [asunto 3] — [disparador psicológico]
★ Recomendado: [letra] — [por qué]

**Preview text:** [máx 90 caracteres, complementa el asunto sin repetirlo]

**CUERPO COMPLETO:**
[Email listo para copiar y pegar. Usa [NOMBRE] para personalización. Formato real, no esquema.]

**CTA:** Texto exacto del botón o link

**P.D.:** [si aplica — a menudo el segundo elemento más leído del email]
---`;

  await callClaude(sys, prompt, 'email-output', 'Escribiendo tu secuencia de emails...');
  markDone(5); incrementUsage();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function markDone(stepIdx) {
  doneSteps.add(stepIdx);
  const btn = document.getElementById('nav-' + stepIdx);
  if (btn && !btn.classList.contains('active')) btn.classList.add('done');
}

// ─── Step 0: Trend Hunter ─────────────────────────────────────────────────────
// ── Subcategory navigation ────────────────────────────────────────────────────
/** Activar la sub‑categoría seleccionada.
 *  Expuesta a `window` para que pueda ser llamada desde atributos `onclick`
 *  del HTML (ej.: `onclick="setSubcat(0,'nichos',this)"`).
 */
function setSubcat(step, subcat, btn) {
  console.log('UI: setSubcat ejecutando...');
  const subcats = document.getElementById(`subcats-${step}`);
  if (!subcats) {
      console.error('No se encontró el contenedor: subcats-'+step);
      return;
  }
  subcats.querySelectorAll('.subcat-btn').forEach(b => b.classList.remove('active'));
  const stepEl = document.getElementById(`step-${step}`);
  if (stepEl) {
    stepEl.querySelectorAll('.subcat-panel').forEach(p => p.classList.remove('active'));
  }
  if (btn) btn.classList.add('active');
  const panel = document.getElementById(`s${step}-${subcat}`);
  if (panel) {
      panel.classList.add('active');
  } else {
      console.error('No se encontró el panel: s'+step+'-'+subcat);
  }
}

window.setSubcat = setSubcat;

async function trendHunterAI(subcat) {


  let type, pais, outputId, loadingMsg, sys, prompt;

  if (subcat === 'nichos') {
    type    = document.getElementById('trend-type-nichos').value;
    pais    = document.getElementById('pais-nichos').value;
    outputId = 'trend-output-nichos';
    loadingMsg = 'Analizando nichos con potencial...';

    sys = `Eres analista senior de inteligencia de mercados para infoproductos digitales en Latinoamérica ${getAppYear()}. Tu análisis debe ser realista, basado en patrones observados y brutalmente honesto. Reglas estrictas: (1) Nunca inventés estadísticas ni tendencias. Si los datos son limitados, declarás explícitamente "Basado en patrones observados hasta 2025 y extrapolación lógica...". (2) Priorizás oportunidades accionables sobre consejos genéricos. (3) La saturación se evalúa con honestidad — no todo puede ser Baja. (4) Los ingresos reflejan el percentil 60 del mercado, no el caso excepcional. Respondés solo en español.`;

    prompt = `Analiza el mercado digital hispanohablante y devuelve SOLO un array JSON válido, sin texto extra, sin markdown.

Formato exacto:
[{"titulo":"Nombre del nicho","resumen":"Potencial mensual realista · Dirección de tendencia (Creciendo/Estable/Declinando) con razonamiento · Nivel de saturación honesto · Por qué esta oportunidad existe AHORA en ${getAppYear()} · Ángulo diferenciador disponible","tag":"Saturación Baja | Saturación Media | Saturación Alta","ingresos":"$X,000–$X,000 USD/mes (percentil 60, creador solo, bien ejecutado)"}]

Parámetros: tipo=${type}, mercado=${pais}, año=${getAppYear()}

Criterios de selección obligatorios:
- Incluir al menos 2 nichos emergentes con ventana de oportunidad menor a 12 meses
- Incluir al menos 1 nicho con saturación Media o Alta (honestidad sobre el mercado real)
- Cada nicho debe tener un ángulo diferenciador concreto disponible
- El resumen debe responder: qué vender, a quién, a qué precio y por qué ahora
- Señalá explícitamente si la proyección de ingresos es extrapolación lógica

Devuelve exactamente 10 nichos. SOLO el JSON array, nada más.`;

  } else if (subcat === 'viralidad') {
    type     = document.getElementById('trend-type-viralidad').value;
    const plat = document.getElementById('plataforma-viralidad').value;
    outputId = 'trend-output-viralidad';
    loadingMsg = 'Generando vectores virales...';

    sys = `Eres director creativo especializado en contenido viral sin cara para el mercado hispanohablante. Entendés los mecanismos de distribución de ${plat} en ${getAppYear()}: qué señales mide el algoritmo, qué patrones de atención retienen el scroll y cómo construir un embudo de contenido que convierte audiencia en compradores. No describís guiones — los escribís en detalle ejecutable. Cada entregable es texto listo para filmar, no inspiración.`;

    prompt = `Vectores virales para el nicho "${type}" en ${plat} (${getAppYear()}). Mercado: Latinoamérica hispanohablante.

## ⚡ 15 HOOKS — TEXTO LITERAL (primeras 3 segundos)
Agrupa 3 por cada tipo. Texto exacto en pantalla, no paráfrasis:
→ CURIOSIDAD (gap de información)
→ PROMESA CONCRETA (resultado específico en tiempo)
→ MIEDO/PÉRDIDA (lo que les está costando no saber esto)
→ SECRETO/REVELACIÓN (acceso a información exclusiva)
→ CONTROVERSIA CALCULADA (romper creencia establecida)

Para cada hook: texto literal | emoción activada | por qué funciona en ${plat}

## 🔥 10 TEMAS CON POTENCIAL +100K VISTAS
Para cada uno: título exacto del video | emoción dominante | razón de viralidad en ${getAppYear()} | formato ideal (duración + estructura)

## 🎬 5 FORMATOS SIN CARA — PRODUCCIÓN DETALLADA
Para cada formato: qué se ve en pantalla segundo a segundo | texto en pantalla exacto | tipo de audio | duración óptima | dificultad de producción (1-5)

## 📅 CALENDARIO 7 DÍAS
| Día | Tema | Hook exacto | Formato | Mejor hora para LATAM | Objetivo del video |

## 💡 2 PRODUCTOS QUE ESTA AUDIENCIA YA QUIERE COMPRAR
Para cada uno: nombre del producto | precio óptimo | promesa central | cómo hacer la transición desde el contenido | formato de producto recomendado`;

  } else if (subcat === 'competencia') {
    const nicho = document.getElementById('nicho-competencia').value || 'productos digitales en general';
    pais        = document.getElementById('pais-competencia').value;
    const tipo  = document.getElementById('tipo-competencia').value;
    outputId    = 'trend-output-competencia';
    loadingMsg  = 'Mapeando la competencia...';

    sys = `Eres analista de inteligencia competitiva especializado en el ecosistema de productos digitales hispanohablantes. Tu trabajo es mapear quién gana dinero, cuánto y por qué — y diseñar la estrategia de entrada para desplazarlos. Análisis específico, no teórico. Identificás vacíos reales, no genéricos.`;

    prompt = `Mapeo competitivo profundo: nicho "${nicho}" · mercado ${pais} · segmento ${tipo} (${getAppYear()})

## 🗺️ 5 JUGADORES DOMINANTES DEL NICHO
Para cada uno:
- Perfil (plataforma principal, audiencia estimada, estilo de contenido)
- Producto estrella (nombre, precio, formato, qué promete)
- Motor de tracción (cómo adquieren clientes: orgánico / ads / email / comunidad)
- Por qué ganan (el verdadero diferenciador, no el declarado)
- Punto débil explotable (lo que sus clientes se quejan o no obtienen)

## ❌ 3 VACÍOS DE MERCADO NO EXPLOTADOS
Para cada vacío: qué está faltando en el mercado | evidencia de que hay demanda | cómo posicionarte ahí

## 💎 3 ÁNGULOS DE DIFERENCIACIÓN REALES
Estrategias concretas para no competir en precio ni en volumen de contenido. Para cada ángulo: qué hacés diferente | a quién le habla | por qué es difícil de copiar

## 📊 MAPA DE PRECIOS DEL MERCADO
| Segmento | Rango de precio | Quiénes están aquí | Accesible para nuevo creador |
Precio mínimo viable · precio promedio de mercado · precio premium justificable

## 🚀 PLAN DE ENTRADA EN 30 DÍAS
Semana 1: posicionamiento y primer contenido de autoridad
Semana 2: primeras interacciones + validación
Semana 3: lanzamiento soft del producto / lead magnet
Semana 4: primeras ventas y ajuste
Meta realista: X seguidores / Y leads / Z ventas en el mes 1`;
  }

  await callClaude(sys, prompt, outputId, loadingMsg);
  incrementUsage();
}

async function generarTraficoGratis() {

  // Smart Context — heredar todo lo que el usuario ya configuró
  const producto = appState.nombreProducto || appState.producto || 'Producto digital';
  const nicho = appState.nicho || 'General';
  const precio = appState.precio || 'A definir';
  const mercado = appState.mercado || 'Latinoamérica';
  const audiencia = appState.audiencia || 'Emprendedores digitales';
  const giro = appState.giro || '';
  const tieneLanding = appState.copyLanding ? 'Sí — landing page ya generada con copy específico' : 'No generada aún';

  const sys = `Eres estratega de tráfico orgánico especializado en el embudo completo para infoproductos en Latinoamérica: desde el primer contacto con contenido hasta la compra. Diseñás sistemas de distribución personalizados — no recetas genéricas de "publicá 3 veces por día". Cada táctica que recomendás está calibrada para el producto, el nicho, la audiencia y el estadio actual del negocio. Priorizás velocidad de feedback: las primeras acciones generan datos que permiten ajustar antes de escalar.`;

  const prompt = `Plan de tráfico orgánico 30 días para este negocio específico (${getAppYear()}):

CONTEXTO:
- Producto: ${producto}
- Nicho: ${nicho}
- Precio: ${precio}
- Mercado: ${mercado}
- Audiencia: ${audiencia}
${giro ? `- Propuesta de valor: ${giro}` : ''}
- Landing page lista: ${tieneLanding}

PRINCIPIO RECTOR: Cada táctica debe generar datos de validación en los primeros 7 días. No hay acciones de "largo plazo" en el mes 1 — todo debe producir señales medibles.

---

## 📱 TIKTOK — SISTEMA DE CONTENIDO PARA ${nicho.toUpperCase()}

**Perfil de cuenta:** qué dice la bio, link en bio a qué dirige, foto/video de perfil
**3 hooks exactos adaptados al avatar de este nicho:**
1. "[texto literal]" → activa [emoción] → funciona porque [mecanismo]
2. "[texto literal]" → activa [emoción] → funciona porque [mecanismo]
3. "[texto literal]" → activa [emoción] → funciona porque [mecanismo]
**Tipos de contenido que venden ${producto} sin mostrar cara:** [formatos específicos]
**Frecuencia y horario para ${mercado}:** [días + horas con justificación]
**Embudo sin link en bio:** cómo llevás al espectador a comprarte cuando no podés poner link

## 📌 PINTEREST — TRÁFICO DE BÚSQUEDA PASIVO

**5 títulos de pines optimizados para SEO de búsqueda** (no para el feed):
1. [título] | Keyword principal: [keyword] | Volumen estimado: [bajo/medio/alto]
2. [título] | Keyword principal: [keyword] | Volumen estimado: [bajo/medio/alto]
3. [título] | Keyword principal: [keyword] | Volumen estimado: [bajo/medio/alto]
4. [título] | Keyword principal: [keyword] | Volumen estimado: [bajo/medio/alto]
5. [título] | Keyword principal: [keyword] | Volumen estimado: [bajo/medio/alto]
**Estructura de tableros a crear:** nombres exactos + descripción SEO del tablero
**CTA en los pines:** cómo convertís una visita de Pinterest en un clic a la landing de ${producto}
**Frecuencia:** pines por día / semana — herramienta recomendada para programar

## 👥 COMUNIDADES — FACEBOOK GROUPS + REDDIT

**5 tipos de grupos específicos donde está el avatar de ${nicho}:**
Para cada uno: tipo de grupo + tamaño ideal + cómo encontrarlo en Meta
**Script de primer post de autoridad:**
[texto completo listo para publicar — genera confianza, no vende directamente]
**Reglas para no ser baneado:** qué decir, qué evitar, cuándo y cómo mencionar el producto
**Calendario de interacciones:** semana 1 solo valor, semana 2 posicionamiento, semana 3-4 oferta

## 💬 ESTRATEGIA DE COMENTARIOS

**Tipos de cuentas a seguir y comentar en el nicho ${nicho}:**
[categorías de cuentas con ejemplos del tipo]
**Template de comentario que genera curiosidad y clics al perfil:**
[texto real, adaptable — agrega valor, no hace spam]
**Volumen diario:** X comentarios / día · días a la semana · tiempo estimado

## 📧 LEAD MAGNET PERSONALIZADO PARA ${producto.toUpperCase()}

**Lead magnet recomendado:** nombre + formato + por qué atrae a compradores del producto (no solo curiosos)
**Título exacto:** "[título que genera descarga]"
**Cómo promoverlo gratis en cada plataforma:** instrucciones específicas por canal
**Herramienta gratuita para entregarlo:** [Brevo / MailerLite / Beehiiv + por qué]

## 🗓️ PLAN SEMANA A SEMANA — ACCIONES DIARIAS

### SEMANA 1 — CONFIGURACIÓN Y PRIMER CONTENIDO (Objetivo: primeras señales)
Lunes: [acción específica + tiempo estimado]
Martes: [acción específica + tiempo estimado]
Miércoles: [acción específica + tiempo estimado]
Jueves: [acción específica + tiempo estimado]
Viernes: [acción específica + tiempo estimado]
Sábado: [acción específica + tiempo estimado]
Domingo: [acción específica + tiempo estimado]
KPI al final de semana 1: [métrica concreta que dice si vas bien]

### SEMANA 2 — VALIDACIÓN (Objetivo: primeros leads)
[7 días con acciones específicas]
KPI al final de semana 2: [métrica concreta]

### SEMANA 3–4 — ITERACIÓN Y PRIMERAS VENTAS (Objetivo: primera venta)
[Resumen de acciones + ajustes según datos de semanas 1-2]
KPI al final del mes: [métrica concreta]

## 📊 PROYECCIÓN REALISTA A 30 DÍAS
| Canal | Visitas estimadas | Leads estimados | Ventas estimadas |
| TikTok | X | Y | Z |
| Pinterest | X | Y | Z |
| Comunidades | X | Y | Z |
| Total | X | Y | Z |

Inversión de tiempo total/semana: X horas
Si no llegás a la primera venta al día 30, el problema probable es: [diagnóstico específico para este nicho y producto]`;

  await callClaude(sys, prompt, 'trafico-output', 'Generando estrategia personalizada...', TEMP.creativo);
  incrementUsage();
}

// ══ NUEVA FUNCIÓN PREMIUM — Tráfico con Ola + Auto-descarga PDF ═══════════════
async function generarTraficoPremium() {

  // 1. Resetear UI de la Ola al estado "cargando"
  const box = document.getElementById('trafico-premium-box');
  const microcopy = document.getElementById('ola-microcopy');
  const successEl = document.getElementById('ola-success');
  const fallbackEl = document.getElementById('ola-fallback');

  microcopy.style.display = 'block';
  microcopy.textContent = 'Diseñando tu estrategia personalizada...';
  successEl.style.display = 'none';
  fallbackEl.classList.add('hidden');
  box.classList.remove('completed');

  // 2. Inyección de datos acumulativos (Smart Context)
  const producto = appState.nombreProducto || appState.producto || appState.businessCart?.selectedName || 'Producto digital';
  const nicho = appState.nicho || appState.businessCart?.selectedNiche?.titulo || 'General';
  const precio = appState.precio || appState.businessCart?.selectedPrice || 'A definir';
  const mercado = appState.mercado || 'Latinoamérica';
  const audiencia = appState.audiencia || appState.businessCart?.selectedAvatar?.nombre || 'Emprendedores digitales';
  const uvp = appState.giro || appState.businessCart?.selectedNiche?.resumen || '';
  const canales = appState.businessCart?.selectedCanal || 'Orgánico multicanal';
  const estrategia = appState.businessCart?.selectedStrategy || 'Contenido de valor + comunidad';
  const tieneLanding = appState.copyLanding ? 'Sí — landing page generada' : 'No generada aún';

  // 3. Prompt Maestro — Rol CMO de élite (según el informe)
  const sys = `Eres un Director de Marketing (CMO) experimentado con 15+ años de experiencia en startups digitales y escalamiento de infoproductos en Latinoamérica. Tu especialidad es diseñar estrategias de tráfico orgánico que generan ventas desde el día 1, no solo visitas. Cada recomendación debe ser táctica, accionable y adaptada EXACTAMENTE al producto, nicho, audiencia y canales del usuario. No des teoría — da un plan de guerra.`;

  const prompt = `Diseñá un plan de tráfico orgánico premium y personalizado para este negocio (${getAppYear()}):

## 📋 CONTEXTO DEL NEGOCIO (Inyectado desde sesión del usuario)
- **Producto:** ${producto}
- **Nicho:** ${nicho}
- **Precio:** ${precio}
- **Mercado objetivo:** ${mercado}
- **Avatar / Cliente Ideal:** ${audiencia}
- **Propuesta Única de Valor (UVP):** ${uvp || 'A definir por el usuario'}
//> Formato de salida: Texto en español latino, claro, con emojis estratégicos, títulos en negrita con **mardown**, listas con guiones. Sin JSON. Sin markdown de código. Que se vea profesional listo para imprimir.`;

  try {
    // 4. Llamar a la IA
    const text = await callClaudeRaw(sys, prompt, document.getElementById('trafico-output'), 'Diseñando tu estrategia personalizada...');

    if (!text) {
      microcopy.textContent = '⚠️ Error al generar la estrategia. Intentá de nuevo.';
      return;
    }

    // 5. Guardar el resultado para descarga
    window._ultimaEstrategiaTrafico = text;
    window._nombreProductoEstrategia = producto;

    // 6. Transición a estado "completado"
    microcopy.style.display = 'none';
    successEl.style.display = 'flex';
    box.classList.add('completed');

    // 7. Auto-descarga del PDF (disparo automático)
    setTimeout(() => {
      descargarEstrategiaPDF();
      // Mostrar fallback por si no descargó
      fallbackEl.classList.remove('hidden');
    }, 600);

    incrementUsage();

  } catch (err) {
    microcopy.textContent = '⚠️ Error: ' + (err.message || 'Intentalo de nuevo');
    console.error('[TraficoPremium]', err);
  }
}

// Descargar estrategia como documento profesional
function descargarEstrategiaPDF() {
  const text = window._ultimaEstrategiaTrafico;
  const nombre = window._nombreProductoEstrategia || 'estrategia';
  if (!text) return;

  const fecha = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  const year = getAppYear();

  // Generar HTML profesional con diseño tipo PDF premium
  const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Estrategia de Tráfico - ${nombre}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Inter', -apple-system, sans-serif;
    background: #0a0f1a;
    color: #e2e8f0;
    padding: 0;
    line-height: 1.7;
  }
  .paper {
    max-width: 800px; margin: 0 auto; padding: 48px 40px;
    background: linear-gradient(180deg, #0d1421 0%, #0a0f1a 100%);
    min-height: 100vh;
  }
  .header {
    text-align: center; padding-bottom: 32px;
    border-bottom: 1px solid rgba(56,189,248,0.15);
    margin-bottom: 32px;
  }
  .header-brand {
    font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em;
    color: rgba(56,189,248,0.6); margin-bottom: 12px;
  }
  .header-title {
    font-size: 28px; font-weight: 800; color: #f1f5f9;
    margin-bottom: 8px;
  }
  .header-sub {
    font-size: 14px; color: rgba(255,255,255,0.5);
  }
  .header-date {
    font-size: 12px; color: rgba(255,255,255,0.3); margin-top: 12px;
  }
  .section {
    margin-bottom: 28px;
    padding: 20px 24px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
  }
  .section h2 {
    font-size: 16px; font-weight: 700; color: #60b0f4;
    margin-bottom: 14px; display: flex; align-items: center; gap: 8px;
  }
  .section p, .section li {
    font-size: 13px; color: rgba(255,255,255,0.8); line-height: 1.8;
  }
  .section ul { padding-left: 20px; }
  .section li { margin-bottom: 6px; }
  .section strong { color: #f1f5f9; }
  .footer {
    text-align: center; padding-top: 32px; margin-top: 32px;
    border-top: 1px solid rgba(255,255,255,0.06);
    font-size: 11px; color: rgba(255,255,255,0.25);
  }
  .tag {
    display: inline-block; font-size: 10px; font-weight: 700;
    padding: 2px 10px; border-radius: 99px;
    background: rgba(56,189,248,0.1); color: #60b0f4;
    border: 1px solid rgba(56,189,248,0.2);
    margin-bottom: 8px; text-transform: uppercase; letter-spacing: .06em;
  }
  h3 {
    font-size: 14px; font-weight: 600; color: #cbd5e1;
    margin: 12px 0 6px;
  }
  table {
    width: 100%; border-collapse: collapse; margin: 12px 0;
    font-size: 12px;
  }
  table th {
    background: rgba(56,189,248,0.08);
    color: #60b0f4; font-weight: 600; padding: 8px 12px;
    text-align: left; border: 1px solid rgba(255,255,255,0.06);
  }
  table td {
    padding: 8px 12px; border: 1px solid rgba(255,255,255,0.06);
    color: rgba(255,255,255,0.7);
  }
  @media print {
    body { background: #0a0f1a; }
    .paper { padding: 24px; }
  }
</style>
</head>
<body>
<div class="paper">
  <div class="header">
    <div class="header-brand">⚡ AI Business OS — Plan de Tráfico</div>
    <div class="header-title">📈 Estrategia de Tráfico Orgánico</div>
    <div class="header-sub">${nombre}</div>
    <div class="header-date">Generado el ${fecha} · AI Business OS ${year}</div>
  </div>
  ${convertirTextoAHTML(text)}
  <div class="footer">
    AI Business OS — Digital Products Builder<br>
    Estrategia generada con IA · Revisá y adaptá según tu negocio
  </div>
</div>
<script>
  // Auto-print al abrir (opcional)
  setTimeout(() => { window.print(); }, 500);
<\/script>
</body>
</html>`;

  // Disparar descarga
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `estrategia-trafico-${nombre.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

// Helper: convertir texto plano con markdown simple a HTML
function convertirTextoAHTML(texto) {
  if (!texto) return '<p style="color:rgba(255,255,255,0.5)">Sin contenido disponible</p>';

  let html = '';
  const lineas = texto.split('\n');
  let enLista = false;

  for (let i = 0; i < lineas.length; i++) {
    let linea = lineas[i];
    const trimmed = linea.trim();

    // Saltos de línea vacíos
    if (trimmed === '') {
      if (enLista) { html += '</ul>'; enLista = false; }
      continue;
    }

    // Encabezados ##
    if (trimmed.startsWith('## ')) {
      if (enLista) { html += '</ul>'; enLista = false; }
      const titulo = trimmed.replace(/^##\s+/, '').replace(/\*\*/g, '').trim();
      html += `<div class="section"><h2>${titulo}</h2>`;
      // No cerramos aún — lo cerramos en la siguiente sección
      continue;
    }

    // Si comenzamos una sección, acumulamos contenido
    if (html.endsWith('</h2>')) {
      // La línea actual es contenido de la sección
      html += procesarLinea(trimmed, linea);
      // Cerramos la sección al final del bucle o en la siguiente ##
      continue;
    }

    // Línea normal fuera de sección
    if (enLista) { html += '</ul>'; enLista = false; }
    html += procesarLinea(trimmed, linea);
  }

  if (enLista) html += '</ul>';

  // Cerrar secciones abiertas
  html = html.replace(/<div class="section"><h2>/g, '</div><div class="section"><h2>');
  html = html.replace(/^<\/div>/, '');
  if (html.includes('<h2>') && !html.endsWith('</div>')) {
    html += '</div>';
  }
  // Wrap inicial si no hay secciones
  if (!html.includes('class="section"')) {
    html = `<div class="section">${html}</div>`;
  }

  return html;
}

function procesarLinea(trimmed, linea) {
  // Listas con guiones
  if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
    const texto = trimmed.replace(/^[-*]\s+/, '');
    const bolded = texto.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    return `<li>${bolded}</li>`;
  }
  // Listas numeradas
  if (/^\d+[\.\)]/.test(trimmed)) {
    const texto = trimmed.replace(/^\d+[\.\)]\s*/, '');
    const bolded = texto.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    return `<li>${bolded}</li>`;
  }
  // Tablas |
  if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
    return procesarTabla(linea);
  }
  // Texto normal
  const bolded = linea.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  return `<p>${bolded}</p>`;
}

function procesarTabla(linea) {
  // Simple: convertir línea de tabla en fila HTML
  const celdas = linea.split('|').filter(c => c.trim() !== '');
  if (celdas.length === 0) return '';
  // Detectar si es header (segunda línea con ---)
  const esSeparador = celdas.every(c => /^[\s\-:]+$/.test(c.trim()));
  if (esSeparador) return '';
  return `<tr>${celdas.map(c => `<td>${c.trim().replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</td>`).join('')}</tr>\n`;
}

// ─── Init ─────────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  attachModuleGlobals();
  applyDynamicYears();
  buildChips('platform-chips', platforms, 'platform', 'TikTok');
  buildChips('content-type-chips', contentTypes, 'contentType', 'Antes/Después del resultado');
  buildChips('ad-type-chips', adTypes, 'adType', 'Imagen estática + texto');

  // Show setup if no API key saved
  updateApiIndicator();
  if (!getApiKey()) {
    showApiKeySetup();
  }
  updateUsageDisplay();
  if (typeof initLandingGenerator === 'function') {
    initLandingGenerator();
  }
});

// ══ AUTH + PLANES + USAGE + ANTI-ABUSE ════════════════════════════════════════

const WORKER_URL = 'https://aibusiness.adrianbada0309.workers.dev';
const _sb = supabase.createClient('https://gbfipugbxdxsccbnokcy.supabase.co', 'sb_publishable_nOFsgZnd3_SSTcUuZiyk8g_Pt9Pr3qh');

// ── Configuración de planes ───────────────────────────────────────────────────
const PLANES = {
  free:      { nombre: 'Free',      diario: 5,  mensual: 30,   precio: 0  },
  estandar:  { nombre: 'Estándar',  diario: 10, mensual: 150,  precio: 9  },
  pro:       { nombre: 'Pro',       diario: 25, mensual: 500,  precio: 25 },
  premium:   { nombre: 'Premium',   diario: 50, mensual: null, precio: 35 }, // mensual null = ilimitado
};

// ── Dominios de email desechable (anti-multicuenta) ───────────────────────────
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com','guerrillamail.com','tempmail.com','10minutemail.com',
  'throwaway.email','yopmail.com','trashmail.com','fakeinbox.com',
  'sharklasers.com','guerrillamailblock.com','grr.la','guerrillamail.info',
  'spam4.me','dispostable.com','mailnull.com','spamgourmet.com',
  'trashmail.me','maildrop.cc','discard.email','spamhereplease.com',
  'tempr.email','discardmail.com','spamwc.de','spamfree24.org',
  'spammotel.com','spamoff.de','spamspot.com','spamthisplease.com',
  'tempinbox.com','throwam.com','spamgob.com','tmpmail.net',
  'getairmail.com','filzmail.com','mt2015.com','discard.cf',
]);

let currentUser = null;
let currentPlan = 'free';
let _authMode = 'login';

// ── Helpers de plan ───────────────────────────────────────────────────────────
function getPlanConfig() { return PLANES[currentPlan] || PLANES.free; }

function getLimiteColor(rem, diario) {
  const pct = rem / diario;
  if (pct <= 0.2) return '#ef4444';
  if (pct <= 0.5) return '#f59e0b';
  return '#34d399';
}

// ── Validación de email desechable ────────────────────────────────────────────
function isDisposableEmail(email) {
  const domain = email.split('@')[1]?.toLowerCase() || '';
  return DISPOSABLE_DOMAINS.has(domain);
}

// ── Auth ──────────────────────────────────────────────────────────────────────
function authTab(mode) {
  _authMode = mode;
  const isL = mode === 'login';
  const tl = document.getElementById('tab-login');
  const tr = document.getElementById('tab-register');
  const btn = document.getElementById('auth-btn');
  tl.style.background = isL ? 'rgba(56,189,248,0.15)' : 'transparent';
  tl.style.color = isL ? '#f1f5f9' : '#64748b';
  tl.style.borderColor = isL ? 'rgba(56,189,248,0.3)' : 'transparent';
  tr.style.background = !isL ? 'rgba(56,189,248,0.15)' : 'transparent';
  tr.style.color = !isL ? '#f1f5f9' : '#64748b';
  tr.style.borderColor = !isL ? 'rgba(56,189,248,0.3)' : 'transparent';
  btn.textContent = isL ? 'Iniciar sesión' : 'Crear cuenta gratis';
  document.getElementById('auth-error').style.display = 'none';
  document.getElementById('auth-success').style.display = 'none';
}

async function authSubmit() {
  const email = document.getElementById('auth-email').value.trim().toLowerCase();
  const pass  = document.getElementById('auth-password').value;
  const errEl = document.getElementById('auth-error');
  const btn   = document.getElementById('auth-btn');
  errEl.style.display = 'none';

  if (!email || !pass) { errEl.textContent = 'Completá email y contraseña'; errEl.style.display = 'block'; return; }
  if (pass.length < 6) { errEl.textContent = 'Contraseña mínimo 6 caracteres'; errEl.style.display = 'block'; return; }

  // Bloquear emails desechables en registro
  if (_authMode === 'register' && isDisposableEmail(email)) {
    errEl.textContent = 'Por favor usá un email real para registrarte.';
    errEl.style.display = 'block';
    return;
  }

  btn.textContent = 'Cargando...'; btn.disabled = true;

  // Safety timeout — nunca queda bloqueado más de 10 segundos
  const safetyTimer = setTimeout(() => {
    btn.textContent = _authMode === 'login' ? 'Iniciar sesión' : 'Crear cuenta gratis';
    btn.disabled = false;
    errEl.textContent = 'Tardó demasiado. Intentá de nuevo.';
    errEl.style.display = 'block';
  }, 10000);

  try {
    const r = _authMode === 'login'
      ? await _sb.auth.signInWithPassword({ email, password: pass })
      : await _sb.auth.signUp({ email, password: pass });
    if (r.error) throw r.error;
    if (_authMode === 'register' && !r.data.session) {
      clearTimeout(safetyTimer);
      document.getElementById('auth-success').style.display = 'block';
      btn.textContent = 'Crear cuenta gratis'; btn.disabled = false; return;
    }
    currentUser = r.data.user;
    // cargarPlanUsuario con timeout propio de 3 segundos
    await Promise.race([
      cargarPlanUsuario(),
      new Promise(res => setTimeout(res, 3000))
    ]);
    clearTimeout(safetyTimer);
    showApp();
  } catch(err) {
    clearTimeout(safetyTimer);
    const m = err.message || '';
    errEl.textContent = m.includes('Invalid login') ? 'Email o contraseña incorrectos'
      : m.includes('already registered') ? 'Email ya registrado. Iniciá sesión.'
      : m.includes('not confirmed') ? 'Confirmá tu email antes de entrar.'
      : m || 'Error. Intentá de nuevo.';
    errEl.style.display = 'block';
    btn.textContent = _authMode === 'login' ? 'Iniciar sesión' : 'Crear cuenta gratis';
    btn.disabled = false;
  }
}

async function authLogout() {
  await _sb.auth.signOut();
  window.location.href = 'index.html';
}

async function showApp() {
  document.getElementById('auth-overlay').style.display = 'none';
  document.getElementById('user-info').style.display = 'flex';

  // Avatar con inicial
  const email = currentUser?.email || '';
  const name = email.split('@')[0];
  const initial = name.charAt(0).toUpperCase();

  const avatarCircle = document.getElementById('avatar-circle');
  if (avatarCircle) avatarCircle.textContent = initial;

  const dropdownName = document.getElementById('avatar-dropdown-name');
  if (dropdownName) dropdownName.textContent = name;

  // Badge del plan en dropdown
  const plan = getPlanConfig();
  const dropdownPlan = document.getElementById('avatar-dropdown-plan');
  if (dropdownPlan) {
    dropdownPlan.textContent = plan.nombre;
    dropdownPlan.className = 'avatar-dropdown-plan badge-' + currentPlan;
  }

  // Color del ring según plan
  const ringColors = { free: '#64748b', estandar: '#38bdf8', pro: '#34d399', premium: '#a855f7' };
  const ringFill = document.getElementById('avatar-ring-fill');
  if (ringFill) ringFill.style.stroke = ringColors[currentPlan] || '#38bdf8';

  await updateUsageDisplay();
  updateAvatarRing();
  initDashboard();
}

function updateAvatarRing() {
  const plan = getPlanConfig();
  const ringFill = document.getElementById('avatar-ring-fill');
  if (!ringFill) return;
  // Calcular uso actual del topbar
  const numEl = document.getElementById('usage-num');
  const limitEl = document.getElementById('usage-limit');
  if (!numEl || !limitEl) return;
  const rem = parseInt(numEl.textContent) || 0;
  const total = parseInt(limitEl.textContent) || plan.diario;
  const pct = total > 0 ? rem / total : 1;
  const circumference = 119.4;
  ringFill.style.strokeDashoffset = circumference * (1 - pct);
}

function toggleAvatarMenu() {
  const dd = document.getElementById('avatar-dropdown');
  if (dd) dd.classList.toggle('open');
}
function closeAvatarMenu() {
  const dd = document.getElementById('avatar-dropdown');
  if (dd) dd.classList.remove('open');
}
// Cerrar al click fuera
document.addEventListener('click', (e) => {
  const wrap = document.getElementById('avatar-wrap');
  const dd = document.getElementById('avatar-dropdown');
  if (dd && wrap && !wrap.contains(e.target) && !dd.contains(e.target)) {
    dd.classList.remove('open');
  }
});

function abrirSoporte() {
  const email = 'adrianbada0309@gmail.com';
  const subject = encodeURIComponent('Soporte AI Business OS');
  const body = encodeURIComponent('Hola, necesito ayuda con:\n\n');
  window.open('mailto:' + email + '?subject=' + subject + '&body=' + body);
}

// ── Plan del usuario (tabla: user_plans) ──────────────────────────────────────
// Estructura esperada en Supabase:
//   user_plans: user_id (uuid), plan (text default 'free'), updated_at (timestamp)
async function cargarPlanUsuario() {
  if (!currentUser) { currentPlan = 'free'; return; }
  try {
    const r = await _sb.from('user_plans').select('plan').eq('user_id', currentUser.id).single();
    currentPlan = (r.data?.plan && PLANES[r.data.plan]) ? r.data.plan : 'free';
  } catch { currentPlan = 'free'; }
}

// ── Usage — diario + mensual ──────────────────────────────────────────────────
async function getUsageCounts() {
  if (!currentUser) return { daily: 0, monthly: 0 };
  const today = new Date().toISOString().split('T')[0];
  const firstOfMonth = today.slice(0, 7) + '-01';
  try {
    // Diario
    const dRes = await _sb.from('usage').select('count').eq('user_id', currentUser.id).eq('date', today).single();
    const daily = dRes.data?.count || 0;
    // Mensual (suma de todos los registros del mes actual)
    const mRes = await _sb.from('usage').select('count').eq('user_id', currentUser.id).gte('date', firstOfMonth);
    const monthly = (mRes.data || []).reduce((acc, r) => acc + (r.count || 0), 0);
    return { daily, monthly };
  } catch { return { daily: 0, monthly: 0 }; }
}

async function incrementUsage() {
  if (!currentUser) return;
  const today = new Date().toISOString().split('T')[0];
  try {
    const r = await _sb.from('usage').select('count').eq('user_id', currentUser.id).eq('date', today).single();
    if (r.data) {
      await _sb.from('usage').update({ count: r.data.count + 1 }).eq('user_id', currentUser.id).eq('date', today);
    } else {
      await _sb.from('usage').insert({ user_id: currentUser.id, date: today, count: 1 });
    }
    await updateUsageDisplay();
  } catch(e) { console.error('incrementUsage error', e); }
}

async function checkUsageLimit() {
  // Si el usuario está logueado pero el plan sigue en 'free', puede ser race condition — recargar
  if (currentUser && currentPlan === 'free') {
    try {
      await Promise.race([cargarPlanUsuario(), new Promise(res => setTimeout(res, 5000))]);
    } catch(e) { console.warn('[checkUsageLimit] cargarPlanUsuario falló:', e); }
  }

  const plan = getPlanConfig();
  console.log('[checkUsageLimit] Plan activo:', currentPlan, '| diario:', plan.diario, '| mensual:', plan.mensual);

  const { daily, monthly } = await getUsageCounts();

  if (daily >= plan.diario) {
    const now = new Date(), md = new Date(now); md.setHours(24,0,0,0);
    const h = Math.ceil((md - now) / 3600000);
    mostrarModalLimite('diario', daily, plan, h);
    return false;
  }

  // null = ilimitado (plan premium)
  if (plan.mensual !== null && monthly >= plan.mensual) {
    mostrarModalLimite('mensual', monthly, plan, null);
    return false;
  }

  return true;
}

function mostrarModalLimite(tipo, usado, plan, horasReset) {
  document.getElementById('limit-modal')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'limit-modal';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(2,4,8,0.95);display:flex;align-items:center;justify-content:center;padding:20px;font-family:Inter,sans-serif;backdrop-filter:blur(12px);';

  const esDiario = tipo === 'diario';
  const nextPlan = plan === PLANES.free ? PLANES.estandar : plan === PLANES.estandar ? PLANES.pro : PLANES.premium;
  const planActualNombre = Object.entries(PLANES).find(([,v]) => v === plan)?.[0] || 'free';
  const nextPlanNombre = Object.entries(PLANES).find(([,v]) => v === nextPlan)?.[0] || 'pro';

  const planesHTML = Object.entries(PLANES).filter(([k]) => k !== 'free').map(([k, p]) => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-radius:10px;
      background:${k === nextPlanNombre ? 'rgba(56,189,248,0.1)' : 'rgba(255,255,255,0.03)'};
      border:1px solid ${k === nextPlanNombre ? 'rgba(56,189,248,0.35)' : 'rgba(255,255,255,0.07)'};
      margin-bottom:8px;">
      <div>
        <span style="font-size:13px;font-weight:700;color:#f1f5f9">${p.nombre}</span>
        ${k === nextPlanNombre ? '<span style="font-size:10px;background:rgba(56,189,248,0.2);color:#38bdf8;padding:2px 8px;border-radius:99px;margin-left:8px;font-weight:600;">RECOMENDADO</span>' : ''}
        <div style="font-size:11px;color:#64748b;margin-top:2px">${p.diario} usos/día · ${p.mensual ? p.mensual+'/mes' : 'ilimitado/mes'}</div>
      </div>
      <span style="font-size:15px;font-weight:800;color:#f1f5f9">$${p.precio}<span style="font-size:11px;font-weight:400;color:#64748b">/mes</span></span>
    </div>`).join('');

  const closeId = 'lm-close-' + Date.now();
  overlay.innerHTML = `
    <div style="background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:24px;padding:36px;max-width:420px;width:100%;text-align:center;">
      <div style="font-size:40px;margin-bottom:12px">${esDiario ? '⏳' : '📅'}</div>
      <div style="font-size:18px;font-weight:800;color:#f1f5f9;margin-bottom:8px">
        ${esDiario ? 'Límite diario alcanzado' : 'Límite mensual alcanzado'}
      </div>
      <div style="font-size:13px;color:#64748b;margin-bottom:24px">
        ${esDiario
          ? `Usaste tus <strong style="color:#f1f5f9">${plan.diario} generaciones</strong> de hoy. Se resetean en <strong style="color:#f1f5f9">~${horasReset}h</strong>.`
          : `Usaste tus <strong style="color:#f1f5f9">${plan.mensual} generaciones</strong> del mes. Se resetean el 1 del próximo mes.`
        }
      </div>
      <div style="text-align:left;margin-bottom:20px">
        <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">Upgrades disponibles</div>
        ${planesHTML}
      </div>
      <div style="font-size:12px;color:#475569;margin-bottom:16px">
        Contactá por <strong style="color:#38bdf8">WhatsApp / Instagram</strong> para activar tu plan
      </div>
      <button id="${closeId}" style="background:transparent;border:1px solid rgba(255,255,255,0.12);border-radius:10px;color:#94a3b8;font-size:13px;padding:10px 22px;cursor:pointer;font-family:inherit;transition:all .2s;"
        onmouseover="this.style.borderColor='rgba(255,255,255,0.25)';this.style.color='#f1f5f9'"
        onmouseout="this.style.borderColor='rgba(255,255,255,0.12)';this.style.color='#94a3b8'">
        Cerrar
      </button>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById(closeId).onclick = () => overlay.remove();
}

// ── Display de uso en topbar ──────────────────────────────────────────────────
async function updateUsageDisplay() {
  const plan = getPlanConfig();
  const { daily, monthly } = await getUsageCounts();
  const remDaily = Math.max(0, plan.diario - daily);
  const remMonthly = plan.mensual !== null ? Math.max(0, plan.mensual - monthly) : null;

  const numEl   = document.getElementById('usage-num');
  const barEl   = document.getElementById('usage-bar');
  const resetEl = document.getElementById('usage-reset-time');
  const limEl   = document.getElementById('usage-limit');
  if (!numEl) return;

  // Número restante y límite correcto según plan
  numEl.textContent = remDaily;
  numEl.style.color = getLimiteColor(remDaily, plan.diario);
  if (limEl) limEl.textContent = plan.diario;

  // Barra de progreso
  barEl.style.width = ((remDaily / plan.diario) * 100) + '%';
  barEl.style.background = getLimiteColor(remDaily, plan.diario);

  // Texto de reset
  const now = new Date(), md = new Date(now); md.setHours(24,0,0,0);
  const horasReset = Math.ceil((md - now) / 3600000);
  resetEl.textContent = remMonthly !== null
    ? `${remMonthly} este mes · ~${horasReset}h`
    : `Ilimitado/mes · ~${horasReset}h`;
}

// ── Init auth ─────────────────────────────────────────────────────────────────
_sb.auth.getSession().then(async function(r) {
  if (!r.data || !r.data.session) {
    // Esperar un tick extra por si la sesión tarda en hidratarse
    setTimeout(async function() {
      const check = await _sb.auth.getSession();
      if (!check.data || !check.data.session) {
        window.location.href = 'index.html';
      }
    }, 800);
    return;
  }
  if (r.data && r.data.session) {
    currentUser = r.data.session.user;
    await Promise.race([cargarPlanUsuario(), new Promise(res => setTimeout(res, 3000))]);
    showApp();
  }
});
_sb.auth.onAuthStateChange(async function(ev, session) {
  if (session && !currentUser) {
    currentUser = session.user;
    await Promise.race([cargarPlanUsuario(), new Promise(res => setTimeout(res, 3000))]);
    showApp();
  }
});


// ── Trend Hunter Cards ─────────────────────────────────────────────────────────
function renderTrendCards(container, text) {
  let items = [];

  const clean = text.replace(/```(?:json)?\s*/gi,'').replace(/```\s*/g,'').trim();

  // Estrategia 1: array completo
  try {
    const f = clean.indexOf('['), l = clean.lastIndexOf(']');
    if (f !== -1 && l > f) items = JSON.parse(clean.slice(f, l + 1));
  } catch(e) {}

  // Estrategia 2: array truncado — cerrar objetos abiertos
  if (!items.length) {
    try {
      let partial = clean.indexOf('[') !== -1 ? clean.slice(clean.indexOf('[')) : clean;
      let open = 0;
      for (const ch of partial) { if (ch==='{') open++; else if (ch==='}') open--; }
      if (open > 0) partial += '}'.repeat(open);
      if (!partial.trimEnd().endsWith(']')) partial += ']';
      const parsed = JSON.parse(partial);
      if (Array.isArray(parsed)) items = parsed;
    } catch(e) {}
  }

  // Estrategia 3: objetos individuales con regex
  if (!items.length) {
    const objRe = /\{(?:[^{}]|\{[^{}]*\})*\}/g;
    let m;
    while ((m = objRe.exec(clean)) !== null) {
      if (!m[0].includes('"titulo"')) continue;
      try { items.push(JSON.parse(m[0])); } catch(e) {}
    }
  }

  // Fallback markdown
  if (!items.length) {
    const sections = text.split(/^##\s+/m).filter(s => s.trim());
    items = sections.map(s => {
      const lines = s.trim().split('\n');
      return { titulo: lines[0].replace(/^[#\d\.\-\s]+/,'').trim(), resumen: lines.slice(1).join('\n').trim().substring(0,200), tag: 'Tendencia' };
    });
  }

  if (!items.length) { renderOutput(container, text); return; }

  const grid = document.createElement('div');
  grid.className = 'trend-cards-grid';

  items.forEach((item, i) => {
    const card = document.createElement('div');
    card.className = 'trend-card';
    card.style.animationDelay = (i * 60) + 'ms';

    const titulo = item.titulo || item.nombre || item.title || 'Tendencia ' + (i+1);
    const resumen = item.resumen || item.descripcion || item.summary || item.descripción || '';
    const tag = item.tag || item.categoria || item.saturacion || 'Tendencia';
    const extra = item.ingresos || item.ingresosUSD || item.potencial || '';

    const tagLow = tag.toLowerCase();
    let badgeBg, badgeColor, badgeBorder;
    if (tagLow.includes('baja') || tagLow.includes('low')) {
      badgeBg='rgba(52,211,153,0.1)'; badgeColor='#34d399'; badgeBorder='rgba(52,211,153,0.25)';
    } else if (tagLow.includes('alta') || tagLow.includes('high')) {
      badgeBg='rgba(248,113,113,0.1)'; badgeColor='#f87171'; badgeBorder='rgba(248,113,113,0.25)';
    } else if (tagLow.includes('media') || tagLow.includes('medium')) {
      badgeBg='rgba(251,191,36,0.1)'; badgeColor='#fbbf24'; badgeBorder='rgba(251,191,36,0.25)';
    } else {
      badgeBg='rgba(56,189,248,0.1)'; badgeColor='#38bdf8'; badgeBorder='rgba(56,189,248,0.2)';
    }

    card.innerHTML =
      '<div class="trend-card-header">' +
        '<div class="trend-card-num">'+(i+1)+'</div>' +
        '<span class="trend-card-badge" style="background:'+badgeBg+';color:'+badgeColor+';border-color:'+badgeBorder+'">'+tag+'</span>' +
      '</div>' +
      '<div class="trend-card-title">'+titulo+'</div>' +
      '<div class="trend-card-summary">'+resumen+'</div>' +
      (extra?'<div style="font-size:12px;color:var(--accent3);font-weight:600;margin-top:6px;padding:7px 10px;background:rgba(52,211,153,0.06);border-radius:8px;border:1px solid rgba(52,211,153,0.15)">💰 '+extra+'</div>':'') +
      '<div class="trend-card-footer">' +
        '<span class="trend-card-meta">#'+(i+1)+' de '+items.length+'</span>' +
        '<span class="trend-card-cta">Ver detalle →</span>' +
      '</div>';

    card.addEventListener('click', () => {
      const existing = document.getElementById('trend-detail-modal');
      if (existing) existing.remove();
      const modal = document.createElement('div');
      modal.id = 'trend-detail-modal';
      modal.style.cssText = 'position:fixed;inset:0;z-index:9997;background:rgba(2,4,8,0.92);display:flex;align-items:center;justify-content:center;padding:20px;font-family:Inter,sans-serif;backdrop-filter:blur(10px);';
      const box = document.createElement('div');
      box.style.cssText = 'background:#0a1628;border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:32px;max-width:600px;width:100%;max-height:80vh;overflow-y:auto;';
      const closeId = 'td-close-' + Date.now();
      box.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">' +
          '<span style="background:'+badgeBg+';border:1px solid '+badgeBorder+';border-radius:8px;padding:4px 12px;font-size:12px;font-weight:600;color:'+badgeColor+'">'+tag+'</span>' +
          '<button id="'+closeId+'" style="background:transparent;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#94a3b8;font-size:12px;padding:6px 12px;cursor:pointer;font-family:inherit;">✕ Cerrar</button>' +
        '</div>' +
        '<h2 style="font-size:20px;font-weight:800;color:#f1f5f9;margin-bottom:16px;line-height:1.3">'+titulo+'</h2>' +
        '<div style="font-size:14px;color:#94a3b8;line-height:1.85;white-space:pre-wrap">'+(item.resumen||item.descripcion||item.descripción||resumen)+'</div>' +
        (extra?'<div style="margin-top:16px;padding:12px;background:rgba(52,211,153,0.08);border:1px solid rgba(52,211,153,0.2);border-radius:12px;font-size:14px;color:#34d399;font-weight:600">💰 '+extra+'</div>':'');
      modal.appendChild(box);
      document.body.appendChild(modal);
      document.getElementById(closeId).onclick = () => modal.remove();
      modal.onclick = (e) => { if(e.target===modal) modal.remove(); };
    });

    grid.appendChild(card);
  });

  container.innerHTML = '';
  container.appendChild(grid);
}


const GUIDED_STEPS = [
  { id: 0, label: 'Nicho',    requires: 'selectedNiche'    },
  { id: 1, label: 'Avatar',   requires: 'selectedAvatar'   },
  { id: 2, label: 'Producto', requires: 'productType'      },
  { id: 3, label: 'Tráfico',  requires: 'selectedStrategy' },
  { id: 4, label: 'Diamante', requires: null               },
];

// ── Abrir / Cerrar modo guiado ────────────────────────────────────────────────
function openGuidedMode() {
  document.getElementById('guided-overlay').classList.add('open');
  document.getElementById('guided-footer').classList.add('visible');
  document.body.style.overflow = 'hidden';

  // Si es la primera vez, cargar el paso 0
  const output = document.getElementById('guided-nichos-output');
  const hasCards = output && output.querySelector('.option-cards-grid');
  if (!hasCards) {
    guidedLoadNichos();
  }

  updateGuidedUI();
}

function closeGuidedMode() {
  document.getElementById('guided-overlay').classList.remove('open');
  document.getElementById('guided-footer').classList.remove('visible');
  document.body.style.overflow = '';
  // Sincronizar al state global si hay datos en el carrito
  syncCartToState();
}

// ── Sincronización con el state existente ────────────────────────────────────
function syncCartToState() {
  const c = appState.businessCart;
  if (c.selectedNiche)  {
    appState.nicho = c.selectedNiche.titulo;
    // Pre-rellenar el selector de Trend Hunter (modo libre)
    const typeEl = document.getElementById('trend-type-nichos');
    if (typeEl) typeEl.value = c.selectedNiche.categoria || typeEl.value;
  }
  if (c.selectedAvatar) appState.audiencia = c.selectedAvatar.nombre || '';
  if (c.selectedName)   appState.nombreProducto = c.selectedName;
}

// ── Navegación entre pasos ───────────────────────────────────────────────────
function guidedNext() {
  const step = appState.currentStep;
  const stepDef = GUIDED_STEPS[step];

  if (stepDef.requires && !appState.businessCart[stepDef.requires]) return;

  if (step < GUIDED_STEPS.length - 1) {
    appState.currentStep++;
    showGuidedStep(appState.currentStep);
    updateGuidedUI();
    document.querySelector('.guided-body').scrollTo({ top: 0, behavior: 'smooth' });

    // Auto-cargar el paso al que entramos
    const nextStep = appState.currentStep;
    if (nextStep === 1) guidedLoadAvatars();
    if (nextStep === 2) guidedLoadProductos();
    if (nextStep === 3) guidedLoadEstrategias();
    if (nextStep === 4) guidedRenderDiamante();
  }
}

function guidedBack() {
  if (appState.currentStep > 0) {
    appState.currentStep--;
    showGuidedStep(appState.currentStep);
    updateGuidedUI();
    document.querySelector('.guided-body').scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function showGuidedStep(stepIndex) {
  document.querySelectorAll('.guided-step-panel').forEach((p, i) => {
    p.style.display = i === stepIndex ? 'block' : 'none';
  });
}

// ── Actualizar UI del progress y botones ─────────────────────────────────────
function updateGuidedUI() {
  const step = appState.currentStep;
  const cart = appState.businessCart;

  // Progress pills
  GUIDED_STEPS.forEach((s, i) => {
    const pill = document.getElementById('gpill-' + i);
    const num  = document.getElementById('gpill-num-' + i);
    const conn = document.getElementById('gconn-' + i);
    if (!pill) return;

    const isDone   = i < step;
    const isActive = i === step;

    pill.className = 'guided-step-pill' + (isActive ? ' active' : '') + (isDone ? ' done' : '');
    if (num) num.textContent = isDone ? '✓' : (i + 1);
    if (conn) conn.className = 'guided-step-connector' + (isDone ? ' done' : '');
  });

  // Botón back
  const backBtn = document.getElementById('btn-guided-back');
  if (backBtn) backBtn.style.display = step > 0 ? 'inline-flex' : 'none';

  // Botón next
  const nextBtn = document.getElementById('btn-guided-next');
  const nextLabel = document.getElementById('guided-next-label');
  const stepDef = GUIDED_STEPS[step];
  const hasSelection = !stepDef.requires || !!cart[stepDef.requires];

  if (nextBtn) {
    nextBtn.disabled = !hasSelection;
    if (step === GUIDED_STEPS.length - 1) {
      nextBtn.textContent = '✓ Finalizar y continuar al modo completo';
      nextBtn.onclick = () => { syncCartToState(); closeGuidedMode(); goStep(1); };
    } else {
      nextBtn.innerHTML = 'Siguiente <span id="guided-next-label">→</span>';
      nextBtn.onclick = guidedNext;
    }
  }

  // Cart summary
  updateCartDisplay();
}

function updateCartDisplay() {
  const cart = appState.businessCart;
  const display = document.getElementById('guided-cart-display');
  if (!display) return;

  const chips = [];
  if (cart.selectedNiche)    chips.push('🎯 ' + cart.selectedNiche.titulo);
  if (cart.selectedAvatar)   chips.push('👤 ' + cart.selectedAvatar.nombre);
  if (cart.selectedName)     chips.push('📦 ' + cart.selectedName);
  if (cart.selectedStrategy) chips.push('📈 ' + cart.selectedStrategy);

  if (chips.length === 0) {
    display.innerHTML = '<span style="font-size:12px;color:var(--muted)">Sin selecciones aún</span>';
  } else {
    display.innerHTML = chips
      .map(c => `<span class="guided-cart-chip">${c}</span>`)
      .join('');
  }
}

// ── PASO 1: Cargar y renderizar nichos ───────────────────────────────────────
async function guidedLoadNichos() {
  const output = document.getElementById('guided-nichos-output');
  const tipo   = document.getElementById('g-categoria')?.value || 'Salud y bienestar';
  const pais   = document.getElementById('g-mercado')?.value   || 'Latinoamérica';

  appState.businessCart.selectedNiche = null;
  updateGuidedUI();

  output.innerHTML = `
    <div class="guided-loader">
      <div class="guided-loader-dots">
        <div class="guided-loader-dot"></div>
        <div class="guided-loader-dot"></div>
        <div class="guided-loader-dot"></div>
      </div>
      <div>Analizando el mercado de <strong>${tipo}</strong> en <strong>${pais}</strong>...</div>
    </div>`;

  // Verificar límite — versión ligera que no puede crashear el flujo
  try {
    if (currentUser && currentPlan === 'free') {
      await Promise.race([cargarPlanUsuario(), new Promise(res => setTimeout(res, 3000))]);
    }
    const plan = getPlanConfig();
    if (plan.mensual !== null) {
      const counts = await Promise.race([
        getUsageCounts(),
        new Promise(res => setTimeout(() => res({ daily: 0, monthly: 0 }), 3000))
      ]);
      if (counts.monthly >= plan.mensual) {
        output.innerHTML = '<div class="guided-error">⚠️ Límite mensual alcanzado. Actualizá tu plan para continuar.</div>';
        return;
      }
    }
  } catch(e) { console.warn('[Guided] límite check omitido:', e); }

  // Prompt ultra-compacto — campos cortos para que quepan los 5 nichos dentro del límite de tokens
  const sys = `Responde ÚNICAMENTE con un array JSON. Sin texto antes ni después. Sin markdown. Sin bloques de código. Solo el array.`;

  const prompt = `Crea 5 nichos de infoproductos para "${tipo}" en ${pais}. Responde SOLO con este JSON (sin texto adicional):
[{"titulo":"TITULO","resumen":"RESUMEN 10 PALABRAS","tag":"Baja","ingresos":"$X,000-$X,000/mes","tendencia":"↑ Creciendo"},{"titulo":"TITULO","resumen":"RESUMEN 10 PALABRAS","tag":"Media","ingresos":"$X,000-$X,000/mes","tendencia":"→ Estable"},{"titulo":"TITULO","resumen":"RESUMEN 10 PALABRAS","tag":"Baja","ingresos":"$X,000-$X,000/mes","tendencia":"↑ Creciendo"},{"titulo":"TITULO","resumen":"RESUMEN 10 PALABRAS","tag":"Alta","ingresos":"$X,000-$X,000/mes","tendencia":"→ Estable"},{"titulo":"TITULO","resumen":"RESUMEN 10 PALABRAS","tag":"Baja","ingresos":"$X,000-$X,000/mes","tendencia":"↑ Creciendo"}]
Reemplaza TITULO con el nombre real (max 4 palabras) y RESUMEN con descripción real (max 10 palabras). tag debe ser "Baja", "Media" o "Alta". Responde solo con el array.`;

  try {
    let text = await callClaudeRaw(sys, prompt, output, 'Generando nichos con IA...');
    if (!text) return;

    text = text.trim();
    console.log('[Guided] Raw:', text.substring(0, 500));

    // Limpiar markdown fences
    text = text.replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/```\s*$/,'').trim();

    let nichos = null;

    // Estrategia 1: array completo [...]
    const first = text.indexOf('[');
    const last  = text.lastIndexOf(']');
    if (first !== -1 && last > first) {
      try { nichos = JSON.parse(text.slice(first, last + 1)); } catch(e) { console.warn('[Guided] Parse completo falló:', e.message); }
    }

    // Estrategia 2: array truncado — cerrar el último objeto abierto y el array
    if (!nichos || !nichos.length) {
      try {
        let partial = first !== -1 ? text.slice(first) : text;
        // Contar llaves abiertas para saber si falta cerrar
        let open = 0;
        for (const ch of partial) { if (ch==='{') open++; else if (ch==='}') open--; }
        if (open > 0) partial += '}'.repeat(open);
        if (!partial.trimEnd().endsWith(']')) partial += ']';
        nichos = JSON.parse(partial);
      } catch(e) { console.warn('[Guided] Parse parcial falló:', e.message); }
    }

    // Estrategia 3: extraer objetos individuales con regex
    if (!nichos || !nichos.length) {
      const objs = [];
      const objRe = /\{(?:[^{}]|\{[^{}]*\})*\}/g;
      let m;
      while ((m = objRe.exec(text)) !== null) {
        if (!m[0].includes('"titulo"')) continue;
        try { objs.push(JSON.parse(m[0])); } catch(e) {}
      }
      if (objs.length) nichos = objs;
    }

    if (!nichos || !nichos.length) {
      console.error('[Guided] Todas las estrategias fallaron. Texto:', text);
      throw new Error('La IA no devolvió formato JSON válido');
    }

    console.log('[Guided] Nichos parseados:', nichos.length);
    renderNichoCards(nichos, output, tipo);
    try { await incrementUsage(); } catch(e) { console.warn('[Guided] incrementUsage:', e); }

  } catch (err) {
    console.error('[Guided] Error final:', err);
    const msg = err.name === 'AbortError'
      ? 'La solicitud tardó demasiado. Intentá de nuevo.'
      : err.message === 'Failed to fetch'
        ? 'Sin conexión. Revisá tu internet.'
        : 'Error: ' + err.message;
    output.innerHTML = `
      <div class="guided-error">⚠️ ${msg}</div>
      <button class="btn btn-ghost" style="margin-top:8px" onclick="guidedLoadNichos()">🔄 Reintentar</button>`;
  }
}


// ── PASO 2: Cargar y renderizar avatares ─────────────────────────────────────
async function guidedLoadAvatars() {
  const output = document.getElementById('guided-avatares-output');
  const cart   = appState.businessCart;
  appState.businessCart.selectedAvatar = null;
  updateGuidedUI();

  output.innerHTML = `<div class="guided-loader"><div class="guided-loader-dots"><div class="guided-loader-dot"></div><div class="guided-loader-dot"></div><div class="guided-loader-dot"></div></div><div>Generando perfiles para <strong>${cart.selectedNiche?.titulo || 'tu nicho'}</strong>...</div></div>`;

  const sys = `Responde ÚNICAMENTE con un array JSON. Sin texto antes ni después. Sin markdown.`;
  const prompt = `Crea 4 avatares de cliente ideal para el nicho "${cart.selectedNiche?.titulo || 'infoproductos'}" en Latinoamérica. Responde SOLO con este JSON:
[{"nombre":"NOMBRE AVATAR","edad":"RANGO EDAD","ocupacion":"OCUPACION","dolor":"DOLOR PRINCIPAL EN 8 PALABRAS","deseo":"DESEO PRINCIPAL EN 8 PALABRAS","gatillo":"QUE LO HARIA COMPRAR HOY"},{"nombre":"NOMBRE AVATAR","edad":"RANGO EDAD","ocupacion":"OCUPACION","dolor":"DOLOR PRINCIPAL EN 8 PALABRAS","deseo":"DESEO PRINCIPAL EN 8 PALABRAS","gatillo":"QUE LO HARIA COMPRAR HOY"},{"nombre":"NOMBRE AVATAR","edad":"RANGO EDAD","ocupacion":"OCUPACION","dolor":"DOLOR PRINCIPAL EN 8 PALABRAS","deseo":"DESEO PRINCIPAL EN 8 PALABRAS","gatillo":"QUE LO HARIA COMPRAR HOY"},{"nombre":"NOMBRE AVATAR","edad":"RANGO EDAD","ocupacion":"OCUPACION","dolor":"DOLOR PRINCIPAL EN 8 PALABRAS","deseo":"DESEO PRINCIPAL EN 8 PALABRAS","gatillo":"QUE LO HARIA COMPRAR HOY"}]
Reemplaza con datos reales específicos para el nicho. Solo el array JSON.`;

  try {
    const text = await callClaudeRaw(sys, prompt, output, 'Generando perfiles para ' + (cart.selectedNiche?.titulo || 'tu nicho') + '...');
    if (!text) return;

    const cleaned = text.trim().replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/```\s*$/,'').trim();
    const f = cleaned.indexOf('['), l = cleaned.lastIndexOf(']');
    let avatares = null;
    if (f !== -1 && l > f) { try { avatares = JSON.parse(cleaned.slice(f, l+1)); } catch(e) { console.warn('[Guided] Parse avatares falló:', e.message); } }
    if (!avatares?.length) throw new Error('JSON inválido');

    // Render cards
    output.innerHTML = `<div class="option-cards-grid">` +
      avatares.map((av, i) => `
        <div class="option-card" id="av-card-${i}" onclick="selectAvatar(${i})">
          <div class="option-card-check" id="av-check-${i}"></div>
          <div class="option-card-avatar">${av.nombre.charAt(0).toUpperCase()}</div>
          <div class="option-card-title">${av.nombre}</div>
          <div class="option-card-tag">${av.edad} · ${av.ocupacion}</div>
          <div class="option-card-pain">😤 ${av.dolor}</div>
          <div class="option-card-desire">✨ ${av.deseo}</div>
          <div class="option-card-trigger">⚡ ${av.gatillo}</div>
        </div>`).join('') + `</div>`;

    // Guardar avatares en memoria para selectAvatar
    window._guidedAvatares = avatares;
    await incrementUsage();
  } catch(err) {
    output.innerHTML = `<div class="guided-error">⚠️ ${err.message} <button class="btn btn-ghost" style="margin-left:8px;font-size:12px" onclick="guidedLoadAvatars()">Reintentar</button></div>`;
  }
}

function selectAvatar(idx) {
  const av = window._guidedAvatares?.[idx];
  if (!av) return;
  appState.businessCart.selectedAvatar = av;
  document.querySelectorAll('#guided-avatares-output .option-card').forEach((c, i) => {
    c.classList.toggle('selected', i === idx);
    const check = c.querySelector('.option-card-check');
    if (check) check.textContent = i === idx ? '✓' : '';
  });
  updateGuidedUI();
}

// ── PASO 3: Cargar y renderizar productos ─────────────────────────────────────
async function guidedLoadProductos() {
  const output = document.getElementById('guided-producto-output');
  const cart   = appState.businessCart;
  appState.businessCart.productType  = null;
  appState.businessCart.selectedName = null;
  updateGuidedUI();

  const nicho  = cart.selectedNiche?.titulo  || 'infoproductos';
  const avatar = cart.selectedAvatar?.nombre || 'cliente ideal';
  const dolor  = cart.selectedAvatar?.dolor  || 'su problema principal';

  output.innerHTML = `<div class="guided-loader"><div class="guided-loader-dots"><div class="guided-loader-dot"></div><div class="guided-loader-dot"></div><div class="guided-loader-dot"></div></div><div>Diseñando productos para <strong>${avatar}</strong>...</div></div>`;

  const sys = `Responde ÚNICAMENTE con un array JSON. Sin texto antes ni después. Sin markdown.`;
  const prompt = `Crea 4 ideas de infoproductos para el nicho "${nicho}", avatar "${avatar}" con dolor "${dolor}". Responde SOLO con este JSON:
[{"nombre":"NOMBRE PRODUCTO","tipo":"Ebook","precio":"$17","promesa":"PROMESA EN 8 PALABRAS","diferenciador":"QUE LO HACE UNICO EN 6 PALABRAS"},{"nombre":"NOMBRE PRODUCTO","tipo":"Mini-curso","precio":"$47","promesa":"PROMESA EN 8 PALABRAS","diferenciador":"QUE LO HACE UNICO EN 6 PALABRAS"},{"nombre":"NOMBRE PRODUCTO","tipo":"Guia PDF","precio":"$27","promesa":"PROMESA EN 8 PALABRAS","diferenciador":"QUE LO HACE UNICO EN 6 PALABRAS"},{"nombre":"NOMBRE PRODUCTO","tipo":"Template","precio":"$37","promesa":"PROMESA EN 8 PALABRAS","diferenciador":"QUE LO HACE UNICO EN 6 PALABRAS"}]
Reemplaza con nombres y datos reales. Solo el array JSON.`;

  try {
    const text = await callClaudeRaw(sys, prompt, output, 'Diseñando productos con IA...');
    if (!text) return;

    const cleaned = text.trim().replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/```\s*$/,'').trim();
    const f = cleaned.indexOf('['), l = cleaned.lastIndexOf(']');
    let productos = null;
    if (f !== -1 && l > f) { try { productos = JSON.parse(cleaned.slice(f, l+1)); } catch(e) { console.warn('[Guided] Parse productos falló:', e.message); } }
    if (!productos?.length) throw new Error('JSON inválido');

    window._guidedProductos = productos;

    const tipoIcon = { 'Ebook': '📖', 'Mini-curso': '🎓', 'Guia PDF': '📋', 'Template': '⚡', 'Membresía': '👑' };
    output.innerHTML = `<div class="option-cards-grid">` +
      productos.map((p, i) => `
        <div class="option-card" id="prod-card-${i}" onclick="selectProducto(${i})">
          <div class="option-card-check" id="prod-check-${i}"></div>
          <div class="option-card-tipo-icon">${tipoIcon[p.tipo] || '📦'}</div>
          <div class="option-card-tipo-tag">${p.tipo}</div>
          <div class="option-card-title">${p.nombre}</div>
          <div class="option-card-price">${p.precio}</div>
          <div class="option-card-pain">🎯 ${p.promesa}</div>
          <div class="option-card-trigger">💎 ${p.diferenciador}</div>
        </div>`).join('') + `</div>`;

    await incrementUsage();
  } catch(err) {
    output.innerHTML = `<div class="guided-error">⚠️ ${err.message} <button class="btn btn-ghost" style="margin-left:8px;font-size:12px" onclick="guidedLoadProductos()">Reintentar</button></div>`;
  }
}

function selectProducto(idx) {
  const p = window._guidedProductos?.[idx];
  if (!p) return;
  appState.businessCart.productType      = p.tipo;
  appState.businessCart.selectedName     = p.nombre;
  appState.businessCart.selectedPrice    = p.precio;
  appState.businessCart.selectedPromesa  = p.promesa;
  appState.nombreProducto = p.nombre;
  appState.precio         = p.precio;
  document.querySelectorAll('#guided-producto-output .option-card').forEach((c, i) => {
    c.classList.toggle('selected', i === idx);
    const check = c.querySelector('.option-card-check');
    if (check) check.textContent = i === idx ? '✓' : '';
  });
  updateGuidedUI();
}

// ── PASO 4: Cargar y renderizar estrategias ───────────────────────────────────
async function guidedLoadEstrategias() {
  const output = document.getElementById('guided-estrategia-output');
  const cart   = appState.businessCart;
  appState.businessCart.selectedStrategy = null;
  updateGuidedUI();

  output.innerHTML = `<div class="guided-loader"><div class="guided-loader-dots"><div class="guided-loader-dot"></div><div class="guided-loader-dot"></div><div class="guided-loader-dot"></div></div><div>Analizando estrategias de venta...</div></div>`;

  const sys = `Responde ÚNICAMENTE con un array JSON. Sin texto antes ni después. Sin markdown.`;
  const prompt = `Crea 3 estrategias de venta para "${cart.selectedName || 'infoproducto'}" (${cart.selectedPrice || '$27'}) en el nicho "${cart.selectedNiche?.titulo || 'digital'}". Responde SOLO con este JSON:
[{"canal":"CANAL PRINCIPAL","estrategia":"NOMBRE ESTRATEGIA EN 4 PALABRAS","descripcion":"DESCRIPCION EN 10 PALABRAS","tiempo":"TIEMPO PARA PRIMERAS VENTAS","dificultad":"Fácil"},{"canal":"CANAL PRINCIPAL","estrategia":"NOMBRE ESTRATEGIA EN 4 PALABRAS","descripcion":"DESCRIPCION EN 10 PALABRAS","tiempo":"TIEMPO PARA PRIMERAS VENTAS","dificultad":"Media"},{"canal":"CANAL PRINCIPAL","estrategia":"NOMBRE ESTRATEGIA EN 4 PALABRAS","descripcion":"DESCRIPCION EN 10 PALABRAS","tiempo":"TIEMPO PARA PRIMERAS VENTAS","dificultad":"Avanzada"}]
Solo el array JSON con datos reales.`;

  try {
    const text = await callClaudeRaw(sys, prompt, output, 'Generando estrategias con IA...');
    if (!text) return;

    const cleaned = text.trim().replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/```\s*$/,'').trim();
    const f = cleaned.indexOf('['), l = cleaned.lastIndexOf(']');
    let estrategias = null;
    if (f !== -1 && l > f) { try { estrategias = JSON.parse(cleaned.slice(f, l+1)); } catch(e) { console.warn('[Guided] Parse estrategias falló:', e.message); } }
    if (!estrategias?.length) throw new Error('JSON inválido');

    window._guidedEstrategias = estrategias;
    const difColor = { 'Fácil': 'tag-low', 'Media': 'tag-mid', 'Avanzada': 'tag-high' };
    const canalIcon = { 'TikTok': '🎵', 'Instagram': '📸', 'Facebook': '👥', 'WhatsApp': '💬', 'Email': '📧', 'Pinterest': '📌', 'YouTube': '▶️' };

    output.innerHTML = `<div class="option-cards-grid">` +
      estrategias.map((e, i) => `
        <div class="option-card" id="est-card-${i}" onclick="selectEstrategia(${i})">
          <div class="option-card-check" id="est-check-${i}"></div>
          <div class="option-card-tipo-icon">${canalIcon[e.canal] || '📊'}</div>
          <div class="option-card-title">${e.estrategia}</div>
          <div class="option-card-tipo-tag">${e.canal}</div>
          <div class="option-card-pain">🎯 ${e.descripcion}</div>
          <div class="option-card-trigger">⏱️ ${e.tiempo}</div>
          <div style="margin-top:10px"><span class="option-card-sat-tag ${difColor[e.dificultad] || 'tag-mid'}">${e.dificultad}</span></div>
        </div>`).join('') + `</div>`;

    await incrementUsage();
  } catch(err) {
    output.innerHTML = `<div class="guided-error">⚠️ ${err.message} <button class="btn btn-ghost" style="margin-left:8px;font-size:12px" onclick="guidedLoadEstrategias()">Reintentar</button></div>`;
  }
}

function selectEstrategia(idx) {
  const e = window._guidedEstrategias?.[idx];
  if (!e) return;
  appState.businessCart.selectedStrategy = e.estrategia;
  appState.businessCart.selectedCanal    = e.canal;
  document.querySelectorAll('#guided-estrategia-output .option-card').forEach((c, i) => {
    c.classList.toggle('selected', i === idx);
    const check = c.querySelector('.option-card-check');
    if (check) check.textContent = i === idx ? '✓' : '';
  });
  updateGuidedUI();
}

// ── PASO 5: Diamante + activar Conversion Engine ──────────────────────────────
function guidedRenderDiamante() {
  const cart = appState.businessCart;
  const summary = document.getElementById('guided-diamante-summary');

  // Resumen visual del businessCart
  summary.innerHTML = `
    <div class="diamante-card">
      <div class="diamante-title">💎 Tu negocio está listo para convertirse</div>
      <div class="diamante-grid">
        <div class="diamante-item">
          <div class="diamante-label">🎯 Nicho</div>
          <div class="diamante-value">${cart.selectedNiche?.titulo || '—'}</div>
          <div class="diamante-sub">${cart.selectedNiche?.resumen || ''}</div>
        </div>
        <div class="diamante-item">
          <div class="diamante-label">👤 Avatar</div>
          <div class="diamante-value">${cart.selectedAvatar?.nombre || '—'}</div>
          <div class="diamante-sub">${cart.selectedAvatar?.dolor || ''}</div>
        </div>
        <div class="diamante-item">
          <div class="diamante-label">📦 Producto</div>
          <div class="diamante-value">${cart.selectedName || '—'}</div>
          <div class="diamante-sub">${cart.productType || ''} · ${cart.selectedPrice || ''}</div>
        </div>
        <div class="diamante-item">
          <div class="diamante-label">📈 Estrategia</div>
          <div class="diamante-value">${cart.selectedStrategy || '—'}</div>
          <div class="diamante-sub">${cart.selectedCanal || ''}</div>
        </div>
      </div>
    </div>

    <div class="ce-launcher">
      <div class="ce-launcher-icon">⚡</div>
      <div class="ce-launcher-text">
        <strong>Conversion Engine listo para activarse</strong>
        <span>Va a analizar tu negocio y escribir la estructura de ventas completa: promesa principal, agitación del dolor, mecanismo único, stack de oferta y copy de landing.</span>
      </div>
      <button class="btn btn-primary ce-launcher-btn" onclick="runConversionEngine()">
        🚀 Activar Conversion Engine
      </button>
    </div>`;

  document.getElementById('guided-conversion-output').innerHTML = '';
}

// ── CONVERSION ENGINE — El cerebro del sistema ────────────────────────────────
async function runConversionEngine() {
  const cart   = appState.businessCart;
  const output = document.getElementById('guided-conversion-output');

  // Ocultar el botón de activar
  const launcher = document.querySelector('.ce-launcher-btn');
  if (launcher) launcher.disabled = true;

  // ── Skeleton Loader (efecto premium) ────────────────────────────────────
  output.innerHTML = `
    <div class="skeleton-container">
      <div class="skeleton-header">
        <div class="skeleton-line w-40 h-12"></div>
        <div class="skeleton-line w-60 h-8 mt-6"></div>
      </div>
      <div class="skeleton-section">
        <div class="skeleton-line w-30 h-10"></div>
        <div class="skeleton-line w-full h-7 mt-4"></div>
        <div class="skeleton-line w-full h-7 mt-3"></div>
        <div class="skeleton-line w-70 h-7 mt-3"></div>
      </div>
      <div class="skeleton-section">
        <div class="skeleton-line w-30 h-10"></div>
        <div class="skeleton-line w-full h-7 mt-4"></div>
        <div class="skeleton-line w-80 h-7 mt-3"></div>
      </div>
      <div class="skeleton-section">
        <div class="skeleton-line w-30 h-10"></div>
        <div class="skeleton-grid">
          <div class="skeleton-card"></div>
          <div class="skeleton-card"></div>
          <div class="skeleton-card"></div>
        </div>
      </div>
      <div class="skeleton-status" id="ce-status-msg">⚡ Analizando tu nicho y avatar...</div>
    </div>`;

  // Mensajes dinámicos del skeleton
  const ceMessages = [
    '⚡ Analizando tu nicho y avatar...',
    '🧠 Identificando el mecanismo único de tu oferta...',
    '✍️ Redactando la promesa principal...',
    '🎯 Estructurando el stack de valor...',
    '💎 Construyendo los gatillos mentales...',
    '🚀 Finalizando la arquitectura de conversión...',
  ];
  let ceMsg = 0;
  const ceInterval = setInterval(() => {
    ceMsg = (ceMsg + 1) % ceMessages.length;
    const el = document.getElementById('ce-status-msg');
    if (el) el.textContent = ceMessages[ceMsg];
  }, 2200);

  // ── Recolectar datos del carrito en texto legible para el LLM ─────────
  const selectedNicho = cart.selectedNiche
    ? `${cart.selectedNiche.titulo || 'No especificado'}${cart.selectedNiche.resumen ? ` — ${cart.selectedNiche.resumen}` : ''}`
    : 'No especificado';

  const selectedAvatar = cart.selectedAvatar
    ? `${cart.selectedAvatar.nombre || 'No especificado'}${cart.selectedAvatar.edad ? `, ${cart.selectedAvatar.edad} años` : ''}${cart.selectedAvatar.ocupacion ? `, ${cart.selectedAvatar.ocupacion}` : ''} (Dolor: ${cart.selectedAvatar.dolor || 'No especificado'}, Deseo: ${cart.selectedAvatar.deseo || 'No especificado'}, Gatillo: ${cart.selectedAvatar.gatillo || 'No especificado'})`
    : 'No especificado';

  const selectedProducto = `${cart.selectedName || 'Producto Digital'} (${cart.productType || 'infoproducto'}) — Precio: ${cart.selectedPrice || '$27'}${cart.selectedPromesa ? `\n  - Promesa: ${cart.selectedPromesa}` : ''}`;

  const selectedTrafico = `${cart.selectedStrategy || 'No especificada'}${cart.selectedCanal ? ` vía ${cart.selectedCanal}` : ''}`;

  // ── TAREA 1: System prompt con salida JSON estricta ─────────────────────
  const sys = `Actúa como el motor de redacción experto en conversiones.
Tu única tarea es generar el copy persuasivo para una landing page basándote en la información y contexto proporcionados por el usuario.

REGLAS ESTRICTAS DE SALIDA (CRÍTICO):
1. ESTÁ ABSOLUTAMENTE PROHIBIDO generar saludos, despedidas, introducciones, explicaciones o cualquier texto conversacional.
2. ESTÁ PROHIBIDO usar formato Markdown general (como ---, #, o asteriscos fuera de contexto).
3. Tu respuesta debe ser EXCLUSIVAMENTE un objeto JSON válido, puro y minificado. Si devuelves cualquier otra cosa, el sistema fallará.
4. TODOS los campos deben contener texto real y específico basado en los datos del negocio. NUNCA dejes un campo vacío o con placeholder genérico.

ESTRUCTURA JSON OBLIGATORIA:
Debes rellenar exactamente este esquema. No agregues ni quites llaves.

{
  "hero_title": "String. Un único título principal persuasivo de máximo 10 palabras.",
  "pain_points": [
    "String. Dolor 1 del cliente.",
    "String. Dolor 2 del cliente.",
    "String. Dolor 3 del cliente."
  ],
  "unique_mechanism": "String. Explicación directa y única de la solución en un solo párrafo.",
  "offer": {
    "main_product": "String. Nombre del producto principal.",
    "bonuses": [
      "String. Título del Bono 1",
      "String. Título del Bono 2",
      "String. Título del Bono 3"
    ],
    "price_original": 0,
    "price_discount": 0
  },
  "guarantee": "String. Texto directo de la garantía.",
  "cta_button": "String. Texto del botón de llamado a la acción."
}`;

  const prompt = `[DATOS DEL NEGOCIO SELECCIONADOS POR EL USUARIO]
- Nicho seleccionado: ${selectedNicho}
- Avatar de cliente ideal: ${selectedAvatar}
- Producto/Oferta principal: ${selectedProducto}
- Estrategia de Tráfico: ${selectedTrafico}

[INSTRUCCIÓN DE REDACCIÓN]
Basándote estrictamente en los datos anteriores, redacta el copy persuasivo de conversión para la Landing Page. Debes adaptar el tono del copy al Avatar especificado y enfocar los beneficios hacia el Producto mencionado.

Recuerda devolver la respuesta ÚNICAMENTE en el formato JSON estructurado que definimos anteriormente (hero_title, pain_points, unique_mechanism, offer, guarantee, cta_button). No dejes campos vacíos; extrae y procesa los datos reales provistos.`;

  try {
    let limitOk = true;
    try {
      limitOk = await Promise.race([checkUsageLimit(), new Promise(res => setTimeout(() => res(true), 4000))]);
    } catch(e) { console.warn('[CE] checkUsageLimit omitido:', e); }
    if (!limitOk) {
      clearInterval(ceInterval);
      output.innerHTML = '<div class="guided-error">⚠️ Límite de usos alcanzado. Intentá mañana.</div>';
      return;
    }

    const controller = new AbortController();
    const tmout = setTimeout(() => controller.abort(), 55000);
    const res = await fetch('https://aibusiness.adrianbada0309.workers.dev', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemPrompt: withDateContext(sys), prompt, maxTokens: 8192, temperature: 0.8 }),
      signal: controller.signal
    });
    clearTimeout(tmout);
    clearInterval(ceInterval);

    if (!res.ok) {
      const msg = await parseProxyError(res);
      throw new Error(msg);
    }
    const data = await res.json();
    const text = data.text || '';

    // Guardar en appState para el Landing Generator
    appState.finalCopyRaw = text;
    appState.copyLanding    = text;
    appState.giro           = cart.selectedPromesa || '';
    appState.nicho          = cart.selectedNiche?.titulo || '';
    appState.audiencia      = cart.selectedAvatar?.nombre || '';
    appState.nombreProducto = cart.selectedName || '';
    appState.precio         = cart.selectedPrice || '';

    // Normalizar la respuesta para garantizar que `appState.finalCopy` sea siempre un objeto
    let finalObj = null;
    // 1) Intentar parsear como JSON completo
    try { finalObj = JSON.parse(text); } catch (e) { finalObj = null; }

    // 2) Si falla, intentar extraer primer JSON válido dentro del texto
    if (!finalObj) {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { finalObj = JSON.parse(jsonMatch[0]); } catch (e) { finalObj = null; }
      }
    }

    // 3) Si sigue sin JSON, intentar mapear líneas clave: valor a un objeto
    if (!finalObj) {
      const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      const kv = {};
      lines.forEach(line => {
        const m = line.match(/^\s*[-*]?\s*([^:]+):\s*(.+)$/);
        if (m) {
          const key = m[1].trim().toLowerCase().replace(/\s+/g, '_');
          kv[key] = m[2].trim();
        }
      });

      finalObj = {
        headline: kv.headline || kv.titulo || lines[0] || 'Landing ensamblada',
        subheadline: kv.subheadline || kv.subtitulo || lines[1] || '',
        mechanism: kv.mechanism || kv.mecanismo || lines[2] || '',
        offer_stack: {
          product: kv.product || kv.producto || lines.slice(3,6).join(' ') || (cart.selectedName || ''),
          bonuses: []
        },
        cta: kv.cta || kv.llamada || kv.call_to_action || lines[lines.length - 1] || 'Comprar ahora'
      };
      // Attempt to parse bonuses from kv if present (comma- or ;-separated)
      const bonusesRaw = kv.bonuses || kv.bonos || kv.bonus;
      if (bonusesRaw) {
        finalObj.offer_stack.bonuses = bonusesRaw.split(/[,;]\s*/).map(s => s.trim()).filter(Boolean);
      }
    }

    // 4) Asegurar shape esperado
    if (!finalObj.offer_stack) finalObj.offer_stack = { product: '', bonuses: [] };
    if (!Array.isArray(finalObj.offer_stack.bonuses)) {
      finalObj.offer_stack.bonuses = finalObj.offer_stack.bonuses ? [finalObj.offer_stack.bonuses] : [];
    }

    setFinalCopy(finalObj, text);

    // ── Renderizar preview del copy en el panel del Conversion Engine ────
    const d = finalObj;
    const painHtml = Array.isArray(d.pain_points)
      ? `<ul class="ce-pain-list">${d.pain_points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>`
      : '';
    const bonusHtml = Array.isArray(d.offer?.bonuses)
      ? d.offer.bonuses.map((b, i) => `<li><strong>Bono ${i+1}:</strong> ${esc(b)}</li>`).join('')
      : '';
    const priceOrig = d.offer?.price_original ? `$${d.offer.price_original}` : '';
    const priceDsc  = d.offer?.price_discount  ? `$${d.offer.price_discount}`  : (appState.precio || '');

    output.innerHTML = `
      <div class="ce-result">
        <div class="ce-result-header">
          <div class="ce-result-badge">✅ Conversion Engine completado</div>
          <div class="ce-result-title">Tu arquitectura de ventas está lista</div>
          <div class="ce-result-sub">Copy generado con salida JSON estructurada. Cada campo inyectado directamente en la landing.</div>
        </div>
        <div class="ce-copy-content">
          <h3 class="ce-section-title">⚡ Hero Title</h3>
          <p>${esc(d.hero_title)}</p>
          <h3 class="ce-section-title">😤 Pain Points</h3>
          ${painHtml}
          <h3 class="ce-section-title">💡 Mecanismo Único</h3>
          <p>${esc(d.unique_mechanism)}</p>
          <h3 class="ce-section-title">📦 Oferta</h3>
          <p><strong>${esc(d.offer?.main_product)}</strong></p>
          ${bonusHtml ? `<ul class="ce-bonus-list">${bonusHtml}</ul>` : ''}
          ${priceOrig ? `<p><s style="opacity:.5">${priceOrig}</s> → <strong style="color:var(--accent)">${priceDsc}</strong></p>` : ''}
          <h3 class="ce-section-title">✅ Garantía</h3>
          <p>${esc(d.guarantee)}</p>
          <h3 class="ce-section-title">🧠 CTA</h3>
          <p><strong>${esc(d.cta_button)}</strong></p>
        </div>
        <div class="ce-actions">
          <button class="btn btn-primary" onclick="activateLandingFromEngine()">
            💻 Generar Landing Page con este copy →
          </button>
          <button class="btn btn-ghost" onclick="copyText(this)" style="font-size:12px">
            📋 Copiar copy completo
          </button>
        </div>
      </div>`;

    await incrementUsage();

    // Actualizar el botón final de la navegación
    const nextBtn = document.getElementById('btn-guided-next');
    if (nextBtn) {
      nextBtn.textContent = '💻 Ir a generar Landing Page';
      nextBtn.disabled = false;
      nextBtn.onclick = () => { syncCartToState(); closeGuidedMode(); goStep(2); };
    }

  } catch(err) {
    clearInterval(ceInterval);
    const msg = err.name === 'AbortError' ? 'La solicitud tardó demasiado. Intentá de nuevo.' : err.message;
    output.innerHTML = `<div class="guided-error">⚠️ ${msg}</div><button class="btn btn-ghost" style="margin-top:8px" onclick="runConversionEngine()">🔄 Reintentar</button>`;
    if (launcher) launcher.disabled = false;
  }
}

// ── TAREA 2: Adaptador/Parser — limpia residuos y parsea JSON estricto ────────
function parseLandingCopy(rawText) {
  const FALLBACK = {
    hero_title: '',
    pain_points: [],
    unique_mechanism: '',
    offer: { main_product: '', bonuses: [], price_original: 0, price_discount: 0 },
    guarantee: '',
    cta_button: 'Comprar ahora'
  };

  if (!rawText || typeof rawText !== 'string') return FALLBACK;

  // Limpiar fences de markdown que el LLM pueda haber incluido por error
  let cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/,   '')
    .trim();

  // Extraer el primer bloque JSON completo si hay texto alrededor
  const jsonStart = cleaned.indexOf('{');
  const jsonEnd   = cleaned.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd > jsonStart) {
    cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
  }

  try {
    const parsed = JSON.parse(cleaned);
    // Garantizar shape mínimo esperado
    if (!parsed.offer)               parsed.offer = {};
    if (!Array.isArray(parsed.offer.bonuses)) parsed.offer.bonuses = [];
    if (!Array.isArray(parsed.pain_points))   parsed.pain_points   = [];
    return { ...FALLBACK, ...parsed, offer: { ...FALLBACK.offer, ...parsed.offer } };
  } catch (e) {
    console.warn('[parseLandingCopy] JSON.parse falló — devolviendo fallback. Raw:', cleaned.substring(0, 300));
    return FALLBACK;
  }
}

// ── TAREA 3: Inyección por campo en el panel de preview ──────────────────────
function updateLandingCopy() {
  populateLandingControlPanel();
  updateLandingPreview();
}

function populateLandingControlPanel() {
  const d = appState.finalCopy || {};
  
  const heroTitle = document.getElementById('inp-hero-title');
  if (heroTitle) heroTitle.value = d.hero_title || '';
  
  const uniqueMech = document.getElementById('inp-unique-mechanism');
  if (uniqueMech) uniqueMech.value = d.unique_mechanism || '';
  
  const pain1 = document.getElementById('inp-pain-1');
  const pain2 = document.getElementById('inp-pain-2');
  const pain3 = document.getElementById('inp-pain-3');
  const pains = d.pain_points || [];
  if (pain1) pain1.value = pains[0] || '';
  if (pain2) pain2.value = pains[1] || '';
  if (pain3) pain3.value = pains[2] || '';
  
  const mainProduct = document.getElementById('inp-main-product');
  if (mainProduct) mainProduct.value = d.offer?.main_product || '';
  
  const bonus1 = document.getElementById('inp-bonus-1');
  const bonus2 = document.getElementById('inp-bonus-2');
  const bonus3 = document.getElementById('inp-bonus-3');
  const bonuses = d.offer?.bonuses || [];
  if (bonus1) bonus1.value = bonuses[0] || '';
  if (bonus2) bonus2.value = bonuses[1] || '';
  if (bonus3) bonus3.value = bonuses[2] || '';
  
  const priceOrig = document.getElementById('inp-price-original');
  if (priceOrig) priceOrig.value = d.offer?.price_original || '';
  
  const priceDisc = document.getElementById('inp-price-discount');
  if (priceDisc) priceDisc.value = d.offer?.price_discount || '';
  
  const guarantee = document.getElementById('inp-guarantee');
  if (guarantee) guarantee.value = d.guarantee || '';
  
  const ctaButton = document.getElementById('inp-cta-button');
  if (ctaButton) ctaButton.value = d.cta_button || '';
}

function updateLandingPreview() {
  const previewIframe = document.getElementById('landing-preview');
  if (!previewIframe) return;
  
  try {
    const type = document.getElementById('landing-type')?.value || 'autoridad';
    
    // 1. Asegurar que appState.finalCopy no sea null/undefined
    if (!appState.finalCopy) {
      appState.finalCopy = { hero_title: "Cargando...", unique_mechanism: "Preparando..." };
    }

    // 2. Generar con try-catch interno para que si falla el generador, no rompa la app
    let htmlContent;
    try {
      htmlContent = generateAppleLanding(appState.finalCopy);
    } catch (innerErr) {
      console.warn("El generador falló, usando vista de respaldo", innerErr);
      // Fallback: Si el generador complejo falla, renderizamos una vista simplificada
      // Nota: Asumimos que generateLandingPreview es el fallback existente o equivalente
      htmlContent = `<html><body style="font-family:sans-serif; padding:20px; text-align:center;">
        <h3>Estamos generando tu sitio...</h3>
        <p>Ajustando los últimos detalles de tu landing.</p>
        <pre>${JSON.stringify(appState.finalCopy, null, 2)}</pre>
      </body></html>`;
    }
    
    if (!htmlContent) throw new Error('Contenido vacío');

    previewIframe.srcdoc = htmlContent;
  } catch (err) {
    console.error('Error crítico en previsualización:', err);
    previewIframe.srcdoc = `<html><body style="font-family:sans-serif; padding:20px; text-align:center;">
      <h3>Ajustando landing...</h3><p>Los cambios se verán aquí en un momento.</p></body></html>`;
  }
}

function activateLandingFromEngine() {
  syncCartToState();
  closeGuidedMode();
  goStep(2);
  setTimeout(() => {
    populateLandingControlPanel();
    updateLandingPreview();
    showToast('🚀 ¡Lienzo de landing page cargado y listo!');
  }, 300);
}

// Renderizar el copy importado
function renderLandingCopy() {
  populateLandingControlPanel();
  updateLandingPreview();
}

function generateLandingPreview(data, type) {
    const d = data || {};
    // Fallback básico para renderizar algo aunque no exista el generador completo todavía
    return `
      <html>
        <body style="font-family:sans-serif; padding: 40px; text-align: center;">
          <h1>${d.hero_title || 'Título en proceso...'}</h1>
          <p>${d.unique_mechanism || 'Explicando valor...'}</p>
          <div style="background:#f4f4f4; padding:20px; border-radius:10px;">
            <p><strong>Estilo seleccionado:</strong> ${type}</p>
          </div>
          <pre>${JSON.stringify(d, null, 2)}</pre>
        </body>
      </html>
    `;
}

function initRealTimeReactivity() {
  const inputs = [
    { id: 'inp-hero-title', key: 'hero_title' },
    { id: 'inp-unique-mechanism', key: 'unique_mechanism' },
    { id: 'inp-pain-1', key: 'pain_1', isPain: true, index: 0 },
    { id: 'inp-pain-2', key: 'pain_2', isPain: true, index: 1 },
    { id: 'inp-pain-3', key: 'pain_3', isPain: true, index: 2 },
    { id: 'inp-main-product', key: 'main_product', isOffer: true },
    { id: 'inp-bonus-1', key: 'bonus_1', isBonus: true, index: 0 },
    { id: 'inp-bonus-2', key: 'bonus_2', isBonus: true, index: 1 },
    { id: 'inp-bonus-3', key: 'bonus_3', isBonus: true, index: 2 },
    { id: 'inp-price-original', key: 'price_original', isOffer: true, isNumber: true },
    { id: 'inp-price-discount', key: 'price_discount', isOffer: true, isNumber: true },
    { id: 'inp-guarantee', key: 'guarantee' },
    { id: 'inp-cta-button', key: 'cta_button' }
  ];

  inputs.forEach(item => {
    const el = document.getElementById(item.id);
    if (!el) return;

    el.addEventListener('input', () => {
      if (!appState.finalCopy || typeof appState.finalCopy !== 'object') {
        appState.finalCopy = {
          hero_title: '',
          pain_points: [],
          unique_mechanism: '',
          offer: { main_product: '', bonuses: [], price_original: 0, price_discount: 0 },
          guarantee: '',
          cta_button: ''
        };
      }
      
      const val = item.isNumber ? (parseFloat(el.value) || 0) : el.value;

      if (item.isPain) {
        if (!Array.isArray(appState.finalCopy.pain_points)) appState.finalCopy.pain_points = [];
        appState.finalCopy.pain_points[item.index] = val;
      } else if (item.isBonus) {
        if (!appState.finalCopy.offer) appState.finalCopy.offer = {};
        if (!Array.isArray(appState.finalCopy.offer.bonuses)) appState.finalCopy.offer.bonuses = [];
        appState.finalCopy.offer.bonuses[item.index] = val;
      } else if (item.isOffer) {
        if (!appState.finalCopy.offer) appState.finalCopy.offer = {};
        appState.finalCopy.offer[item.key] = val;
      } else {
        appState.finalCopy[item.key] = val;
      }

      updateLandingPreview();
    });
  });
}

function initLandingGeneratorEvents() {
  const publishBtn = document.getElementById("publish-landing-btn");
  const copyBtn = document.getElementById("copy-html-btn");
  const downloadBtn = document.getElementById("download-html-btn");
  const landingType = document.getElementById("landing-type");

  initRealTimeReactivity();

  if (landingType) {
    landingType.addEventListener("change", () => {
      setLandingStyle(landingType.value);
      updateLandingPreview();
    });
  }

  if (publishBtn) {
    publishBtn.addEventListener("click", () => {
      const previewIframe = document.getElementById("landing-preview");
      const htmlContent = previewIframe ? previewIframe.srcdoc : "";
      if (!htmlContent) {
        showToast("⚠️ Generá o editá tu landing antes de publicar.");
        return;
      }
      
      navigator.clipboard.writeText(htmlContent).then(() => {
        showToast("🚀 ¡Sitio web publicado! Código HTML copiado al portapapeles.");
      }).catch(() => {
        showToast("🚀 ¡Sitio web publicado con éxito!");
      });
      
      const blob = new Blob([htmlContent], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "index.html";
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      const previewIframe = document.getElementById("landing-preview");
      const htmlContent = previewIframe ? previewIframe.srcdoc : "";
      if (!htmlContent) return;
      navigator.clipboard.writeText(htmlContent).then(() => {
        showToast("📋 ¡Código HTML copiado!");
      });
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      const previewIframe = document.getElementById("landing-preview");
      const htmlContent = previewIframe ? previewIframe.srcdoc : "";
      if (!htmlContent) return;
      const blob = new Blob([htmlContent], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "index.html";
      a.click();
      URL.revokeObjectURL(url);
      showToast("💾 Archivo index.html descargado");
    });
  }

  if (!appState.finalCopy || !appState.finalCopy.hero_title) {
    appState.finalCopy = {
      hero_title: 'Transformá tu negocio digital hoy',
      pain_points: [
        '¿Estás cansado de no ver resultados consistentes?',
        '¿Sentís que perdés el tiempo con fórmulas viejas?',
        '¿Te cuesta escalar tus ventas orgánicas?'
      ],
      unique_mechanism: 'Nuestra metodología paso a paso te guía de cero a tus primeros clientes utilizando inteligencia artificial adaptativa.',
      offer: {
        main_product: 'AI Business OS Pro',
        bonuses: [
          'Bono 1: Acceso a la comunidad VIP',
          'Bono 2: Plantillas de emails de alta conversión',
          'Bono 3: Masterclass de Tráfico pago'
        ],
        price_original: 97,
        price_discount: 27
      },
      guarantee: 'Garantía incondicional de 7 días. Si no ves valor, te devolvemos el 100% de tu dinero.',
      cta_button: '¡Comenzar ahora!'
    };
  }

  populateLandingControlPanel();
  updateLandingPreview();
}

// ── TAREA 3: Generador de landing inyecta cada campo del objeto JSON ─────────
function generateAppleLanding(copyInput) {
  // Aceptar tanto objeto JSON parseado como string (fallback)
  const d = (typeof copyInput === 'object' && copyInput !== null)
    ? copyInput
    : parseLandingCopy(copyInput);

  const title    = esc(d.hero_title)    || 'Tu solución está aquí';
  const subtitle = esc(d.unique_mechanism) || 'Descubre cómo funciona.';
  const feature  = Array.isArray(d.pain_points) && d.pain_points[0]
    ? esc(d.pain_points[0]) + (d.pain_points[1] ? ' · ' + esc(d.pain_points[1]) : '')
    : 'Resultados reales, metodología comprobada.';
  const benefit  = esc(d.guarantee) || 'Garantía de satisfacción incluida.';
  const ctaText  = esc(d.cta_button) || 'Comenzar ahora';
  const product  = esc(d.offer?.main_product) || title;
  const priceDsc = d.offer?.price_discount ? `$${d.offer.price_discount}` : '';
  const priceOrig= d.offer?.price_original  ? `$${d.offer.price_original}` : '';
  const bonusItems = Array.isArray(d.offer?.bonuses)
    ? d.offer.bonuses.map((b, i) => `<li>✅ <strong>Bono ${i+1}:</strong> ${esc(b)}</li>`).join('')
    : '';
  const painCards = Array.isArray(d.pain_points) && d.pain_points.length
    ? d.pain_points.map(p =>
        `<div class="glass reveal vp-glow"><p>${esc(p)}</p></div>`
      ).join('')
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif;
      background: #000;
      color: #fff;
      min-height: 100vh;
      overflow-x: hidden;
    }
    .hero {
      position: relative;
      padding: 120px 20px 80px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 70vh;
      overflow: hidden;
    }
    .hero h1 {
      font-size: 56px;
      font-weight: 800;
      letter-spacing: -0.015em;
      margin-bottom: 24px;
      background: linear-gradient(180deg, #fff 0%, #a1a1a1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      line-height: 1.1;
      max-width: 800px;
    }
    .hero p {
      font-size: 24px;
      line-height: 1.4;
      color: #86868b;
      max-width: 600px;
      margin-bottom: 40px;
    }
    .btn-container {
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
      justify-content: center;
    }
    .vp-btn {
      position: relative;
      display: inline-block;
      padding: 16px 32px;
      font-size: 16px;
      font-weight: 600;
      text-decoration: none;
      color: #fff;
      background: rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 30px;
      box-shadow: 0 4px 30px rgba(0, 0, 0, 0.5);
      transition: transform 0.3s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.3s ease, background 0.3s ease;
      cursor: pointer;
    }
    .vp-btn:hover {
      transform: translateY(-6px) scale(1.03);
      box-shadow: 0 20px 40px rgba(255, 255, 255, 0.15);
      background: rgba(255, 255, 255, 0.25);
    }
    .vp-btn:active {
      transform: translateY(-2px) scale(0.98);
    }
    .vp-btn-secondary {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .vp-btn-secondary:hover {
      background: rgba(255, 255, 255, 0.1);
    }
    .vp-glow {
      position: relative;
    }
    .vp-glow::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 400px;
      height: 400px;
      transform: translate(-50%, -50%);
      background: radial-gradient(circle, rgba(124, 92, 252, 0.2) 0%, rgba(0,0,0,0) 70%);
      filter: blur(50px);
      z-index: -1;
      opacity: 0;
      transition: opacity 1.5s ease;
      pointer-events: none;
    }
    .vp-glow.visible::before { opacity: 1; }
    .features-section {
      padding: 80px 20px;
      max-width: 1000px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
    }
    @media (max-width: 768px) {
      .features-section { grid-template-columns: 1fr; }
      .hero h1 { font-size: 38px; }
      .hero p { font-size: 18px; }
    }
    .glass {
      background: rgba(255, 255, 255, 0.03);
      backdrop-filter: blur(30px) saturate(180%);
      -webkit-backdrop-filter: blur(30px) saturate(180%);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 24px;
      padding: 40px;
      box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
      transition: border-color 0.3s ease;
    }
    .glass:hover { border-color: rgba(255, 255, 255, 0.2); }
    .glass h3 {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 16px;
      color: #fff;
    }
    .glass p {
      font-size: 16px;
      line-height: 1.6;
      color: #86868b;
    }
    .reveal {
      opacity: 0;
      transform: translateY(40px);
      transition: opacity 1s cubic-bezier(0.25, 1, 0.5, 1), transform 1s cubic-bezier(0.25, 1, 0.5, 1);
    }
    .reveal.visible {
      opacity: 1;
      transform: translateY(0);
    }
  </style>
</head>
<body>
  <section class="hero reveal vp-glow">
    <h1>${title}</h1>
    <p>${subtitle}</p>
    <div class="btn-container">
      <a href="#checkout" class="vp-btn reveal">${ctaText}</a>
      <a href="#features" class="vp-btn vp-btn-secondary reveal">Ver más</a>
    </div>
  </section>

  ${painCards ? `<section class="features-section" id="features">
    <h2 style="grid-column:1/-1;text-align:center;font-size:28px;margin-bottom:8px;color:#fff">¿Te identificas?</h2>
    ${painCards}
  </section>` : ''}

  <section class="features-section">
    <div class="glass reveal vp-glow">
      <h3>🎯 ${product}</h3>
      <p>${subtitle}</p>
      ${bonusItems ? `<ul style="margin-top:16px;padding-left:0;list-style:none;color:#ccc">${bonusItems}</ul>` : ''}
    </div>
    <div class="glass reveal vp-glow">
      <h3>🛡️ Garantía incluida</h3>
      <p>${benefit}</p>
      ${priceDsc ? `<p style="margin-top:16px;font-size:22px;font-weight:700;color:#7cf">Precio: <s style="opacity:.4;font-size:16px">${priceOrig}</s> ${priceDsc}</p>` : ''}
      <a href="#checkout" class="vp-btn" style="margin-top:20px;display:inline-block">${ctaText}</a>
    </div>
  </section>
  <script>
    document.addEventListener('DOMContentLoaded', () => {
      const reveals = document.querySelectorAll('.reveal');
      const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            obs.unobserve(entry.target);
          }
        });
      }, { threshold: 0.2 });
      reveals.forEach(el => observer.observe(el));
    });
  </script>
</body>
</html>`;
}

// extractTitle/Subtitle/Feature/Benefit eliminados — reemplazados por parseLandingCopy() + generateAppleLanding(obj)

// Inicializar eventos después de que el DOM esté listo
function initLandingGenerator() {
  initLandingStyleSelector();
  initLandingGeneratorEvents();
  renderLandingCopy();
}

// Inicializador principal seguro: se ejecuta cuando el DOM está listo
function initApp() {
  try { applyDynamicYears(); } catch (e) {}
  try { updateApiIndicator(); } catch (e) {}
  try { buildChips('platform-chips', platforms, 'platform', 'TikTok'); } catch (e) {}
  try { buildChips('content-type-chips', contentTypes, 'contentType', 'Antes/Después del resultado'); } catch (e) {}
  try { buildChips('ad-type-chips', adTypes, 'adType', 'Imagen estática + texto'); } catch (e) {}
  try { initLandingGenerator(); } catch (e) {}
  try { initDashboard(); } catch (e) {}
}

function initUI() {
  // placeholder for future UI boot tasks
}

function initRouter() {
  try { if (typeof goHome === 'function') goHome(); } catch (e) {}
}

// Ejecutar adjuntos y arranque cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  try { attachModuleGlobals(); } catch (e) {}
  try { initApp(); } catch (e) {}
  try { initUI(); } catch (e) {}
  try { initRouter(); } catch (e) {}


});

function renderNichoCards(nichos, container, categoria) {
  const tagClass = { 'Baja': 'tag-low', 'Media': 'tag-mid', 'Alta': 'tag-high' };
  const tendIcon = { '↑ Creciendo': '📈', '→ Estable': '➡️', '↓ Declinando': '📉' };

  const cards = nichos.map((n, i) => {
    const tc = tagClass[n.tag] || 'tag-mid';
    const ti = tendIcon[n.tendencia] || '→';
    return `
      <div class="option-card" id="nicho-card-${i}" onclick="selectNicho(${i})">
        <div class="option-card-check" id="nicho-check-${i}"></div>
        <div class="option-card-body">
          <div class="option-card-title">${n.titulo}</div>
          <div class="option-card-desc">${n.resumen}</div>
          <div class="option-card-meta">
            <span class="option-card-tag ${tc}">Saturación ${n.tag}</span>
            <span class="option-card-tag tag-income">${n.ingresos}</span>
            <span class="option-card-tag" style="background:transparent;border-color:var(--border2);color:var(--muted2)">${ti} ${n.tendencia}</span>
          </div>
        </div>
      </div>`;
  }).join('');

  container.innerHTML = `<div class="option-cards-grid">${cards}</div>`;

  // Guardar nichos en data attribute para acceso posterior
  container.dataset.nichos = JSON.stringify(nichos);
  container.dataset.categoria = categoria;
}

// ── Seleccionar nicho ─────────────────────────────────────────────────────────
function selectNicho(index) {
  const output   = document.getElementById('guided-nichos-output');
  const nichos   = JSON.parse(output.dataset.nichos || '[]');
  const categoria = output.dataset.categoria || '';
  const nicho    = nichos[index];
  if (!nicho) return;

  // Visual feedback: deselect todos, select el clickeado
  document.querySelectorAll('#guided-nichos-output .option-card').forEach((card, i) => {
    card.classList.toggle('selected', i === index);
    const check = card.querySelector('.option-card-check');
    if (check) check.textContent = i === index ? '✓' : '';
  });

  // Guardar en el carrito
  appState.businessCart.selectedNiche = { ...nicho, categoria };

  // Actualizar UI (habilita botón Next)
  updateGuidedUI();
}

// Conectar Producto → Conversion Engine → Landing
function usarEnLandingPage() {
    if (!appState.productoFinal) {
        alert("Primero selecciona o genera un producto.");
        return;
    }

    generarCopyDesdeProducto(appState.productoFinal)
        .then(copy => {
            setFinalCopy(copy);
            activarPanel("panel-landing-generator");
            updateLandingCopy();
        })
        .catch(err => {
            console.error(err);
            alert("Hubo un error generando el copy.");
        });
}

// Conversion Engine (Copy Engine)
async function generarCopyDesdeProducto(producto) {
    const prompt = `
Actúa como un Copywriter de Respuesta Directa de élite.

Toma este JSON del usuario:
${JSON.stringify(producto)}

Genera un copy perfectamente estructurado para una Landing Page.

IMPORTANTE:
- Devuelve SOLO un JSON válido.
- No incluyas texto fuera del JSON.
- No uses markdown.

Estructura EXACTA:

{
  "headline": "",
  "subheadline": "",
  "mechanism": "",
  "offer_stack": {
    "product": "",
    "bonuses": []
  },
  "cta": ""
}
`;

    const response = await generarIA(prompt);
    // Si la respuesta ya es un objeto, devolver directamente
    if (response && typeof response === 'object') return response;

    const text = typeof response === 'string' ? response.trim() : String(response);
    // 1) Intentar parseo directo
    try { return JSON.parse(text); } catch (e) {}

    // 2) Extraer JSON embebido
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { return JSON.parse(jsonMatch[0]); } catch (e) {}
    }

    // 3) Mapear líneas clave: valor como fallback
    const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const kv = {};
    lines.forEach(line => {
      const m = line.match(/^\s*[-*]?\s*([^:]+):\s*(.+)$/);
      if (m) kv[m[1].trim().toLowerCase().replace(/\s+/g,'_')] = m[2].trim();
    });

    const fallback = {
      headline: kv.headline || kv.titulo || lines[0] || 'Landing generada',
      subheadline: kv.subheadline || kv.subtitulo || lines[1] || '',
      mechanism: kv.mechanism || kv.mecanismo || lines[2] || '',
      offer_stack: { product: kv.product || kv.producto || lines.slice(3,6).join(' ') || '', bonuses: [] },
      cta: kv.cta || kv.llamada || lines[lines.length - 1] || 'Comprar ahora'
    };
    const bonusesRaw = kv.bonuses || kv.bonos || kv.bonus;
    if (bonusesRaw) fallback.offer_stack.bonuses = bonusesRaw.split(/[,;]\s*/).map(s=>s.trim()).filter(Boolean);
    return fallback;
}

