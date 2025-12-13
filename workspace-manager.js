// Workspace Manager - 工作區管理
class WorkspaceManager {
  constructor() {
    this.maxWorkspaces = 20;
  }

  async init() {
    // 初始化
  }

  // 獲取所有工作區
  async getAllWorkspaces() {
    const result = await chrome.storage.local.get(['workspaces']);
    return result.workspaces || [];
  }

  // 保存當前視窗為工作區
  async saveCurrentWorkspace(name, description = '') {
    try {
      // 獲取當前視窗的所有分頁
      const tabs = await chrome.tabs.query({ currentWindow: true });
      
      const tabsData = tabs.map(tab => ({
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl,
        pinned: tab.pinned
      }));

      const workspace = {
        id: crypto.randomUUID(),
        name: name,
        description: description,
        tabs: tabsData,
        tabCount: tabsData.length,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const workspaces = await this.getAllWorkspaces();
      workspaces.unshift(workspace);

      // 限制數量
      if (workspaces.length > this.maxWorkspaces) {
        workspaces.pop();
      }

      await chrome.storage.local.set({ workspaces });
      this.notifyUpdate();
      
      return workspace;
    } catch (error) {
      console.error('Failed to save workspace:', error);
      return null;
    }
  }

  // 恢復工作區
  async restoreWorkspace(id, inNewWindow = false) {
    const workspaces = await this.getAllWorkspaces();
    const workspace = workspaces.find(w => w.id === id);
    
    if (!workspace) return false;

    try {
      if (inNewWindow) {
        // 在新視窗中打開
        const urls = workspace.tabs.map(tab => tab.url);
        await chrome.windows.create({ url: urls[0] });
        
        // 等待視窗創建後打開其餘分頁
        const windows = await chrome.windows.getAll();
        const newWindow = windows[windows.length - 1];
        
        for (let i = 1; i < urls.length; i++) {
          await chrome.tabs.create({
            windowId: newWindow.id,
            url: urls[i],
            pinned: workspace.tabs[i].pinned
          });
        }
      } else {
        // 在當前視窗中打開
        for (const tabData of workspace.tabs) {
          await chrome.tabs.create({
            url: tabData.url,
            pinned: tabData.pinned
          });
        }
      }
      
      return true;
    } catch (error) {
      console.error('Failed to restore workspace:', error);
      return false;
    }
  }

  // 更新工作區
  async updateWorkspace(id, updates) {
    const workspaces = await this.getAllWorkspaces();
    const index = workspaces.findIndex(w => w.id === id);
    
    if (index === -1) return null;

    workspaces[index] = {
      ...workspaces[index],
      ...updates,
      updatedAt: Date.now()
    };

    await chrome.storage.local.set({ workspaces });
    this.notifyUpdate();
    
    return workspaces[index];
  }

  // 刪除工作區
  async deleteWorkspace(id) {
    const workspaces = await this.getAllWorkspaces();
    const filtered = workspaces.filter(w => w.id !== id);
    
    await chrome.storage.local.set({ workspaces: filtered });
    this.notifyUpdate();
    
    return true;
  }

  // 重新保存工作區（更新分頁）
  async refreshWorkspace(id) {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    
    const tabsData = tabs.map(tab => ({
      url: tab.url,
      title: tab.title,
      favIconUrl: tab.favIconUrl,
      pinned: tab.pinned
    }));

    return await this.updateWorkspace(id, {
      tabs: tabsData,
      tabCount: tabsData.length
    });
  }

  // 獲取當前視窗的分頁資訊
  async getCurrentWindowInfo() {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    
    return {
      tabCount: tabs.length,
      tabs: tabs.map(tab => ({
        id: tab.id,
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl,
        pinned: tab.pinned,
        active: tab.active
      }))
    };
  }

  // 關閉當前視窗的所有分頁（除了當前）
  async closeOtherTabs() {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const currentTab = tabs.find(tab => tab.active);
    
    const tabsToClose = tabs
      .filter(tab => tab.id !== currentTab.id && !tab.pinned)
      .map(tab => tab.id);
    
    if (tabsToClose.length > 0) {
      await chrome.tabs.remove(tabsToClose);
    }
    
    return tabsToClose.length;
  }

  // 搜尋工作區
  async searchWorkspaces(query) {
    const workspaces = await this.getAllWorkspaces();
    const lowerQuery = query.toLowerCase();
    
    return workspaces.filter(workspace => 
      workspace.name.toLowerCase().includes(lowerQuery) ||
      workspace.description.toLowerCase().includes(lowerQuery) ||
      workspace.tabs.some(tab => 
        tab.title.toLowerCase().includes(lowerQuery) ||
        tab.url.toLowerCase().includes(lowerQuery)
      )
    );
  }

  // 匯出工作區
  async exportWorkspaces() {
    const workspaces = await this.getAllWorkspaces();
    const dataStr = JSON.stringify(workspaces, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `workspaces-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
  }

  // 匯入工作區
  async importWorkspaces(jsonData) {
    try {
      const imported = JSON.parse(jsonData);
      const workspaces = await this.getAllWorkspaces();
      
      // 合併匯入的工作區
      const merged = [...imported, ...workspaces];
      
      // 限制數量
      const limited = merged.slice(0, this.maxWorkspaces);
      
      await chrome.storage.local.set({ workspaces: limited });
      this.notifyUpdate();
      
      return {
        success: true,
        imported: imported.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 格式化時間
  formatTime(timestamp) {
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

  // 通知更新
  notifyUpdate() {
    window.postMessage({ type: 'BB_WORKSPACE_UPDATED' }, '*');
  }

  // ===== Tab Groups 功能 =====
  // 建立群組（將當前視窗的所有分頁或指定分頁加入群組）
  async createTabGroup(options = {}) {
    const { title = '工作群組', color = 'blue', collapsed = false, tabIds = null } = options;
    const tabs = tabIds ? tabIds.map(id => ({ id })) : await chrome.tabs.query({ currentWindow: true });
    const ids = tabIds ? tabIds : tabs.map(t => t.id).filter(Boolean);
    if (!ids || ids.length === 0) return null;

    try {
      const groupId = await chrome.tabs.group({ tabIds: ids });
      await chrome.tabGroups.update(groupId, { title, color, collapsed });
      return groupId;
    } catch (e) {
      console.error('Failed to create tab group:', e);
      return null;
    }
  }

  // 更新群組屬性
  async updateTabGroup(groupId, updates = {}) {
    try {
      await chrome.tabGroups.update(groupId, updates);
      return true;
    } catch (e) {
      console.error('Failed to update tab group:', e);
      return false;
    }
  }

  // 列出目前視窗所有群組
  async listTabGroups() {
    try {
      const groups = await chrome.tabGroups.query({});
      return groups;
    } catch (e) {
      return [];
    }
  }

  // 將選定分頁加入指定群組
  async addTabsToGroup(groupId, tabIds) {
    try {
      await chrome.tabs.group({ groupId, tabIds });
      return true;
    } catch (e) {
      return false;
    }
  }
}

// Sidepanel 環境中使用，無需 window 初始化
