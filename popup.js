// Popup script for Reddit Activity Tracker

document.addEventListener('DOMContentLoaded', async () => {
  await loadStats();
  await loadBlockedSubreddits();
  setupEventListeners();
});

async function loadStats() {
  const result = await chrome.storage.local.get(['dailyTime', 'totalTime', 'subredditStats']);
  const dailyTime = result.dailyTime || {};
  const totalTime = result.totalTime || 0;
  const subredditStats = result.subredditStats || {};
  
  const today = new Date().toDateString();
  const todayTime = dailyTime[today] || 0;
  
  // Update time displays
  document.getElementById('today-time').textContent = formatTime(todayTime);
  document.getElementById('total-time').textContent = formatTime(totalTime);
  
  // Update subreddit stats
  updateSubredditStats(subredditStats[today] || {});
}

async function loadBlockedSubreddits() {
  const result = await chrome.storage.local.get(['blockedSubreddits']);
  const blockedSubreddits = result.blockedSubreddits || [];
  updateBlockedList(blockedSubreddits);
}

function formatTime(milliseconds) {
  const minutes = Math.floor(milliseconds / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  return `${minutes}m`;
}

function updateSubredditStats(stats) {
  const container = document.getElementById('subreddit-stats');
  
  if (Object.keys(stats).length === 0) {
    container.innerHTML = '<div style="text-align: center; color: #666;">No data yet</div>';
    return;
  }
  
  // Sort subreddits by visit count
  const sortedSubreddits = Object.entries(stats)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5); // Show top 5
  
  container.innerHTML = sortedSubreddits.map(([subreddit, count]) => `
    <div class="subreddit-item">
      <span class="subreddit-name">r/${subreddit}</span>
      <span class="visit-count">${count}</span>
    </div>
  `).join('');
}

function updateBlockedList(blockedSubreddits) {
  const container = document.getElementById('blocked-list');
  
  if (blockedSubreddits.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: #666;">No blocked subreddits</div>';
    return;
  }
  
  container.innerHTML = blockedSubreddits.map(subreddit => `
    <div class="blocked-item">
      <span>r/${subreddit}</span>
      <button class="remove-btn" data-subreddit="${subreddit}">Remove</button>
    </div>
  `).join('');
}

function setupEventListeners() {
  // Add subreddit to block list
  document.getElementById('add-block').addEventListener('click', async () => {
    const input = document.getElementById('subreddit-input');
    const subreddit = input.value.trim().toLowerCase();
    
    if (!subreddit) return;
    
    const result = await chrome.storage.local.get(['blockedSubreddits']);
    const blockedSubreddits = result.blockedSubreddits || [];
    
    if (!blockedSubreddits.includes(subreddit)) {
      blockedSubreddits.push(subreddit);
      await chrome.storage.local.set({ blockedSubreddits });
      updateBlockedList(blockedSubreddits);
    }
    
    input.value = '';
  });
  
  // Allow Enter key to add subreddit
  document.getElementById('subreddit-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('add-block').click();
    }
  });
  
  // Remove subreddit from block list
  document.getElementById('blocked-list').addEventListener('click', async (e) => {
    if (e.target.classList.contains('remove-btn')) {
      const subredditToRemove = e.target.dataset.subreddit;
      const result = await chrome.storage.local.get(['blockedSubreddits']);
      const blockedSubreddits = result.blockedSubreddits || [];
      
      const updatedList = blockedSubreddits.filter(s => s !== subredditToRemove);
      await chrome.storage.local.set({ blockedSubreddits: updatedList });
      updateBlockedList(updatedList);
    }
  });
  
  // Reset all statistics
  document.getElementById('reset-stats').addEventListener('click', async () => {
    if (confirm('Are you sure you want to reset all statistics? This cannot be undone.')) {
      await chrome.storage.local.remove(['dailyTime', 'totalTime', 'subredditStats']);
      await loadStats();
    }
  });
}

// Auto-refresh stats every 5 seconds when popup is open
setInterval(loadStats, 5000);