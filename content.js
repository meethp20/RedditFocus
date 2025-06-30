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

function checkAndBlock() {
  const subreddit = getCurrentSubreddit();
  if (subreddit && blockedSubreddits.includes(subreddit.toLowerCase())) {
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
      background: rgba(0, 0, 0, 0.9);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-family: Arial, sans-serif;
    ">
      <div style="
        background: #333;
        padding: 40px;
        border-radius: 10px;
        text-align: center;
        max-width: 400px;
      ">
        <h2 style="margin-top: 0; color: #ff4444;">Subreddit Blocked</h2>
        <p>r/${subreddit} is in your blocked list.</p>
        <p>Take a break and focus on more productive activities!</p>
        <button id="unblock-temp" style="
          background: #ff4444;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 5px;
          cursor: pointer;
          margin: 10px;
        ">Unblock for 10 minutes</button>
        <button id="go-back" style="
          background: #666;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 5px;
          cursor: pointer;
          margin: 10px;
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