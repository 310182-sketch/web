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
    if (event.data.type === 'BB_TODO_UPDATED') {
      loadTodos();
    }
    if (event.data.type === 'BB_WORKSPACE_UPDATED') {
      loadWorkspaces();
    }
  });

  // 清空剪貼簿
  document.getElementById('clearClipboardBtn').addEventListener('click', async () => {
    if (confirm('確定要清空所有剪貼簿記錄嗎？')) {
      await clearClipboard();
    }
  });

  // 待辦事項事件
  document.getElementById('addTodoBtn').addEventListener('click', () => {
    document.querySelector('.todo-container').classList.add('hidden');
    document.getElementById('todoForm').classList.remove('hidden');
  });

  document.getElementById('cancelTodoBtn').addEventListener('click', () => {
    document.getElementById('todoForm').classList.add('hidden');
    document.querySelector('.todo-container').classList.remove('hidden');
    clearTodoForm();
  });

  document.getElementById('saveTodoBtn').addEventListener('click', async () => {
    await saveTodo();
  });

  document.getElementById('clearCompletedBtn').addEventListener('click', async () => {
    if (confirm('確定要清除所有已完成的待辦事項嗎？')) {
      await clearCompletedTodos();
    }
  });

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      loadTodos(e.target.dataset.filter);
    });
  });

  // 工作區事件
  document.getElementById('saveWorkspaceBtn').addEventListener('click', () => {
    document.querySelector('.workspace-container').classList.add('hidden');
    document.getElementById('workspaceForm').classList.remove('hidden');
  });

  document.getElementById('cancelWorkspaceBtn').addEventListener('click', () => {
    document.getElementById('workspaceForm').classList.add('hidden');
    document.querySelector('.workspace-container').classList.remove('hidden');
    clearWorkspaceForm();
  });

  document.getElementById('saveWorkspaceConfirmBtn').addEventListener('click', async () => {
    await saveWorkspace();
  });

  // 工具事件
  document.getElementById('formatBtn').addEventListener('click', () => {
    formatText();
  });

  document.getElementById('minifyBtn').addEventListener('click', () => {
    minifyJSON();
  });

  document.getElementById('copyFormattedBtn').addEventListener('click', () => {
    copyFormattedText();
  });

  document.getElementById('generateQRBtn').addEventListener('click', () => {
    generateQRCode();
  });

  document.getElementById('generatePageQRBtn').addEventListener('click', async () => {
    await generatePageQR();
  });

  document.getElementById('downloadQRBtn').addEventListener('click', () => {
    downloadQR();
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
  } else if (tab === 'todo') {
    loadTodos();
  } else if (tab === 'workspace') {
    loadWorkspaces();
    updateCurrentWindowInfo();
  } else if (tab === 'tools') {
    // 工具標籤無需載入
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

// ===== 待辦事項功能 =====

async function loadTodos(filter = 'all') {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs[0]) return;

  const results = await chrome.scripting.executeScript({
    target: { tabId: tabs[0].id },
    func: async (filterType) => {
      if (filterType === 'pending') {
        return await window.bbTodo?.getPendingTodos() || [];
      } else if (filterType === 'completed') {
        return await window.bbTodo?.getCompletedTodos() || [];
      } else {
        return await window.bbTodo?.getAllTodos() || [];
      }
    },
    args: [filter]
  });

  const todos = results[0]?.result || [];
  await renderTodos(todos);
  await updateTodoStats();
}

function renderTodos(todos) {
  const todoList = document.getElementById('todoList');
  
  if (todos.length === 0) {
    todoList.innerHTML = '<div class="empty-state">尚無待辦事項<br><small>點擊「➕ 新增」來建立任務</small></div>';
    return;
  }

  todoList.innerHTML = todos.map(todo => {
    const dueDate = todo.dueDate ? new Date(todo.dueDate) : null;
    const isOverdue = dueDate && dueDate < new Date() && !todo.completed;
    
    return `
      <div class="todo-item ${todo.completed ? 'completed' : ''}" data-id="${todo.id}">
        <div class="todo-item-header">
          <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''}>
          <div class="todo-title">${todo.title}</div>
          <span class="todo-priority ${todo.priority}">${todo.priority}</span>
        </div>
        ${todo.description ? `<div class="todo-description">${todo.description}</div>` : ''}
        <div class="todo-meta">
          <div>
            <span class="todo-category">${todo.category}</span>
            ${dueDate ? `<span class="todo-due ${isOverdue ? 'overdue' : ''}">${formatTodoDate(dueDate)}</span>` : ''}
          </div>
          <div class="todo-actions-btn">
            <button class="todo-delete-btn" title="刪除">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // 綁定事件
  todoList.querySelectorAll('.todo-item').forEach((item, index) => {
    const todo = todos[index];
    
    // 切換完成狀態
    item.querySelector('.todo-checkbox').addEventListener('click', async (e) => {
      e.stopPropagation();
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        await chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: (id) => window.bbTodo?.toggleComplete(id),
          args: [todo.id]
        });
        await loadTodos(document.querySelector('.filter-btn.active').dataset.filter);
      }
    });

    // 刪除
    item.querySelector('.todo-delete-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('確定要刪除這個待辦事項嗎？')) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) {
          await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: (id) => window.bbTodo?.deleteTodo(id),
            args: [todo.id]
          });
          await loadTodos(document.querySelector('.filter-btn.active').dataset.filter);
        }
      }
    });
  });
}

async function updateTodoStats() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs[0]) return;

  const results = await chrome.scripting.executeScript({
    target: { tabId: tabs[0].id },
    func: async () => window.bbTodo?.getStats()
  });

  const stats = results[0]?.result;
  if (stats) {
    document.getElementById('todoStats').textContent = `${stats.pending} 待完成 / ${stats.total} 總計`;
  }
}

async function saveTodo() {
  const title = document.getElementById('todoTitle').value.trim();
  if (!title) {
    alert('請輸入任務標題');
    return;
  }

  const todoData = {
    title: title,
    description: document.getElementById('todoDescription').value.trim(),
    category: document.getElementById('todoCategory').value,
    priority: document.getElementById('todoPriority').value,
    dueDate: document.getElementById('todoDueDate').value || null
  };

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]) {
    await chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: (data) => window.bbTodo?.addTodo(data),
      args: [todoData]
    });

    document.getElementById('todoForm').classList.add('hidden');
    document.querySelector('.todo-container').classList.remove('hidden');
    clearTodoForm();
    await loadTodos();
  }
}

async function clearCompletedTodos() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]) {
    await chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: () => window.bbTodo?.clearCompleted()
    });
    await loadTodos();
  }
}

function clearTodoForm() {
  document.getElementById('todoTitle').value = '';
  document.getElementById('todoDescription').value = '';
  document.getElementById('todoCategory').value = '工作';
  document.getElementById('todoPriority').value = '中';
  document.getElementById('todoDueDate').value = '';
}

function formatTodoDate(date) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  today.setHours(0, 0, 0, 0);
  tomorrow.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  
  if (date < today) return '已逾期';
  if (date.getTime() === today.getTime()) return '今天';
  if (date.getTime() === tomorrow.getTime()) return '明天';
  
  return date.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' });
}

// ===== 工作區功能 =====

async function loadWorkspaces() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs[0]) return;

  const results = await chrome.scripting.executeScript({
    target: { tabId: tabs[0].id },
    func: async () => window.bbWorkspace?.getAllWorkspaces() || []
  });

  const workspaces = results[0]?.result || [];
  renderWorkspaces(workspaces);
}

function renderWorkspaces(workspaces) {
  const workspaceList = document.getElementById('workspaceList');
  
  if (workspaces.length === 0) {
    workspaceList.innerHTML = '<div class="empty-state">尚無已儲存的工作區<br><small>點擊「💾 儲存當前」來儲存當前視窗的所有分頁</small></div>';
    return;
  }

  workspaceList.innerHTML = workspaces.map(workspace => {
    return `
      <div class="workspace-item" data-id="${workspace.id}">
        <div class="workspace-name">${workspace.name}</div>
        ${workspace.description ? `<div class="workspace-description">${workspace.description}</div>` : ''}
        <div class="workspace-meta">
          <span>${workspace.tabCount} 個分頁</span>
          <span>${formatWorkspaceTime(workspace.createdAt)}</span>
        </div>
        <div class="workspace-tabs">
          ${workspace.tabs.slice(0, 3).map(tab => `<div class="workspace-tab-item">📄 ${tab.title}</div>`).join('')}
          ${workspace.tabs.length > 3 ? `<div class="workspace-tab-item">... 及其他 ${workspace.tabs.length - 3} 個分頁</div>` : ''}
        </div>
        <div class="workspace-actions">
          <button class="workspace-restore-btn">🔄 恢復</button>
          <button class="workspace-delete-btn">🗑️ 刪除</button>
        </div>
      </div>
    `;
  }).join('');

  // 綁定事件
  workspaceList.querySelectorAll('.workspace-item').forEach((item, index) => {
    const workspace = workspaces[index];
    
    item.querySelector('.workspace-restore-btn').addEventListener('click', async () => {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        await chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: (id) => window.bbWorkspace?.restoreWorkspace(id, false),
          args: [workspace.id]
        });
      }
    });

    item.querySelector('.workspace-delete-btn').addEventListener('click', async () => {
      if (confirm(`確定要刪除工作區「${workspace.name}」嗎？`)) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) {
          await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: (id) => window.bbWorkspace?.deleteWorkspace(id),
            args: [workspace.id]
          });
          await loadWorkspaces();
        }
      }
    });
  });
}

async function updateCurrentWindowInfo() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  document.getElementById('currentWindowInfo').textContent = `${tabs.length} 個分頁`;
}

async function saveWorkspace() {
  const name = document.getElementById('workspaceName').value.trim();
  if (!name) {
    alert('請輸入工作區名稱');
    return;
  }

  const description = document.getElementById('workspaceDescription').value.trim();

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]) {
    await chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: (name, desc) => window.bbWorkspace?.saveCurrentWorkspace(name, desc),
      args: [name, description]
    });

    document.getElementById('workspaceForm').classList.add('hidden');
    document.querySelector('.workspace-container').classList.remove('hidden');
    clearWorkspaceForm();
    await loadWorkspaces();
  }
}

function clearWorkspaceForm() {
  document.getElementById('workspaceName').value = '';
  document.getElementById('workspaceDescription').value = '';
}

function formatWorkspaceTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' });
}

// ===== 工具功能 =====

let currentQRDataUrl = null;

function formatText() {
  const input = document.getElementById('formatterInput').value;
  const formatType = document.getElementById('formatType').value;
  const output = document.getElementById('formatterOutput');

  if (!input.trim()) {
    output.textContent = '請輸入要格式化的內容';
    return;
  }

  const formatter = new Formatter();
  const result = formatter.format(input, formatType === 'auto' ? null : formatType);

  if (result.success) {
    output.textContent = result.formatted;
    output.style.color = '#2c3e50';
  } else {
    output.textContent = `錯誤: ${result.error}`;
    output.style.color = '#e74c3c';
  }
}

function minifyJSON() {
  const input = document.getElementById('formatterInput').value;
  const output = document.getElementById('formatterOutput');

  if (!input.trim()) {
    output.textContent = '請輸入要壓縮的 JSON';
    return;
  }

  const formatter = new Formatter();
  const result = formatter.minifyJSON(input);

  if (result.success) {
    output.textContent = result.minified;
    output.style.color = '#2c3e50';
  } else {
    output.textContent = `錯誤: ${result.error}`;
    output.style.color = '#e74c3c';
  }
}

function copyFormattedText() {
  const output = document.getElementById('formatterOutput');
  const text = output.textContent;

  if (!text || text.includes('錯誤') || text.includes('請輸入')) {
    alert('沒有可複製的內容');
    return;
  }

  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('copyFormattedBtn');
    const originalText = btn.textContent;
    btn.textContent = '✓ 已複製';
    setTimeout(() => {
      btn.textContent = originalText;
    }, 2000);
  });
}

function generateQRCode() {
  const input = document.getElementById('qrcodeInput').value.trim();
  const output = document.getElementById('qrcodeOutput');

  if (!input) {
    output.innerHTML = '<div style="color: #95a5a6;">請輸入文字或網址</div>';
    return;
  }

  const generator = new QRCodeGenerator();
  const url = generator.generateQRCodeUrl(input, 256);
  
  output.innerHTML = `<img src="${url}" alt="QR Code">`;
  currentQRDataUrl = url;
  document.getElementById('downloadQRBtn').classList.remove('hidden');
}

async function generatePageQR() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs[0]) return;

  const output = document.getElementById('qrcodeOutput');
  const generator = new QRCodeGenerator();
  const url = generator.generateQRCodeUrl(tabs[0].url, 256);
  
  output.innerHTML = `<img src="${url}" alt="QR Code">`;
  currentQRDataUrl = url;
  document.getElementById('downloadQRBtn').classList.remove('hidden');
  document.getElementById('qrcodeInput').value = tabs[0].url;
}

function downloadQR() {
  if (!currentQRDataUrl) {
    alert('請先生成 QR Code');
    return;
  }

  const link = document.createElement('a');
  link.href = currentQRDataUrl;
  link.download = 'qrcode.png';
  link.click();
}


