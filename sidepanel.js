// Side Panel 筆記介面邏輯
let currentUrl = '';
let autoSaveTimer = null;

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  await loadCurrentPageInfo();
  setupEventListeners();
  await loadCurrentNote();
});

// 載入當前頁面資訊
async function loadCurrentPageInfo() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      currentUrl = tabs[0].url;
      document.getElementById('currentUrl').textContent = new URL(currentUrl).hostname;
    }
  } catch (e) {
    document.getElementById('currentUrl').textContent = '無法取得頁面資訊';
  }
}

// 設定事件監聽
function setupEventListeners() {
  // Tab 切換
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tab = e.target.dataset.tab;
      switchTab(tab);
    });
  });

  // 筆記輸入 - 自動儲存
  const noteContent = document.getElementById('noteContent');
  noteContent.addEventListener('input', () => {
    updateWordCount();
    scheduleAutoSave();
  });

  // 手動儲存按鈕
  document.getElementById('saveBtn').addEventListener('click', saveCurrentNote);

  // 清除按鈕
  document.getElementById('clearBtn').addEventListener('click', async () => {
    if (confirm('確定要清除當前筆記嗎？')) {
      document.getElementById('noteContent').value = '';
      await saveCurrentNote();
    }
  });

  // 搜尋
  document.getElementById('searchNotes').addEventListener('input', async (e) => {
    const query = e.target.value;
    const notes = await NotesManager.searchNotes(query);
    renderNotesList(notes);
  });

  // 匯出
  document.getElementById('exportBtn').addEventListener('click', () => {
    NotesManager.exportNotes();
  });

  // 生成摘要
  document.getElementById('generateSummaryBtn').addEventListener('click', async () => {
    await generateSummary();
  });

  // 監聽來自 content script 的訊息
  window.addEventListener('message', (event) => {
    if (event.data.type === 'BB_HIGHLIGHT_ADDED' || 
        event.data.type === 'BB_HIGHLIGHT_UPDATED' ||
        event.data.type === 'BB_HIGHLIGHT_DELETED') {
      loadHighlights();
    }
    if (event.data.type === 'BB_CLIPBOARD_UPDATED') {
      loadClipboard();
    }
  });

  // 清空剪貼簿
  document.getElementById('clearClipboardBtn').addEventListener('click', async () => {
    if (confirm('確定要清空所有剪貼簿記錄嗎？')) {
      await clearClipboard();
    }
  });
}

// 切換 Tab
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('hidden', content.id !== `${tab}Tab`);
  });

  if (tab === 'all') {
    loadAllNotes();
  } else if (tab === 'highlights') {
    loadHighlights();
  } else if (tab === 'summary') {
    loadSummary();
  } else if (tab === 'clipboard') {
    loadClipboard();
  }
}

// 載入當前頁面筆記
async function loadCurrentNote() {
  if (!currentUrl) return;

  const note = await NotesManager.getCurrentNote(currentUrl);
  const noteContent = document.getElementById('noteContent');
  
  if (note) {
    noteContent.value = note.content;
    updateWordCount();
    updateLastSaved(note.updated);
  } else {
    noteContent.value = '';
    updateWordCount();
  }
}

// 儲存當前筆記
async function saveCurrentNote() {
  if (!currentUrl) return;

  const content = document.getElementById('noteContent').value;
  const saveStatus = document.getElementById('saveStatus');
  
  saveStatus.textContent = '儲存中...';
  saveStatus.className = 'save-status saving';

  try {
    const note = await NotesManager.saveNote(currentUrl, content);
    saveStatus.textContent = '✓ 已儲存';
    saveStatus.className = 'save-status saved';
    updateLastSaved(note.updated);
    
    setTimeout(() => {
      saveStatus.textContent = '';
    }, 2000);
  } catch (e) {
    saveStatus.textContent = '✗ 儲存失敗';
    saveStatus.className = 'save-status';
  }
}

// 排程自動儲存
function scheduleAutoSave() {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
  }
  
  autoSaveTimer = setTimeout(() => {
    saveCurrentNote();
  }, 1000); // 1秒後自動儲存
}

// 更新字數統計
function updateWordCount() {
  const content = document.getElementById('noteContent').value;
  const count = content.trim().length;
  document.getElementById('wordCount').textContent = `${count} 字`;
}

// 更新最後儲存時間
function updateLastSaved(timestamp) {
  const lastSaved = document.getElementById('lastSaved');
  if (timestamp) {
    lastSaved.textContent = `最後儲存: ${NotesManager.formatTime(timestamp)}`;
  }
}

// 載入所有筆記
async function loadAllNotes() {
  const notes = await NotesManager.getAllNotes();
  renderNotesList(notes);
}

// 渲染筆記列表
function renderNotesList(notes) {
  const notesList = document.getElementById('notesList');
  
  if (notes.length === 0) {
    notesList.innerHTML = '<div class="empty-state">尚無筆記</div>';
    return;
  }

  notesList.innerHTML = notes.map(note => {
    const preview = note.content.substring(0, 150) + (note.content.length > 150 ? '...' : '');
    const hostname = new URL(note.url).hostname;
    
    return `
      <div class="note-item" data-url="${note.url}">
        <div class="note-item-url">📄 ${hostname}</div>
        <div class="note-item-preview">${preview || '(空白筆記)'}</div>
        <div class="note-item-meta">
          <span>${note.wordCount} 字 · ${NotesManager.formatTime(note.updated)}</span>
          <div class="note-item-actions">
            <button class="open-note" title="開啟">🔗</button>
            <button class="delete-note" title="刪除">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // 綁定事件
  notesList.querySelectorAll('.note-item').forEach(item => {
    const url = item.dataset.url;
    
    item.querySelector('.open-note').addEventListener('click', async (e) => {
      e.stopPropagation();
      const tabs = await chrome.tabs.query({ url: url });
      if (tabs.length > 0) {
        await chrome.tabs.update(tabs[0].id, { active: true });
      } else {
        await chrome.tabs.create({ url: url });
      }
    });

    item.querySelector('.delete-note').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('確定要刪除這則筆記嗎？')) {
        await NotesManager.deleteNote(url);
        await loadAllNotes();
      }
    });

    item.addEventListener('click', async () => {
      // 切換到該頁面的筆記
      currentUrl = url;
      document.getElementById('currentUrl').textContent = new URL(url).hostname;
      switchTab('current');
      await loadCurrentNote();
    });
  });
}
