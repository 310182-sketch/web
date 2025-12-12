document.addEventListener('DOMContentLoaded', () => {
  const focusModeCheckbox = document.getElementById('focusMode');
  const darkModeCheckbox = document.getElementById('darkMode');
  const readerModeCheckbox = document.getElementById('readerMode');
  const zapperToggle = document.getElementById('zapperToggle');
  const savePageBtn = document.getElementById('savePageBtn');
  const readLaterList = document.getElementById('readLaterList');

  // Load saved states
  chrome.storage.sync.get(['focusMode', 'darkMode', 'readerMode', 'zapperActive'], (result) => {
    focusModeCheckbox.checked = result.focusMode || false;
    darkModeCheckbox.checked = result.darkMode || false;
    readerModeCheckbox.checked = result.readerMode || false;
    
    if (result.zapperActive) {
      zapperToggle.classList.add('active');
      zapperToggle.textContent = '✅ 元素隱藏器 (啟用中)';
    }
  });

  // Function to save and send settings
  function updateSettings() {
    const settings = {
      focusMode: focusModeCheckbox.checked,
      darkMode: darkModeCheckbox.checked,
      readerMode: readerModeCheckbox.checked
    };

    chrome.storage.sync.set(settings);

    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "updateSettings",
          settings: settings
        });
      }
    });
  }

  // Add event listeners for mode toggles
  focusModeCheckbox.addEventListener('change', updateSettings);
  darkModeCheckbox.addEventListener('change', updateSettings);
  readerModeCheckbox.addEventListener('change', updateSettings);

  // Element Zapper Toggle
  zapperToggle.addEventListener('click', () => {
    chrome.storage.sync.get(['zapperActive'], (result) => {
      const newState = !result.zapperActive;
      chrome.storage.sync.set({ zapperActive: newState });

      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: "toggleZapper",
            enabled: newState
          });
        }
      });

      if (newState) {
        zapperToggle.classList.add('active');
        zapperToggle.textContent = '✅ 元素隱藏器 (啟用中)';
      } else {
        zapperToggle.classList.remove('active');
        zapperToggle.textContent = '🎯 元素隱藏器';
      }
    });
  });

  // Save current page to Read Later
  savePageBtn.addEventListener('click', () => {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0]) {
        const page = {
          url: tabs[0].url,
          title: tabs[0].title,
          timestamp: Date.now()
        };

        chrome.storage.sync.get(['readLater'], (result) => {
          const readLater = result.readLater || [];
          // Check if already exists
          if (!readLater.some(p => p.url === page.url)) {
            readLater.unshift(page);
            chrome.storage.sync.set({ readLater }, () => {
              loadReadLaterList();
              savePageBtn.textContent = '✅ 已加入';
              setTimeout(() => {
                savePageBtn.textContent = '💾 加入稍後閱讀';
              }, 1500);
            });
          }
        });
      }
    });
  });

  // Load and display Read Later list
  function loadReadLaterList() {
    chrome.storage.sync.get(['readLater'], (result) => {
      const readLater = result.readLater || [];
      
      if (readLater.length === 0) {
        readLaterList.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">清單為空</div>';
        return;
      }

      readLaterList.innerHTML = readLater.map((page, index) => `
        <div class="read-later-item">
          <a href="${page.url}" target="_blank" title="${page.title}">${page.title}</a>
          <button class="delete-btn" data-index="${index}">刪除</button>
        </div>
      `).join('');

      // Add delete event listeners
      document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const index = parseInt(e.target.dataset.index);
          readLater.splice(index, 1);
          chrome.storage.sync.set({ readLater }, loadReadLaterList);
        });
      });
    });
  }

  loadReadLaterList();
});