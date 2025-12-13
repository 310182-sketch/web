// Extensions Manager - 快速啟用/禁用擴充功能（需 management 權限）

class ExtensionsManager {
  constructor() {
    this.cache = [];
    this.favorites = new Set();
  }

  async init() {
    await this.refresh();
    const fav = await chrome.storage.sync.get(['bb_ext_favorites']);
    if (Array.isArray(fav.bb_ext_favorites)) {
      this.favorites = new Set(fav.bb_ext_favorites);
    }
  }

  async refresh() {
    try {
      this.cache = await chrome.management.getAll();
      return this.cache;
    } catch (e) {
      this.cache = [];
      return [];
    }
  }

  list(filter = '') {
    const q = (filter || '').toLowerCase();
    return this.cache
      .filter(ext => ext.type === 'extension')
      .filter(ext => !q || ext.name.toLowerCase().includes(q) || ext.id.includes(q));
  }

  async setEnabled(id, enabled) {
    try {
      await chrome.management.setEnabled(id, enabled);
      await this.refresh();
      return true;
    } catch (e) {
      return false;
    }
  }

  async toggle(id) {
    const ext = this.cache.find(e => e.id === id);
    if (!ext) return false;
    return await this.setEnabled(id, !ext.enabled);
  }

  async addFavorite(id) {
    this.favorites.add(id);
    await chrome.storage.sync.set({ bb_ext_favorites: Array.from(this.favorites) });
    return true;
  }

  async removeFavorite(id) {
    this.favorites.delete(id);
    await chrome.storage.sync.set({ bb_ext_favorites: Array.from(this.favorites) });
    return true;
  }

  isFavorite(id) {
    return this.favorites.has(id);
  }
}

// Sidepanel 環境使用
