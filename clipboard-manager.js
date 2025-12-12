// Clipboard Manager - 進階剪貼簿歷史
class ClipboardManager {
  constructor() {
    this.maxItems = 50; // 最多儲存 50 條記錄
    this.maxLength = 10000; // 單條記錄最大字數
  }

  async init() {
    this.setupListeners();
  }

  setupListeners() {
    // 監聽複製事件
    document.addEventListener('copy', (e) => this.handleCopy(e));
    
    // 監聽剪下事件
    document.addEventListener('cut', (e) => this.handleCopy(e));
  }

  async handleCopy(e) {
    try {
      // 獲取複製的文字
      const selection = window.getSelection();
      const text = selection.toString().trim();
      
      if (!text || text.length === 0) return;
      
      // 限制長度
      const truncatedText = text.length > this.maxLength 
        ? text.substring(0, this.maxLength) + '...' 
        : text;

      const clipboardItem = {
        id: crypto.randomUUID(),
        text: truncatedText,
        source: {
          url: window.location.href,
          title: document.title,
          hostname: window.location.hostname
        },
        timestamp: Date.now(),
        type: 'text'
      };

      await this.saveToHistory(clipboardItem);
    } catch (error) {
      console.warn('Failed to save clipboard item:', error);
    }
  }

  async saveToHistory(item) {
    const result = await chrome.storage.local.get(['clipboardHistory']);
    let history = result.clipboardHistory || [];

    // 避免重複（如果最新的一條就是這個內容，不再保存）
    if (history.length > 0 && history[0].text === item.text) {
      return;
    }

    // 添加到歷史記錄開頭
    history.unshift(item);

    // 限制數量
    if (history.length > this.maxItems) {
      history = history.slice(0, this.maxItems);
    }

    await chrome.storage.local.set({ clipboardHistory: history });
    
    // 通知側邊欄更新
    window.postMessage({ type: 'BB_CLIPBOARD_UPDATED' }, '*');
  }

  async getHistory() {
    const result = await chrome.storage.local.get(['clipboardHistory']);
    return result.clipboardHistory || [];
  }

  async deleteItem(id) {
    const result = await chrome.storage.local.get(['clipboardHistory']);
    let history = result.clipboardHistory || [];
    
    history = history.filter(item => item.id !== id);
    
    await chrome.storage.local.set({ clipboardHistory: history });
    
    window.postMessage({ type: 'BB_CLIPBOARD_UPDATED' }, '*');
  }

  async clearHistory() {
    await chrome.storage.local.set({ clipboardHistory: [] });
    window.postMessage({ type: 'BB_CLIPBOARD_UPDATED' }, '*');
  }

  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      // Fallback 方法
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      
      return success;
    }
  }
}

// 初始化
if (typeof window !== 'undefined') {
  window.bbClipboard = new ClipboardManager();
  window.bbClipboard.init();
}
