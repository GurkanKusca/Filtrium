console.log("🛡️ Twitter Filter: Background loaded (Images + Videos)");

const cache = new Map();
let stats = { imagesBlocked: 0, videosBlocked: 0, totalChecked: 0 };

chrome.storage.local.get(['imagesBlocked', 'videosBlocked', 'totalChecked'], (result) => {
  stats.imagesBlocked = result.imagesBlocked || 0;
  stats.videosBlocked = result.videosBlocked || 0;
  stats.totalChecked = result.totalChecked || 0;
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.action === "checkImage") {
    handleCheck(message.url, message.userFilters, 'image')
      .then(sendResponse)
      .catch(error => sendResponse({ should_block: false, error: error.message }));
    return true;
  }
  
  if (message.action === "checkVideo") {
    handleCheck(message.url, message.userFilters, 'video')
      .then(sendResponse)
      .catch(error => sendResponse({ should_block: false, error: error.message }));
    return true;
  }
  
  
  if (message.action === "clearCache") {
    cache.clear();
    console.log("Cache cleared");
    sendResponse({ success: true });
  }
});

async function handleCheck(url, userFilters, type) {
  const cacheKey = `${type}:${url}`;
  if (cache.has(cacheKey)) {
    console.log(`Cache hit for ${type}`);
    return cache.get(cacheKey);
  }

  if (!userFilters || userFilters.length === 0) {
    return { should_block: false, reason: "No filters set" };
  }

  console.log(`Checking ${type}: ${url.substring(0, 60)}...`);

  try {
    // BOTH images and videos now use JSON!
    const endpoint = type === 'video' ? '/filter-video' : '/filter-image';
    const bodyKey = type === 'video' ? 'video_url' : 'image_url';
    
    const response = await fetch(`http://localhost:5000${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        [bodyKey]: url,
        user_filters: userFilters
      })
    });

    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`);
    }

    const result = await response.json();
    
    // Cache and stats (same as before)
    cache.set(cacheKey, result);
    
    stats.totalChecked++;
    if (result.should_block) {
      if (type === 'video') stats.videosBlocked++;
      else stats.imagesBlocked++;
    }
    
    chrome.storage.local.set({
      imagesBlocked: stats.imagesBlocked,
      videosBlocked: stats.videosBlocked,
      totalChecked: stats.totalChecked
    });

    if (result.should_block) {
      console.log(`BLOCKED ${type}: ${result.reason}`);
    } else {
      console.log(`ALLOWED ${type}: ${result.reason}`);
    }

    return result;

  } catch (error) {
    console.error(`Error checking ${type}:`, error);
    return {
      should_block: false,
      reason: "Backend error",
      error: error.message
    };
  }
}