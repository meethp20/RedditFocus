// Background script for Reddit Activity Tracker

let activeTab = null;
let startTime = null;
let totalTime = 0;

// Track when user switches to/from Reddit tabs
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  handleTabChange(tab);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    handleTabChange(tab);
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Browser lost focus
    stopTracking();
  } else {
    // Browser gained focus
    const tabs = await chrome.tabs.query({ active: true, windowId: windowId });
    if (tabs.length > 0) {
      handleTabChange(tabs[0]);
    }
  }
});

function handleTabChange(tab) {
  if (isRedditTab(tab.url)) {
    startTracking(tab);
  } else {
    stopTracking();
  }
}

function isRedditTab(url) {
  return url && url.includes('reddit.com');
}

function startTracking(tab) {
  if (activeTab && activeTab.id === tab.id) return;
  
  stopTracking(); // Stop previous tracking
  activeTab = tab;
  startTime = Date.now();
}

function stopTracking() {
  if (activeTab && startTime) {
    const sessionTime = Date.now() - startTime;
    saveTimeData(sessionTime);
  }
  activeTab = null;
  startTime = null;
}

async function saveTimeData(sessionTime) {
  const today = new Date().toDateString();
  
  // Get existing data
  const result = await chrome.storage.local.get(['dailyTime', 'totalTime']);
  const dailyTime = result.dailyTime || {};
  const currentTotal = result.totalTime || 0;
  
  // Update daily time
  dailyTime[today] = (dailyTime[today] || 0) + sessionTime;
  
  // Save updated data
  await chrome.storage.local.set({
    dailyTime: dailyTime,
    totalTime: currentTotal + sessionTime
  });
}

// Handle subreddit tracking message from content script
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === 'SUBREDDIT_VISIT') {
    const { subreddit } = message;
    const today = new Date().toDateString();
    
    const result = await chrome.storage.local.get(['subredditStats']);
    const subredditStats = result.subredditStats || {};
    
    if (!subredditStats[today]) {
      subredditStats[today] = {};
    }
    
    subredditStats[today][subreddit] = (subredditStats[today][subreddit] || 0) + 1;
    
    await chrome.storage.local.set({ subredditStats });
  }
});