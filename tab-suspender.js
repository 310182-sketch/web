// Tab Suspender - 側邊欄控制模組（與 background 溝通）

class TabSuspender {
  constructor() {
    this.thresholdOptions = [10, 20, 30, 45, 60];
    this.state = {
      suspendThresholdMinutes: 20,
      whitelistHosts: [],
    };
  }

  async init() {
    await this.refreshState();
  }

  async refreshState() {
    const res = await this.sendMessage({ type: 'BB_GET_SUSPENDER_STATE' });
    if (res?.ok) {
      this.state.suspendThresholdMinutes = res.suspendThresholdMinutes;
      this.state.whitelistHosts = res.whitelistHosts || [];
    }
    return this.state;
  }

  async setThreshold(minutes) {
    const res = await this.sendMessage({ type: 'BB_SET_SUSPEND_THRESHOLD', minutes });
    if (res?.ok) {
      this.state.suspendThresholdMinutes = minutes;
      return true;
    }
    return false;
  }

  async addWhitelistHost(host) {
    const res = await this.sendMessage({ type: 'BB_ADD_WHITELIST_HOST', host });
    if (res?.ok) {
      await this.refreshState();
      return true;
    }
    return false;
  }

  async removeWhitelistHost(host) {
    const res = await this.sendMessage({ type: 'BB_REMOVE_WHITELIST_HOST', host });
    if (res?.ok) {
      await this.refreshState();
      return true;
    }
    return false;
  }

  async manualSuspend(tabId) {
    const res = await this.sendMessage({ type: 'BB_MANUAL_SUSPEND_TAB', tabId });
    return !!res?.ok;
  }

  async markActive(tabId) {
    const res = await this.sendMessage({ type: 'BB_MARK_TAB_ACTIVE', tabId });
    return !!res?.ok;
  }

  async sendMessage(payload) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(payload, resolve);
      } catch (e) {
        resolve({ ok: false, error: String(e?.message || e) });
      }
    });
  }
}

// Sidepanel 環境使用：由 sidepanel.js 建立並呼叫
