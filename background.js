// Track tab count and extension state
let tabCount = 0;
let isEnabled = true;
let randomChance = 250; // 1/250 chance by default
let mode = 'roll'; // 'roll', 'interval', 'roulette'
let intervalValue = 50; // Default interval
let rouletteProgress = 0; // Current progress in roulette mode
let rouletteTarget = 0; // Target for roulette mode
let rickrollCount = 0; // Number of times rickroll has occurred
let intervalProgressVisible = true; // Show interval progress bar in popup
let chanceManualEnabled = false;
let intervalManualEnabled = false;
let rouletteManualEnabled = false;
let accent1 = undefined;
let accent2 = undefined;

// Config and update metadata
let configJson = null; // Persisted combined config/stats JSON
let remoteConfigUrl = 'https://raw.githubusercontent.com/GXboy12345/5rick/main/config.json';
let lastConfigCheck = 0;

// Initialize from storage
chrome.storage.local.get(['tabCount', 'isEnabled', 'randomChance', 'mode', 'intervalValue', 'rouletteProgress', 'rouletteTarget', 'rickrollCount', 'intervalProgressVisible', 'chanceManualEnabled', 'intervalManualEnabled', 'rouletteManualEnabled', 'accent1', 'accent2', 'configJson', 'remoteConfigUrl', 'lastConfigCheck'], (result) => {
  tabCount = result.tabCount || 0;
  isEnabled = result.isEnabled !== undefined ? result.isEnabled : true;
  randomChance = result.randomChance || 250;
  mode = result.mode || 'roll';
  intervalValue = result.intervalValue || 50;
  rouletteProgress = result.rouletteProgress || 0;
  rouletteTarget = result.rouletteTarget || 0;
  rickrollCount = result.rickrollCount || 0;
  intervalProgressVisible = result.intervalProgressVisible !== false;
  chanceManualEnabled = !!result.chanceManualEnabled;
  intervalManualEnabled = !!result.intervalManualEnabled;
  rouletteManualEnabled = !!result.rouletteManualEnabled;
  accent1 = result.accent1;
  accent2 = result.accent2;
  configJson = result.configJson || null;
  if (typeof result.remoteConfigUrl === 'string' && result.remoteConfigUrl.trim().length > 0) {
    remoteConfigUrl = result.remoteConfigUrl.trim();
  }
  lastConfigCheck = result.lastConfigCheck || 0;
  
  // Initialize roulette target if not set
  if (mode === 'roulette' && rouletteTarget === 0) {
    rouletteTarget = Math.floor(Math.random() * intervalValue) + 1;
    chrome.storage.local.set({ rouletteTarget });
  }

  updateBadge();

  // Initialize config JSON if missing, else apply persisted settings
  if (configJson) {
    try {
      applyConfigJson(configJson, { save: false });
    } catch (e) {
      console.warn('Failed to apply stored configJson:', e);
    }
  } else {
    saveConfigJson();
  }
});

// Build combined config/stats JSON
function buildConfigJson() {
  const manifest = chrome.runtime.getManifest();
  const extensionVersion = manifest && manifest.version ? manifest.version : '1.0.0';
  return {
    version: extensionVersion,
    updatedAt: Date.now(),
    settings: {
      isEnabled,
      randomChance,
      mode,
      intervalValue,
      intervalProgressVisible,
      chanceManualEnabled,
      intervalManualEnabled,
      rouletteManualEnabled,
      accent1,
      accent2
    },
    stats: {
      tabCount,
      rouletteProgress,
      rouletteTarget,
      rickrollCount
    }
  };
}

function saveConfigJson() {
  configJson = buildConfigJson();
  chrome.storage.local.set({ configJson });
}

// Apply config JSON to in-memory state and storage
function applyConfigJson(json, opts) {
  const options = opts || { save: true };
  try {
    if (json && json.settings) {
      const s = json.settings;
      if (typeof s.isEnabled === 'boolean') isEnabled = s.isEnabled;
      if (Number.isInteger(s.randomChance)) randomChance = s.randomChance;
      if (typeof s.mode === 'string') mode = s.mode;
      if (Number.isInteger(s.intervalValue)) intervalValue = s.intervalValue;
      if (typeof s.intervalProgressVisible === 'boolean') intervalProgressVisible = s.intervalProgressVisible;
      if (typeof s.chanceManualEnabled === 'boolean') chanceManualEnabled = s.chanceManualEnabled;
      if (typeof s.intervalManualEnabled === 'boolean') intervalManualEnabled = s.intervalManualEnabled;
      if (typeof s.rouletteManualEnabled === 'boolean') rouletteManualEnabled = s.rouletteManualEnabled;
      if (typeof s.accent1 === 'string') accent1 = s.accent1;
      if (typeof s.accent2 === 'string') accent2 = s.accent2;
    }
    if (json && json.stats) {
      const st = json.stats;
      if (Number.isInteger(st.tabCount)) tabCount = st.tabCount;
      if (Number.isInteger(st.rouletteProgress)) rouletteProgress = st.rouletteProgress;
      if (Number.isInteger(st.rouletteTarget)) rouletteTarget = st.rouletteTarget;
      if (Number.isInteger(st.rickrollCount)) rickrollCount = st.rickrollCount;
    }
    if (options.save) {
      chrome.storage.local.set({
        isEnabled,
        randomChance,
        mode,
        intervalValue,
        intervalProgressVisible,
        chanceManualEnabled,
        intervalManualEnabled,
        rouletteManualEnabled,
        accent1,
        accent2,
        tabCount,
        rouletteProgress,
        rouletteTarget,
        rickrollCount
      });
      saveConfigJson();
      updateBadge();
    }
  } catch (e) {
    console.warn('applyConfigJson error:', e);
  }
}

function compareVersions(a, b) {
  const pa = String(a || '').split('.').map(n => parseInt(n) || 0);
  const pb = String(b || '').split('.').map(n => parseInt(n) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

async function checkForRemoteConfigUpdates() {
  try {
    const resp = await fetch(remoteConfigUrl, { cache: 'no-cache' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const remote = await resp.json();
    const local = configJson || buildConfigJson();
    const remoteVersion = remote && remote.version ? remote.version : '0.0.0';
    const localVersion = local && local.version ? local.version : '0.0.0';
    if (compareVersions(remoteVersion, localVersion) > 0) {
      // Merge: apply remote settings; keep local stats by default
      const merged = {
        version: remote.version || localVersion,
        updatedAt: Date.now(),
        settings: Object.assign({}, local.settings, remote.settings || {}),
        stats: Object.assign({}, local.stats) // keep stats
      };
      applyConfigJson(merged);
    }
  } catch (e) {
    console.warn('Remote config check failed:', e);
  } finally {
    lastConfigCheck = Date.now();
    chrome.storage.local.set({ lastConfigCheck });
  }
}

// Schedule periodic checks
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('configUpdateAlarm', { periodInMinutes: 180 });
  // Do an initial delayed check
  setTimeout(() => { checkForRemoteConfigUpdates(); }, 5000);
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('configUpdateAlarm', { periodInMinutes: 180 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm && alarm.name === 'configUpdateAlarm') {
    checkForRemoteConfigUpdates();
  }
});

function updateBadge() {
  const badgeText = isEnabled ? 'ON' : 'OFF';
  chrome.action.setBadgeText({ text: badgeText });
  chrome.action.setBadgeBackgroundColor({ color: isEnabled ? '#34C759' : '#FF3B30' });
  const modeLabel = mode === 'roll' ? 'Roll' : mode === 'interval' ? 'Interval' : 'Roulette';
  const title = `Rickroll Extension — ${isEnabled ? 'Enabled' : 'Disabled'} (${modeLabel})`;
  chrome.action.setTitle({ title });
}

// Listen for tab creation
chrome.tabs.onCreated.addListener((tab) => {
  if (!isEnabled) return;
  
  tabCount++;
  chrome.storage.local.set({ tabCount: tabCount });
  saveConfigJson();
  
  let shouldRickroll = false;
  
  if (mode === 'roll') {
    // Random chance to rickroll (1/randomChance)
    shouldRickroll = Math.floor(Math.random() * randomChance) === 0;
  } else if (mode === 'interval') {
    // Fixed interval rickroll
    shouldRickroll = tabCount % intervalValue === 0;
  } else if (mode === 'roulette') {
    // Roulette mode - progress towards target
    rouletteProgress++;
    chrome.storage.local.set({ rouletteProgress });
    saveConfigJson();
    shouldRickroll = rouletteProgress === rouletteTarget;
    
    // Reset for next cycle if rickroll occurred
    if (shouldRickroll) {
      rouletteProgress = 0;
      rouletteTarget = Math.floor(Math.random() * intervalValue) + 1;
      chrome.storage.local.set({ rouletteProgress, rouletteTarget });
    }
  }
  
  if (shouldRickroll) {
    rickrollCount++;
    chrome.storage.local.set({ rickrollCount });
    saveConfigJson();
    // Wait a moment for the tab to fully load
    setTimeout(() => {
      chrome.tabs.update(tab.id, {
        url: chrome.runtime.getURL('rickroll.html')
      });
    }, 100);
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getState') {
    sendResponse({ 
      tabCount, 
      isEnabled, 
      randomChance, 
      mode, 
      intervalValue, 
      rouletteProgress, 
      rouletteTarget,
      rickrollCount,
      intervalProgressVisible,
      chanceManualEnabled,
      intervalManualEnabled,
      rouletteManualEnabled,
      accent1,
      accent2
    });
  } else if (request.action === 'toggleEnabled') {
    isEnabled = request.isEnabled;
    chrome.storage.local.set({ isEnabled });
    updateBadge();
    saveConfigJson();
    sendResponse({ success: true });
  } else if (request.action === 'resetCount') {
    tabCount = 0;
    rouletteProgress = 0;
    if (mode === 'roulette') {
      rouletteTarget = Math.floor(Math.random() * intervalValue) + 1;
      chrome.storage.local.set({ tabCount: 0, rouletteProgress: 0, rouletteTarget });
    } else {
      chrome.storage.local.set({ tabCount: 0 });
    }
    saveConfigJson();
    sendResponse({ success: true });
  } else if (request.action === 'updateChance') {
    randomChance = request.randomChance;
    chrome.storage.local.set({ randomChance });
    saveConfigJson();
    sendResponse({ success: true });
  } else if (request.action === 'updateMode') {
    mode = request.mode;
    if (mode === 'roulette') {
      rouletteProgress = 0;
      rouletteTarget = Math.floor(Math.random() * intervalValue) + 1;
      chrome.storage.local.set({ mode, rouletteProgress, rouletteTarget });
    } else {
      chrome.storage.local.set({ mode });
    }
    updateBadge();
    saveConfigJson();
    sendResponse({ success: true });
  } else if (request.action === 'updateInterval') {
    intervalValue = request.intervalValue;
    if (mode === 'roulette') {
      rouletteProgress = 0;
      rouletteTarget = Math.floor(Math.random() * intervalValue) + 1;
      chrome.storage.local.set({ intervalValue, rouletteProgress, rouletteTarget });
    } else {
      chrome.storage.local.set({ intervalValue });
    }
    saveConfigJson();
    sendResponse({ success: true });
  } else if (request.action === 'openRickrollNow') {
    chrome.tabs.create({ url: chrome.runtime.getURL('rickroll.html') }, () => {
      sendResponse({ success: true });
    });
    return true; // keep the message channel open for async response
  } else if (request.action === 'updateIntervalProgressVisible') {
    intervalProgressVisible = !!request.intervalProgressVisible;
    chrome.storage.local.set({ intervalProgressVisible });
    saveConfigJson();
    sendResponse({ success: true });
  } else if (request.action === 'setManualToggle') {
    const key = request.key;
    const value = !!request.value;
    if (key === 'chanceManualEnabled') chanceManualEnabled = value;
    if (key === 'intervalManualEnabled') intervalManualEnabled = value;
    if (key === 'rouletteManualEnabled') rouletteManualEnabled = value;
    chrome.storage.local.set({ [key]: value });
    saveConfigJson();
    sendResponse({ success: true });
  } else if (request.action === 'setAccent') {
    const key = request.key === 'accent1' ? 'accent1' : 'accent2';
    const value = String(request.value || '').trim();
    if (key === 'accent1') accent1 = value; else accent2 = value;
    chrome.storage.local.set({ [key]: value });
    saveConfigJson();
    sendResponse({ success: true });
  }
});
