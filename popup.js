// Get DOM elements
const tabCountElement = document.getElementById('tabCount');
const rickrollCountElement = document.getElementById('rickrollCount');
const statLabelElement = document.getElementById('statLabel');
const statValueElement = document.getElementById('statValue');
const progressContainer = document.getElementById('progress');
const progressBar = progressContainer ? progressContainer.querySelector('.bar') : null;
const toggleElement = document.getElementById('toggle');
const resetBtn = document.getElementById('resetBtn');
const chanceRange = document.getElementById('chanceRange');
const intervalRange = document.getElementById('intervalRange');
const rouletteRange = document.getElementById('rouletteRange');
const chanceLabel = document.getElementById('chanceLabel');
const intervalLabel = document.getElementById('intervalLabel');
const rouletteLabel = document.getElementById('rouletteLabel');
const themeToggle = document.getElementById('themeToggle');

// Mode selector elements
const modeTabs = document.querySelectorAll('.mode-tab');
const rollControls = document.getElementById('rollControls');
const intervalControls = document.getElementById('intervalControls');
const rouletteControls = document.getElementById('rouletteControls');

// Load current state when popup opens
document.addEventListener('DOMContentLoaded', function() {
    loadTheme();
    loadState();
});

function loadTheme() {
    chrome.storage.local.get(['theme'], (res) => {
        const theme = res.theme === 'light' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', theme);
    });
}

// Load state from background script
function loadState() {
    chrome.runtime.sendMessage({ action: 'getState' }, (response) => {
        if (response) {
            updateUI(response);
        }
    });
}

// Update UI with current state
function updateUI(state) {
    const { tabCount, isEnabled, randomChance, mode, intervalValue, rouletteProgress, rouletteTarget, rickrollCount } = state;

    if (tabCountElement) tabCountElement.textContent = tabCount;
    if (rickrollCountElement) rickrollCountElement.textContent = rickrollCount || 0;

    // Update mode tabs
    modeTabs.forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.mode === mode) {
            tab.classList.add('active');
        }
    });

    // Update controls visibility
    if (rollControls) rollControls.style.display = mode === 'roll' ? 'block' : 'none';
    if (intervalControls) intervalControls.style.display = mode === 'interval' ? 'block' : 'none';
    if (rouletteControls) rouletteControls.style.display = mode === 'roulette' ? 'block' : 'none';

    // Update inputs and labels
    if (chanceRange) chanceRange.value = randomChance;
    if (intervalRange) intervalRange.value = intervalValue;
    if (rouletteRange) rouletteRange.value = intervalValue; // Roulette uses same value as interval
    if (chanceLabel) chanceLabel.textContent = `1/${randomChance}`;
    if (intervalLabel) intervalLabel.textContent = `${intervalValue}`;
    if (rouletteLabel) rouletteLabel.textContent = `${intervalValue}`;

    // Update stats and progress based on mode
    if (mode === 'roll') {
        if (statLabelElement) statLabelElement.textContent = 'Rickroll Chance:';
        if (statValueElement) statValueElement.textContent = `1/${randomChance}`;
        setProgressIndeterminate();
    } else if (mode === 'interval') {
        if (statLabelElement) statLabelElement.textContent = 'Next Rickroll at:';
        const nextRickroll = intervalValue > 0 ? Math.ceil((tabCount + 1) / intervalValue) * intervalValue : 0;
        if (statValueElement) statValueElement.textContent = nextRickroll;
        const progress = intervalValue > 0 ? ((tabCount % intervalValue) / intervalValue) * 100 : 0;
        setProgressDeterminate(progress);
    } else if (mode === 'roulette') {
        if (statLabelElement) statLabelElement.textContent = 'Progress:';
        if (statValueElement) statValueElement.textContent = '???';
        setProgressIndeterminate();
    }

    // Update toggle state
    if (isEnabled) {
        toggleElement.classList.add('active');
        toggleElement.setAttribute('aria-checked', 'true');
    } else {
        toggleElement.classList.remove('active');
        toggleElement.setAttribute('aria-checked', 'false');
    }
}

function setProgressDeterminate(percent) {
    if (!progressContainer || !progressBar) return;
    progressContainer.classList.remove('indeterminate');
    const clamped = Math.max(0, Math.min(100, percent));
    progressBar.style.width = `${clamped}%`;
}

function setProgressIndeterminate() {
    if (!progressContainer || !progressBar) return;
    progressContainer.classList.add('indeterminate');
    progressBar.style.width = '40%';
}

// Mode tab click handlers
modeTabs.forEach(tab => {
    tab.addEventListener('click', function() {
        const newMode = this.dataset.mode;
        chrome.runtime.sendMessage({ 
            action: 'updateMode', 
            mode: newMode 
        }, (response) => {
            if (response && response.success) {
                loadState(); // Reload state to update UI
            }
        });
    });
});

// Toggle extension on/off
toggleElement.addEventListener('click', function() {
    const isCurrentlyEnabled = toggleElement.classList.contains('active');
    const newState = !isCurrentlyEnabled;
    
    chrome.runtime.sendMessage({ 
        action: 'toggleEnabled', 
        isEnabled: newState 
    }, (response) => {
        if (response && response.success) {
            loadState(); // Reload state to update UI
        }
    });
});

// Update rickroll chance (Roll mode)
if (chanceRange) {
    chanceRange.addEventListener('input', function() {
        const v = parseInt(chanceRange.value);
        if (chanceLabel) chanceLabel.textContent = `1/${v}`;
    });
    chanceRange.addEventListener('change', function() {
        const newChance = parseInt(chanceRange.value);
        if (newChance >= 1 && newChance <= 1000) {
            chrome.runtime.sendMessage({ 
                action: 'updateChance', 
                randomChance: newChance 
            }, (response) => {
                if (response && response.success) {
                    loadState(); // Reload state to update UI
                }
            });
        }
    });
}

// Update interval value (Interval and Roulette modes)
if (intervalRange) {
    intervalRange.addEventListener('input', function() {
        const v = parseInt(intervalRange.value);
        if (intervalLabel) intervalLabel.textContent = `${v}`;
    });
    intervalRange.addEventListener('change', function() {
        const newInterval = parseInt(intervalRange.value);
        if (newInterval >= 1 && newInterval <= 1000) {
            chrome.runtime.sendMessage({ 
                action: 'updateInterval', 
                intervalValue: newInterval 
            }, (response) => {
                if (response && response.success) {
                    loadState(); // Reload state to update UI
                }
            });
        }
    });
}

// Update roulette value (Roulette mode)
if (rouletteRange) {
    rouletteRange.addEventListener('input', function() {
        const v = parseInt(rouletteRange.value);
        if (rouletteLabel) rouletteLabel.textContent = `${v}`;
    });
    rouletteRange.addEventListener('change', function() {
        const newRoulette = parseInt(rouletteRange.value);
        if (newRoulette >= 1 && newRoulette <= 1000) {
            chrome.runtime.sendMessage({ 
                action: 'updateInterval', 
                intervalValue: newRoulette 
            }, (response) => {
                if (response && response.success) {
                    loadState(); // Reload state to update UI
                }
            });
        }
    });
}

// Reset tab counter
if (resetBtn) {
    resetBtn.addEventListener('click', function() {
        chrome.runtime.sendMessage({ action: 'resetCount' }, (response) => {
            if (response && response.success) {
                loadState(); // Reload state to update UI
            }
        });
    });
}


// Theme toggle
if (themeToggle) {
    themeToggle.addEventListener('click', function() {
        const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
        const next = current === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        chrome.storage.local.set({ theme: next });
    });
}
