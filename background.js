// Track tab count and extension state
let tabCount = 0;
let isEnabled = true;
let randomChance = 250; // 1/250 chance by default
let mode = 'roll'; // 'roll', 'interval', 'roulette'
let intervalValue = 50; // Default interval
let rouletteProgress = 0; // Current progress in roulette mode
let rouletteTarget = 0; // Target for roulette mode
let rickrollCount = 0; // Number of times rickroll has occurred

// Initialize from storage
chrome.storage.local.get(['tabCount', 'isEnabled', 'randomChance', 'mode', 'intervalValue', 'rouletteProgress', 'rouletteTarget', 'rickrollCount'], (result) => {
  tabCount = result.tabCount || 0;
  isEnabled = result.isEnabled !== undefined ? result.isEnabled : true;
  randomChance = result.randomChance || 250;
  mode = result.mode || 'roll';
  intervalValue = result.intervalValue || 50;
  rouletteProgress = result.rouletteProgress || 0;
  rouletteTarget = result.rouletteTarget || 0;
  rickrollCount = result.rickrollCount || 0;
  
  // Initialize roulette target if not set
  if (mode === 'roulette' && rouletteTarget === 0) {
    rouletteTarget = Math.floor(Math.random() * intervalValue) + 1;
    chrome.storage.local.set({ rouletteTarget });
  }

  updateBadge();
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
      rickrollCount 
    });
  } else if (request.action === 'toggleEnabled') {
    isEnabled = request.isEnabled;
    chrome.storage.local.set({ isEnabled });
    updateBadge();
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
    sendResponse({ success: true });
  } else if (request.action === 'updateChance') {
    randomChance = request.randomChance;
    chrome.storage.local.set({ randomChance });
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
    sendResponse({ success: true });
  } else if (request.action === 'openRickrollNow') {
    chrome.tabs.create({ url: chrome.runtime.getURL('rickroll.html') }, () => {
      sendResponse({ success: true });
    });
    return true; // keep the message channel open for async response
  }
});
