export const appState = {
  productoFinal: null,
  finalCopy: null,
  finalCopyRaw: '',
  landingStyle: 'minimalista',
  currentPanel: 'home',
  currentStep: 0,
  businessCart: {
    selectedNiche: null,
    selectedAvatar: null,
    productType: null,
    selectedName: null,
    selectedPrice: null,
    selectedPromesa: null,
    selectedCanal: null,
    selectedStrategy: null,
  },
};

export function setProductoFinal(producto) {
  appState.productoFinal = producto;
}

export function setFinalCopy(finalCopy, raw = '') {
  appState.finalCopy = finalCopy;
  if (typeof raw === 'string' && raw.length > 0) {
    appState.finalCopyRaw = raw;
  } else if (typeof finalCopy === 'string' && !appState.finalCopyRaw) {
    appState.finalCopyRaw = finalCopy;
  }
}

export function setFinalCopyRaw(rawText) {
  appState.finalCopyRaw = rawText || '';
}

export function setLandingStyle(style) {
  if (!style) return;
  appState.landingStyle = style;
}

export function setCurrentPanel(panelId) {
  appState.currentPanel = panelId || appState.currentPanel;
}
