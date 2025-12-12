document.addEventListener('DOMContentLoaded', () => {
  const focusModeCheckbox = document.getElementById('focusMode');
  const darkModeCheckbox = document.getElementById('darkMode');
  const readerModeCheckbox = document.getElementById('readerMode');

  // Load saved states
  chrome.storage.sync.get(['focusMode', 'darkMode', 'readerMode'], (result) => {
    focusModeCheckbox.checked = result.focusMode || false;
    darkModeCheckbox.checked = result.darkMode || false;
    readerModeCheckbox.checked = result.readerMode || false;
  });

  // Function to save and send settings
  function updateSettings() {
    const settings = {
      focusMode: focusModeCheckbox.checked,
      darkMode: darkModeCheckbox.checked,
      readerMode: readerModeCheckbox.checked
    };

    // Save to storage
    chrome.storage.sync.set(settings);

    // Send to active tab
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "updateSettings",
          settings: settings
        });
      }
    });
  }

  // Add event listeners
  focusModeCheckbox.addEventListener('change', updateSettings);
  darkModeCheckbox.addEventListener('change', updateSettings);
  readerModeCheckbox.addEventListener('change', updateSettings);
});