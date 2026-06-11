const appState = {
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

function setProductoFinal(producto) {
  appState.productoFinal = producto;
}

function setFinalCopy(finalCopy, raw = '') {
  appState.finalCopy = finalCopy;
  if (typeof raw === 'string' && raw.length > 0) {
    appState.finalCopyRaw = raw;
  } else if (typeof finalCopy === 'string' && !appState.finalCopyRaw) {
    appState.finalCopyRaw = finalCopy;
  }
}

function setFinalCopyRaw(rawText) {
  appState.finalCopyRaw = rawText || '';
}

function setLandingStyle(style) {
  if (!style) return;
  appState.landingStyle = style;
}

function setCurrentPanel(panelId) {
  appState.currentPanel = panelId || appState.currentPanel;
}


// Exposición global
window.appState = appState;
window.setProductoFinal = setProductoFinal;
window.setFinalCopy = setFinalCopy;
window.setFinalCopyRaw = setFinalCopyRaw;
window.setLandingStyle = setLandingStyle;
window.setCurrentPanel = setCurrentPanel;
