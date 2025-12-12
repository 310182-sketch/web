// Notes Manager - 筆記資料管理模組
const NotesManager = {
  // 取得當前頁面的筆記
  async getCurrentNote(url) {
    const key = this.normalizeUrl(url);
    const result = await chrome.storage.local.get(['notes']);
    const notes = result.notes || {};
    return notes[key] || null;
  },

  // 儲存筆記
  async saveNote(url, content) {
    const key = this.normalizeUrl(url);
    const result = await chrome.storage.local.get(['notes']);
    const notes = result.notes || {};
    
    const timestamp = Date.now();
    notes[key] = {
      url: url,
      content: content,
      created: notes[key]?.created || timestamp,
      updated: timestamp,
      wordCount: this.countWords(content)
    };

    await chrome.storage.local.set({ notes });
    return notes[key];
  },

  // 刪除筆記
  async deleteNote(url) {
    const key = this.normalizeUrl(url);
    const result = await chrome.storage.local.get(['notes']);
    const notes = result.notes || {};
    
    delete notes[key];
    await chrome.storage.local.set({ notes });
  },

  // 取得所有筆記
  async getAllNotes() {
    const result = await chrome.storage.local.get(['notes']);
    const notes = result.notes || {};
    
    return Object.values(notes).sort((a, b) => b.updated - a.updated);
  },

  // 搜尋筆記
  async searchNotes(query) {
    const allNotes = await this.getAllNotes();
    if (!query.trim()) return allNotes;
    
    const lowerQuery = query.toLowerCase();
    return allNotes.filter(note => 
      note.content.toLowerCase().includes(lowerQuery) ||
      note.url.toLowerCase().includes(lowerQuery)
    );
  },

  // 匯出所有筆記為 JSON
  async exportNotes() {
    const allNotes = await this.getAllNotes();
    const dataStr = JSON.stringify(allNotes, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `better-browse-notes-${Date.now()}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
  },

  // 正規化 URL (移除 hash 和 query params)
  normalizeUrl(url) {
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
    } catch (e) {
      return url;
    }
  },

  // 計算字數
  countWords(text) {
    return text.trim().length;
  },

  // 格式化時間
  formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return '剛剛';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分鐘前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小時前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
    
    return date.toLocaleDateString('zh-TW');
  }
};

// 如果在瀏覽器環境中，將其暴露為全域變數
if (typeof window !== 'undefined') {
  window.NotesManager = NotesManager;
}
