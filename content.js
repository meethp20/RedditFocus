// Content script for Reddit Activity Tracker

let currentSubreddit = null;
let blockedSubreddits = [];

// Initialize
init();

async function init() {
  // Load blocked subreddits
  const result = await chrome.storage.local.get(['blockedSubreddits']);
  blockedSubreddits = result.blockedSubreddits || [];
  
  // Check if current page should be blocked
  checkAndBlock();
  
  // Track subreddit visits
  trackSubredditVisit();
  
  // Monitor for navigation changes (for single-page app navigation)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      checkAndBlock();
      trackSubredditVisit();
    }
  }).observe(document, { subtree: true, childList: true });
}

function getCurrentSubreddit() {
  const path = window.location.pathname;
  const match = path.match(/^\/r\/([^\/]+)/);
  return match ? match[1].toLowerCase() : null;
}

function trackSubredditVisit() {
  const subreddit = getCurrentSubreddit();
  if (subreddit && subreddit !== currentSubreddit) {
    currentSubreddit = subreddit;
    chrome.runtime.sendMessage({
      type: 'SUBREDDIT_VISIT',
      subreddit: subreddit
    });
  }
}

async function checkAndBlock() {
  const subreddit = getCurrentSubreddit();
  if (!subreddit) return;

  // Check for temporary unblock
  const tempUnblockKey = `tempUnblock_${subreddit.toLowerCase()}`;
  const result = await chrome.storage.local.get(["blockedSubreddits", tempUnblockKey]);
  blockedSubreddits = result.blockedSubreddits || [];
  const tempUnblockUntil = result[tempUnblockKey] || 0;
  const now = Date.now();

  if (blockedSubreddits.includes(subreddit.toLowerCase())) {
    if (now < tempUnblockUntil) {
      // Still temporarily unblocked, do not block
      return;
    } else if (tempUnblockUntil) {
      // Unblock expired, remove the key
      await chrome.storage.local.remove(tempUnblockKey);
    }
    blockPage(subreddit);
  }
}

function blockPage(subreddit) {
  // Create blocking overlay
  const overlay = document.createElement('div');
  overlay.id = 'reddit-tracker-block';
  overlay.innerHTML = `
    <div style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: #000;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-family: Arial, sans-serif;
    ">
      <div style="
        background: #333;
        padding: 30px;
        border-radius: 10px;
        text-align: center;
        max-width: 380px;
        box-shadow: 0 0 20px rgba(255, 255, 255, 0.1);
      ">
        <h2 style="margin-top: 0; color: #ff4444; font-size: 22px;">Subreddit Blocked</h2>
        <p style="font-size: 16px;">r/${subreddit} is in your blocked list.</p>
        <p style="font-size: 14px; color: #ccc;">Take a break and focus on more productive activities!</p>
        <button id="unblock-temp" style="
          background: #ff4444;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 5px;
          cursor: pointer;
          margin: 10px;
          font-size: 14px;
          font-weight: bold;
        ">Unblock for 10 minutes</button>
        <button id="go-back" style="
          background: #666;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 5px;
          cursor: pointer;
          margin: 10px;
          font-size: 14px;
          font-weight: bold;
        ">Go Back</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Add event listeners
  document.getElementById('go-back').addEventListener('click', () => {
    window.history.back();
  });
  
  document.getElementById('unblock-temp').addEventListener('click', () => {
    // Set temporary unblock
    const tempUnblock = Date.now() + (10 * 60 * 1000); // 10 minutes
    chrome.storage.local.set({ 
      [`tempUnblock_${subreddit}`]: tempUnblock 
    });
    overlay.remove();
  });
}



// Listen for storage changes (when blocked subreddits are updated)
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (changes.blockedSubreddits) {
    blockedSubreddits = changes.blockedSubreddits.newValue || [];
    checkAndBlock();
  }
});

