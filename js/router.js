import { setCurrentPanel } from './state.js';

export function activarPanel(panelId) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  panel.classList.add('active');
  setCurrentPanel(panelId);
}

export function goStep(stepIndex) {
  const homePage = document.getElementById('home-page');
  if (homePage) homePage.classList.remove('active');

  const panels = document.querySelectorAll('.panel');
  panels.forEach((panel, index) => panel.classList.toggle('active', index === stepIndex));

  document.querySelectorAll('.step-btn').forEach((btn, index) => {
    btn.classList.toggle('active', index === stepIndex);
  });

  for (let i = 0; i <= 6; i++) {
    const sb = document.getElementById('sb-' + i);
    if (sb) sb.classList.toggle('active', i === stepIndex);
  }

  setCurrentPanel(`step-${stepIndex}`);
}

export function goHome() {
  const homePage = document.getElementById('home-page');
  if (homePage) homePage.classList.add('active');

  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  for (let i = 0; i <= 6; i++) {
    const sb = document.getElementById('sb-' + i);
    if (sb) sb.classList.remove('active');
  }
}

export function setLandingTab(tab) {
  document.querySelectorAll('.sub-tab').forEach((t, i) => {
    const active = (i === 0 && tab === 'copy') || (i === 1 && tab === 'html');
    t.classList.toggle('active', active);
  });

  const copySection = document.getElementById('landing-copy-section');
  const htmlSection = document.getElementById('landing-html-section');
  if (copySection) copySection.style.display = tab === 'copy' ? 'block' : 'none';
  if (htmlSection) htmlSection.style.display = tab === 'html' ? 'block' : 'none';
}
