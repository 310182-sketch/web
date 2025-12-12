// Highlighter - 網頁劃重點功能
class Highlighter {
  constructor() {
    this.highlights = new Map();
    this.toolbar = null;
    this.colors = {
      yellow: { bg: '#ffeb3b', border: '#fbc02d' },
      green: { bg: '#a5d6a7', border: '#66bb6a' },
      blue: { bg: '#90caf9', border: '#42a5f5' },
      pink: { bg: '#f48fb1', border: '#ec407a' },
      purple: { bg: '#ce93d8', border: '#ab47bc' }
    };
  }

  async init() {
    await this.loadHighlights();
    this.renderAllHighlights();
    this.setupListeners();
  }

  setupListeners() {
    document.addEventListener('mouseup', (e) => this.handleSelection(e));
    document.addEventListener('mousedown', (e) => {
      if (this.toolbar && !this.toolbar.contains(e.target)) {
        this.hideToolbar();
      }
    });
  }

  handleSelection(e) {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    
    if (text.length > 0 && text.length < 5000) {
      this.showToolbar(selection, e);
    } else {
      this.hideToolbar();
    }
  }

  showToolbar(selection, event) {
    this.hideToolbar();
    
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    this.toolbar = document.createElement('div');
    this.toolbar.className = 'bb-highlight-toolbar';
    this.toolbar.innerHTML = `
      <button class="bb-hl-btn" data-color="yellow" style="background: #ffeb3b" title="黃色">●</button>
      <button class="bb-hl-btn" data-color="green" style="background: #a5d6a7" title="綠色">●</button>
      <button class="bb-hl-btn" data-color="blue" style="background: #90caf9" title="藍色">●</button>
      <button class="bb-hl-btn" data-color="pink" style="background: #f48fb1" title="粉色">●</button>
      <button class="bb-hl-btn" data-color="purple" style="background: #ce93d8" title="紫色">●</button>
      <button class="bb-hl-note-btn" title="新增註解">💬</button>
    `;
    
    this.toolbar.style.position = 'absolute';
    this.toolbar.style.left = `${rect.left + window.scrollX}px`;
    this.toolbar.style.top = `${rect.top + window.scrollY - 45}px`;
    this.toolbar.style.zIndex = '10000';
    
    document.body.appendChild(this.toolbar);
    
    this.toolbar.querySelectorAll('.bb-hl-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.highlightSelection(btn.dataset.color);
      });
    });
    
    this.toolbar.querySelector('.bb-hl-note-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.addNoteToHighlight();
    });
  }

  hideToolbar() {
    if (this.toolbar) {
      this.toolbar.remove();
      this.toolbar = null;
    }
  }

  highlightSelection(color = 'yellow') {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const text = range.toString().trim();
    if (!text) return;

    const highlightData = {
      id: crypto.randomUUID(),
      url: this.normalizeUrl(window.location.href),
      color: color,
      text: text,
      context: this.getContext(range),
      rangeData: this.serializeRange(range),
      note: '',
      created: Date.now()
    };

    this.saveHighlight(highlightData);
    this.renderHighlight(highlightData);
    this.hideToolbar();
    
    selection.removeAllRanges();
    
    // 通知側邊欄更新
    window.postMessage({ type: 'BB_HIGHLIGHT_ADDED', data: highlightData }, '*');
  }

  addNoteToHighlight() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const note = prompt('請輸入註解:');
    if (note === null) return;

    const range = selection.getRangeAt(0);
    const text = range.toString().trim();
    
    const highlightData = {
      id: crypto.randomUUID(),
      url: this.normalizeUrl(window.location.href),
      color: 'yellow',
      text: text,
      context: this.getContext(range),
      rangeData: this.serializeRange(range),
      note: note,
      created: Date.now()
    };

    this.saveHighlight(highlightData);
    this.renderHighlight(highlightData);
    this.hideToolbar();
    
    selection.removeAllRanges();
    
    window.postMessage({ type: 'BB_HIGHLIGHT_ADDED', data: highlightData }, '*');
  }

  serializeRange(range) {
    return {
      startContainer: this.getXPath(range.startContainer),
      startOffset: range.startOffset,
      endContainer: this.getXPath(range.endContainer),
      endOffset: range.endOffset
    };
  }

  getXPath(node) {
    if (node.nodeType === Node.DOCUMENT_NODE) return '/';
    
    const parts = [];
    while (node && node.nodeType === Node.ELEMENT_NODE) {
      let index = 0;
      let sibling = node.previousSibling;
      while (sibling) {
        if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === node.nodeName) {
          index++;
        }
        sibling = sibling.previousSibling;
      }
      
      const tagName = node.nodeName.toLowerCase();
      const pathIndex = index > 0 ? `[${index + 1}]` : '';
      parts.unshift(tagName + pathIndex);
      node = node.parentNode;
    }
    
    return parts.length ? '/' + parts.join('/') : null;
  }

  getContext(range) {
    const containerText = range.commonAncestorContainer.textContent || '';
    const selectedText = range.toString();
    const startIndex = containerText.indexOf(selectedText);
    
    return {
      prefix: containerText.substring(Math.max(0, startIndex - 50), startIndex),
      suffix: containerText.substring(startIndex + selectedText.length, startIndex + selectedText.length + 50)
    };
  }

  async saveHighlight(highlightData) {
    const result = await chrome.storage.local.get(['highlights']);
    const highlights = result.highlights || {};
    
    if (!highlights[highlightData.url]) {
      highlights[highlightData.url] = [];
    }
    
    highlights[highlightData.url].push(highlightData);
    await chrome.storage.local.set({ highlights });
    
    this.highlights.set(highlightData.id, highlightData);
  }

  async loadHighlights() {
    const currentUrl = this.normalizeUrl(window.location.href);
    const result = await chrome.storage.local.get(['highlights']);
    const highlights = result.highlights || {};
    
    const pageHighlights = highlights[currentUrl] || [];
    pageHighlights.forEach(hl => this.highlights.set(hl.id, hl));
  }

  renderAllHighlights() {
    this.highlights.forEach(hl => this.renderHighlight(hl));
  }

  renderHighlight(highlightData) {
    try {
      const range = this.deserializeRange(highlightData.rangeData);
      if (!range) return;

      const mark = document.createElement('mark');
      mark.className = 'bb-highlight';
      mark.dataset.highlightId = highlightData.id;
      mark.style.backgroundColor = this.colors[highlightData.color].bg;
      mark.style.borderBottom = `2px solid ${this.colors[highlightData.color].border}`;
      mark.style.cursor = 'pointer';
      mark.style.padding = '2px 0';
      
      if (highlightData.note) {
        mark.classList.add('bb-highlight-with-note');
        mark.title = highlightData.note;
      }

      range.surroundContents(mark);
      
      mark.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showHighlightMenu(highlightData, mark);
      });
    } catch (e) {
      console.warn('Failed to render highlight:', e);
    }
  }

  deserializeRange(rangeData) {
    try {
      const startNode = this.getNodeByXPath(rangeData.startContainer);
      const endNode = this.getNodeByXPath(rangeData.endContainer);
      
      if (!startNode || !endNode) return null;
      
      const range = document.createRange();
      range.setStart(startNode, rangeData.startOffset);
      range.setEnd(endNode, rangeData.endOffset);
      
      return range;
    } catch (e) {
      return null;
    }
  }

  getNodeByXPath(xpath) {
    if (!xpath) return null;
    const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    return result.singleNodeValue;
  }

  showHighlightMenu(highlightData, element) {
    const menu = document.createElement('div');
    menu.className = 'bb-highlight-menu';
    menu.innerHTML = `
      <button class="bb-menu-btn" data-action="edit">✏️ 編輯註解</button>
      <button class="bb-menu-btn" data-action="delete">🗑️ 刪除</button>
    `;
    
    const rect = element.getBoundingClientRect();
    menu.style.position = 'absolute';
    menu.style.left = `${rect.left + window.scrollX}px`;
    menu.style.top = `${rect.bottom + window.scrollY + 5}px`;
    menu.style.zIndex = '10001';
    
    document.body.appendChild(menu);
    
    menu.querySelector('[data-action="edit"]').addEventListener('click', () => {
      const newNote = prompt('編輯註解:', highlightData.note);
      if (newNote !== null) {
        this.updateHighlightNote(highlightData.id, newNote);
      }
      menu.remove();
    });
    
    menu.querySelector('[data-action="delete"]').addEventListener('click', () => {
      this.deleteHighlight(highlightData.id);
      menu.remove();
    });
    
    setTimeout(() => {
      document.addEventListener('click', () => menu.remove(), { once: true });
    }, 100);
  }

  async updateHighlightNote(id, note) {
    const highlightData = this.highlights.get(id);
    if (!highlightData) return;
    
    highlightData.note = note;
    
    const result = await chrome.storage.local.get(['highlights']);
    const highlights = result.highlights || {};
    const pageHighlights = highlights[highlightData.url] || [];
    
    const index = pageHighlights.findIndex(hl => hl.id === id);
    if (index !== -1) {
      pageHighlights[index].note = note;
      await chrome.storage.local.set({ highlights });
    }
    
    // 更新顯示
    const mark = document.querySelector(`[data-highlight-id="${id}"]`);
    if (mark) {
      mark.title = note;
      if (note) {
        mark.classList.add('bb-highlight-with-note');
      } else {
        mark.classList.remove('bb-highlight-with-note');
      }
    }
    
    window.postMessage({ type: 'BB_HIGHLIGHT_UPDATED', data: highlightData }, '*');
  }

  async deleteHighlight(id) {
    const highlightData = this.highlights.get(id);
    if (!highlightData) return;
    
    const result = await chrome.storage.local.get(['highlights']);
    const highlights = result.highlights || {};
    const pageHighlights = highlights[highlightData.url] || [];
    
    highlights[highlightData.url] = pageHighlights.filter(hl => hl.id !== id);
    await chrome.storage.local.set({ highlights });
    
    this.highlights.delete(id);
    
    const mark = document.querySelector(`[data-highlight-id="${id}"]`);
    if (mark) {
      const parent = mark.parentNode;
      while (mark.firstChild) {
        parent.insertBefore(mark.firstChild, mark);
      }
      mark.remove();
    }
    
    window.postMessage({ type: 'BB_HIGHLIGHT_DELETED', id }, '*');
  }

  normalizeUrl(url) {
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
    } catch (e) {
      return url;
    }
  }

  async getAllHighlights() {
    const currentUrl = this.normalizeUrl(window.location.href);
    const result = await chrome.storage.local.get(['highlights']);
    const highlights = result.highlights || {};
    return highlights[currentUrl] || [];
  }
}

// 初始化
if (typeof window !== 'undefined') {
  window.bbHighlighter = new Highlighter();
  window.bbHighlighter.init();
}
