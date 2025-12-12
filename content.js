// Function to apply settings
function applySettings(settings) {
  if (settings.focusMode) {
    document.body.classList.add('bb-focus-mode');
  } else {
    document.body.classList.remove('bb-focus-mode');
  }

  if (settings.darkMode) {
    document.documentElement.classList.add('bb-dark-mode');
  } else {
    document.documentElement.classList.remove('bb-dark-mode');
  }

  if (settings.readerMode) {
    document.body.classList.add('bb-reader-mode');
  } else {
    document.body.classList.remove('bb-reader-mode');
  }
}

// Element Zapper variables
let zapperActive = false;
let currentHighlight = null;

function enableZapper() {
  zapperActive = true;
  document.body.classList.add('bb-zapper-active');

  document.addEventListener('mouseover', zapperMouseOver);
  document.addEventListener('mouseout', zapperMouseOut);
  document.addEventListener('click', zapperClick, true);
}

function disableZapper() {
  zapperActive = false;
  document.body.classList.remove('bb-zapper-active');
  
  document.removeEventListener('mouseover', zapperMouseOver);
  document.removeEventListener('mouseout', zapperMouseOut);
  document.removeEventListener('click', zapperClick, true);

  if (currentHighlight) {
    currentHighlight.classList.remove('bb-zapper-highlight');
    currentHighlight = null;
  }
}

function zapperMouseOver(e) {
  if (e.target !== document.body && e.target !== document.documentElement) {
    if (currentHighlight) {
      currentHighlight.classList.remove('bb-zapper-highlight');
    }
    currentHighlight = e.target;
    currentHighlight.classList.add('bb-zapper-highlight');
  }
}

function zapperMouseOut(e) {
  if (e.target === currentHighlight) {
    e.target.classList.remove('bb-zapper-highlight');
  }
}

function zapperClick(e) {
  if (zapperActive && e.target !== document.body && e.target !== document.documentElement) {
    e.preventDefault();
    e.stopPropagation();
    e.target.style.display = 'none';
    currentHighlight = null;
  }
}

// On load, check saved settings
chrome.storage.sync.get(['focusMode', 'darkMode', 'readerMode', 'zapperActive'], (result) => {
  applySettings(result);
  
  if (result.zapperActive) {
    enableZapper();
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateSettings") {
    applySettings(request.settings);
  }
  
  if (request.action === "toggleZapper") {
    if (request.enabled) {
      enableZapper();
    } else {
      disableZapper();
    }
  }
});