// Better Browse - Background Service Worker (v2.8 scaffolding)

// State
const state = {
  lastActiveTabTimes: {}, // {tabId: timestamp}
  suspendThresholdMinutes: 20, // default threshold
  whitelistHosts: new Set(), // hosts never suspended
};

// Utils
function now() {
  return Date.now();
}

function minutes(ms) {
  return Math.floor(ms / 60000);
}

function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return '';
  }
}

// Persist settings in storage
async function loadSettings() {
  const result = await chrome.storage.sync.get([
    'bb_suspendThresholdMinutes',
    'bb_suspendWhitelist',
  ]);
  if (typeof result.bb_suspendThresholdMinutes === 'number') {
    state.suspendThresholdMinutes = result.bb_suspendThresholdMinutes;
  }
  if (Array.isArray(result.bb_suspendWhitelist)) {
    state.whitelistHosts = new Set(result.bb_suspendWhitelist);
  }
}

async function saveSettings() {
  await chrome.storage.sync.set({
    bb_suspendThresholdMinutes: state.suspendThresholdMinutes,
    bb_suspendWhitelist: Array.from(state.whitelistHosts),
  });
}

// Track tab activity
async function markTabActive(tabId) {
  state.lastActiveTabTimes[tabId] = now();
}

async function removeTabTracking(tabId) {
  delete state.lastActiveTabTimes[tabId];
}

// Suspending logic
async function maybeSuspendStaleTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    const thresholdMs = state.suspendThresholdMinutes * 60 * 1000;

    for (const tab of tabs) {
      if (!tab.id || tab.active || tab.pinned) continue;
      const host = getHostname(tab.url || '');
      if (state.whitelistHosts.has(host)) continue;

      const lastActive = state.lastActiveTabTimes[tab.id] || tab.lastAccessed || 0;
      if (!lastActive) continue;

      const idleMs = now() - lastActive;
      if (idleMs >= thresholdMs) {
        // Use tabs.discard to suspend the tab (MV3 compatible)
        try {
          await chrome.tabs.discard(tab.id);
        } catch (e) {
          // swallow per-tab errors
        }
      }
    }
  } catch (e) {
    // swallow top-level errors
  }
}

// Alarms: periodic check for suspension
async function setupAlarms() {
  try {
    await chrome.alarms.clear('bb_suspender_tick');
    chrome.alarms.create('bb_suspender_tick', { periodInMinutes: 1 });
  } catch (e) {
    // ignore
  }
}

// Runtime message routing
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      switch (msg?.type) {
        case 'BB_SET_SUSPEND_THRESHOLD': {
          const value = Number(msg.minutes);
          if (!Number.isNaN(value) && value > 0) {
            state.suspendThresholdMinutes = value;
            await saveSettings();
            await setupAlarms();
            sendResponse({ ok: true });
          } else {
            sendResponse({ ok: false, error: 'invalid_threshold' });
          }
          break;
        }
        case 'BB_ADD_WHITELIST_HOST': {
          const host = String(msg.host || '').trim();
          if (host) {
            state.whitelistHosts.add(host);
            await saveSettings();
            sendResponse({ ok: true });
          } else {
            sendResponse({ ok: false, error: 'invalid_host' });
          }
          break;
        }
        case 'BB_REMOVE_WHITELIST_HOST': {
          const host = String(msg.host || '').trim();
          if (host) {
            state.whitelistHosts.delete(host);
            await saveSettings();
            sendResponse({ ok: true });
          } else {
            sendResponse({ ok: false, error: 'invalid_host' });
          }
          break;
        }
        case 'BB_GET_SUSPENDER_STATE': {
          sendResponse({
            ok: true,
            suspendThresholdMinutes: state.suspendThresholdMinutes,
            whitelistHosts: Array.from(state.whitelistHosts),
          });
          break;
        }
        case 'BB_MANUAL_SUSPEND_TAB': {
          const tabId = Number(msg.tabId);
          if (Number.isInteger(tabId)) {
            try {
              await chrome.tabs.discard(tabId);
              sendResponse({ ok: true });
            } catch (e) {
              sendResponse({ ok: false, error: String(e?.message || e) });
            }
          } else {
            sendResponse({ ok: false, error: 'invalid_tabId' });
          }
          break;
        }
        case 'BB_MARK_TAB_ACTIVE': {
          const tabId = Number(msg.tabId);
          if (Number.isInteger(tabId)) {
            await markTabActive(tabId);
            sendResponse({ ok: true });
          } else {
            sendResponse({ ok: false, error: 'invalid_tabId' });
          }
          break;
        }
        default:
          // no-op
          break;
      }
    } catch (e) {
      sendResponse({ ok: false, error: String(e?.message || e) });
    }
  })();
  // keep the message channel open for async
  return true;
});

// Tabs lifecycle
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await markTabActive(activeInfo.tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    await markTabActive(tabId);
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await removeTabTracking(tabId);
});

// Windows focus changes may imply activity
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  try {
    if (windowId === chrome.windows.WINDOW_ID_NONE) return;
    const tabs = await chrome.tabs.query({ active: true, windowId });
    if (tabs[0]?.id) await markTabActive(tabs[0].id);
  } catch (e) {
    // ignore
  }
});

// Alarms tick handler
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'bb_suspender_tick') {
    await maybeSuspendStaleTabs();
  }
});

// Idle API can be leveraged to pause/resume checks
chrome.idle.onStateChanged.addListener(async (newState) => {
  if (newState === 'active') {
    await setupAlarms();
  }
});

// Init on installation/update and startup
chrome.runtime.onInstalled.addListener(async () => {
  await loadSettings();
  await setupAlarms();
});

chrome.runtime.onStartup.addListener(async () => {
  await loadSettings();
  await setupAlarms();
});
