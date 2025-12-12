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

// 載入剪貼簿歷史
async function loadClipboard() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs[0]) return;

  const results = await chrome.scripting.executeScript({
    target: { tabId: tabs[0].id },
    func: () => window.bbClipboard?.getHistory() || []
  });

  const history = results[0]?.result || [];
  renderClipboard(history);
}

function renderClipboard(history) {
  const clipboardList = document.getElementById('clipboardList');
  const clipboardCount = document.getElementById('clipboardCount');
  
  clipboardCount.textContent = `${history.length} 條記錄`;

  if (history.length === 0) {
    clipboardList.innerHTML = '<div class="empty-state">尚無剪貼簿記錄<br><small>在網頁上複製文字即可自動儲存</small></div>';
    return;
  }

  clipboardList.innerHTML = history.map((item, index) => {
    const preview = item.text.substring(0, 200);
    const hasMore = item.text.length > 200;
    
    return `
      <div class="clipboard-item" data-id="${item.id}">
        <div class="clipboard-text" data-full="${encodeURIComponent(item.text)}">
          ${preview}${hasMore ? '...' : ''}
        </div>
        <div class="clipboard-source" title="${item.source.url}">
          ${item.source.hostname}
        </div>
        <div class="clipboard-meta">
          <span>${formatClipboardTime(item.timestamp)}</span>
          <div class="clipboard-actions">
            <button class="clipboard-copy-btn" title="複製">📋 複製</button>
            <button class="clipboard-delete-btn" title="刪除">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // 綁定事件
  clipboardList.querySelectorAll('.clipboard-item').forEach((item, index) => {
    const clipItem = history[index];
    const textDiv = item.querySelector('.clipboard-text');
    
    // 點擊展開/收起
    textDiv.addEventListener('click', () => {
      textDiv.classList.toggle('expanded');
    });
    
    // 複製按鈕
    item.querySelector('.clipboard-copy-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      const btn = e.target;
      const originalText = btn.textContent;
      
      try {
        await navigator.clipboard.writeText(clipItem.text);
        btn.textContent = '✓ 已複製';
        btn.style.background = '#27ae60';
        
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.background = '';
        }, 2000);
      } catch (error) {
        btn.textContent = '✗ 失敗';
        btn.style.background = '#e74c3c';
        
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.background = '';
        }, 2000);
      }
    });
    
    // 刪除按鈕
    item.querySelector('.clipboard-delete-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        await chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: (id) => window.bbClipboard?.deleteItem(id),
          args: [clipItem.id]
        });
        await loadClipboard();
      }
    });
  });
}

async function clearClipboard() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]) {
    await chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: () => window.bbClipboard?.clearHistory()
    });
    await loadClipboard();
  }
}

function formatClipboardTime(timestamp) {
  const date = new Date(timestamp);
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) return '剛剛';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分鐘前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小時前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
  
  return date.toLocaleDateString('zh-TW', { 
    month: 'short', 
    day: 'numeric'
  });
}

// 載入高亮列表
async function loadHighlights() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs[0]) return;

  const results = await chrome.scripting.executeScript({
    target: { tabId: tabs[0].id },
    func: () => {
      const currentUrl = window.location.href;
      return window.bbHighlighter?.getHighlights(currentUrl) || [];
    }
  });

  const highlights = results[0]?.result || [];
  renderHighlights(highlights);
}

function renderHighlights(highlights) {
  const highlightsList = document.getElementById('highlightsList');
  const highlightsCount = document.getElementById('highlightsCount');
  
  highlightsCount.textContent = `${highlights.length} 個高亮`;

  if (highlights.length === 0) {
    highlightsList.innerHTML = '<div class="empty-state">尚無高亮標記<br><small>選取文字即可標記</small></div>';
    return;
  }

  highlightsList.innerHTML = highlights.map((highlight, index) => {
    const colorClass = `color-${highlight.color}`;
    
    return `
      <div class="highlight-item ${colorClass}" data-id="${highlight.id}">
        <div class="highlight-text">${highlight.text}</div>
        ${highlight.note ? `<div class="highlight-note">📝 ${highlight.note}</div>` : ''}
        <div class="highlight-meta">
          <span>${NotesManager.formatTime(highlight.timestamp)}</span>
          <div class="highlight-actions">
            <button class="goto-highlight" title="跳轉">🔗</button>
            <button class="delete-highlight" title="刪除">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // 綁定事件
  highlightsList.querySelectorAll('.highlight-item').forEach((item, index) => {
    const highlight = highlights[index];
    
    item.querySelector('.goto-highlight').addEventListener('click', async () => {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        await chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: (id) => window.bbHighlighter?.scrollToHighlight(id),
          args: [highlight.id]
        });
      }
    });

    item.querySelector('.delete-highlight').addEventListener('click', async () => {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        await chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: (id) => window.bbHighlighter?.deleteHighlight(id),
          args: [highlight.id]
        });
      }
    });
  });
}

// 載入摘要
async function loadSummary() {
  const summaryContent = document.getElementById('summaryContent');
  const summaryStats = document.getElementById('summaryStats');
  
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs[0]) return;

  const currentUrl = tabs[0].url;
  const result = await chrome.storage.local.get(['summaries']);
  const summaries = result.summaries || {};
  const summary = summaries[currentUrl];

  if (summary) {
    summaryContent.textContent = summary.summary;
    summaryStats.innerHTML = `
      壓縮率: ${summary.compressionRatio}% | 
      原文字數: ${summary.originalLength.toLocaleString()} | 
      摘要字數: ${summary.summaryLength.toLocaleString()}
    `;
  } else {
    summaryContent.textContent = '尚無摘要';
    summaryStats.textContent = '點擊「生成摘要」按鈕開始';
  }
}

async function generateSummary() {
  const btn = document.getElementById('generateSummaryBtn');
  const summaryContent = document.getElementById('summaryContent');
  const summaryStats = document.getElementById('summaryStats');
  
  btn.disabled = true;
  btn.textContent = '⏳ 生成中...';
  summaryContent.textContent = '正在分析網頁內容...';

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]) return;

    const results = await chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: async () => {
        return await window.bbSummarizer?.summarize();
      }
    });

    const summary = results[0]?.result;
    
    if (summary) {
      summaryContent.textContent = summary.summary;
      summaryStats.innerHTML = `
        壓縮率: ${summary.compressionRatio}% | 
        原文字數: ${summary.originalLength.toLocaleString()} | 
        摘要字數: ${summary.summaryLength.toLocaleString()}
      `;
    } else {
      summaryContent.textContent = '生成失敗，請重試';
    }
  } catch (error) {
    summaryContent.textContent = `錯誤: ${error.message}`;
  } finally {
    btn.disabled = false;
    btn.textContent = '🤖 生成摘要';
  }
}

