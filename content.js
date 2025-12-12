// Function to apply settings
function applySettings(settings) {
  // Focus Mode
  if (settings.focusMode) {
    document.body.classList.add('bb-focus-mode');
  } else {
    document.body.classList.remove('bb-focus-mode');
  }

  // Dark Mode (Applied to html tag for full coverage)
  if (settings.darkMode) {
    document.documentElement.classList.add('bb-dark-mode');
  } else {
    document.documentElement.classList.remove('bb-dark-mode');
  }

  // Reader Mode
  if (settings.readerMode) {
    document.body.classList.add('bb-reader-mode');
  } else {
    document.body.classList.remove('bb-reader-mode');
  }
}

// 1. On load, check saved settings
chrome.storage.sync.get(['focusMode', 'darkMode', 'readerMode'], (result) => {
  applySettings(result);
});

// 2. Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateSettings") {
    applySettings(request.settings);
  }
});