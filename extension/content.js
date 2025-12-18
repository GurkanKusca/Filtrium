console.log("Twitter Filter: Content script loaded (Images + Videos)");

const processedMedia = new WeakSet();
const userAllowedMedia = new WeakSet(); 
let userFilters = [];
let isProcessing = false;

// Cached theme to avoid recalculation
let cachedTheme = null;
let themeCheckTime = 0;
const THEME_CACHE_MS = 10000; // Re-check theme every 10 seconds

// Batch processing queue
const mediaQueue = [];
let batchTimeout = null;
const BATCH_DELAY_MS = 50; // Process batch after 50ms of no new items


function getThemeColor() {
  const now = Date.now();
  // Return cached theme if still valid
  if (cachedTheme && (now - themeCheckTime) < THEME_CACHE_MS) {
    return cachedTheme;
  }

  const bgColor = getComputedStyle(document.body).backgroundColor;
  const rgb = bgColor.match(/\d+/g);
  if (!rgb) {
    cachedTheme = 'dark';
    themeCheckTime = now;
    return cachedTheme;
  }

  const brightness = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
  cachedTheme = brightness > 125 ? 'light' : 'dark';
  themeCheckTime = now;
  return cachedTheme;
}

chrome.storage.local.get('userFilters', (result) => {
  userFilters = result.userFilters || [];
  console.log("Filters loaded:", userFilters);
  
  if (userFilters.length > 0) {
    init();
  } else {
    console.log("No filters - monitoring disabled");
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "filtersUpdated") {
    chrome.storage.local.get('userFilters', (result) => {
      userFilters = result.userFilters || [];
      console.log("Filters updated:", userFilters);
      location.reload();
    });
  }
});

function init() {
  console.log("Starting monitoring (Modern UI)...");
  
  const observer = new MutationObserver((mutations) => {
    if (isProcessing) return;
    
    isProcessing = true;
    requestAnimationFrame(() => {
      processMutations(mutations);
      isProcessing = false;
    });
  });
  
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
  
  processAllMedia();
}

function processMutations(mutations) {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType === 1) {
        if (node.tagName === 'IMG' && node.src && node.src.includes('twimg.com')) {
          queueMediaCheck(node, 'image');
        }
        if (node.tagName === 'VIDEO') {
          queueMediaCheck(node, 'video');
        }
        
        // Use combined selector for efficiency
        const mediaElements = node.querySelectorAll?.('img[src*="twimg.com"], video');
        if (mediaElements) {
          mediaElements.forEach(el => {
            queueMediaCheck(el, el.tagName === 'VIDEO' ? 'video' : 'image');
          });
        }
      }
    }
  }
}

// Queue media for batch processing
function queueMediaCheck(element, type) {
  if (processedMedia.has(element)) return;
  
  mediaQueue.push({ element, type });
  
  // Debounce: process batch after delay
  if (batchTimeout) clearTimeout(batchTimeout);
  batchTimeout = setTimeout(processBatch, BATCH_DELAY_MS);
}

// Process all queued media in batch
async function processBatch() {
  batchTimeout = null;
  if (mediaQueue.length === 0) return;
  
  // Take all items from queue
  const batch = mediaQueue.splice(0, mediaQueue.length);
  
  // Process in parallel with concurrency limit
  const CONCURRENCY = 5;
  for (let i = 0; i < batch.length; i += CONCURRENCY) {
    const chunk = batch.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(({ element, type }) => checkMedia(element, type)));
  }
}

function processAllMedia() {
  // Combined selector for efficiency
  const allMedia = document.querySelectorAll('img[src*="twimg.com"], video');
  allMedia.forEach(el => {
    queueMediaCheck(el, el.tagName === 'VIDEO' ? 'video' : 'image');
  });
}

async function checkMedia(element, type) {
  if (processedMedia.has(element)) return;
  

  if (type === 'image') {
    if (element.src.includes('profile_images') || element.width < 50 || element.height < 50) {
      return;
    }
  }
  
  processedMedia.add(element);
  

  element.style.transition = 'filter 0.3s ease';
  

  if (type === 'video') {
    const posterUrl = element.poster;
    if (!posterUrl || !posterUrl.includes('twimg.com')) return;
    
    try {
      const result = await chrome.runtime.sendMessage({
        action: "checkImage",
        url: posterUrl,
        userFilters: userFilters
      });
      
      if (result && result.should_block) {
        applyModernOverlay(element, {...result, type: 'video'});
      }
    } catch (error) {
      console.error('Error checking video:', error);
    }
    return;
  }

  const url = element.src;
  try {
    const result = await chrome.runtime.sendMessage({
      action: "checkImage",
      url: url,
      userFilters: userFilters
    });
    
    if (result && result.should_block) {
      applyModernOverlay(element, result);
    }
  } catch (error) {
    console.error('Error checking image:', error);
  }
}



function applyModernOverlay(element, result) {
  const parent = element.parentElement;
  

  if (getComputedStyle(parent).position === 'static') {
    parent.style.position = 'relative';
  }

  const theme = getThemeColor(); 

  const styles = {
    overlayBg: theme === 'dark' ? 'rgba(0, 0, 0, 0.75)' : 'rgba(255, 255, 255, 0.85)',
    textColor: theme === 'dark' ? '#E7E9EA' : '#0F1419',
    subTextColor: theme === 'dark' ? '#71767B' : '#536471',
    btnBg: theme === 'dark' ? '#EFF3F4' : '#0F1419', 
    btnText: theme === 'dark' ? '#0F1419' : '#FFFFFF',
    borderColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
  };


  const overlay = document.createElement('div');
  overlay.className = 'twitter-filter-overlay';
  overlay.style.cssText = `
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: ${styles.overlayBg};
    backdrop-filter: blur(12px); /* Buzlu cam efekti */
    -webkit-backdrop-filter: blur(12px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 10;
    border-radius: inherit;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    transition: opacity 0.3s ease;
  `;

  overlay.innerHTML = `
    <div style="
      text-align: center; 
      padding: 20px; 
      max-width: 80%;
    ">
      <div style="
        font-size: 15px; 
        font-weight: 700; 
        color: ${styles.textColor}; 
        margin-bottom: 4px;
        letter-spacing: -0.5px;
      ">
        Content Filtered
      </div>
      <div style="
        font-size: 13px; 
        color: ${styles.subTextColor}; 
        margin-bottom: 16px;
      ">
        ${result.reason}
      </div>
      <button class="show-btn" style="
        background: ${styles.btnBg};
        color: ${styles.btnText};
        border: none;
        padding: 8px 20px;
        border-radius: 9999px; /* Twitter stili tam yuvarlak */
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
        transition: transform 0.1s;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      ">
        Show anyway
      </button>
    </div>
  `;


  const hideBtn = document.createElement('button');
  hideBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
      <path d="M0 0h24v24H0z" fill="none"/>
      <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" stroke-width="2" />
    </svg>
    <span style="margin-left:6px">Hide</span>
  `;
  hideBtn.style.cssText = `
    position: absolute;
    top: 12px;
    right: 12px;
    background: rgba(0, 0, 0, 0.6);
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    z-index: 20;
    display: none; /* Başlangıçta gizli */
    align-items: center;
    backdrop-filter: blur(4px);
    font-family: inherit;
    transition: opacity 0.2s;
  `;


  element.style.opacity = '0'; 
  element.style.pointerEvents = 'none'; 


  const showBtn = overlay.querySelector('.show-btn');
  showBtn.onclick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    

    overlay.style.opacity = '0';
    setTimeout(() => {
        overlay.style.display = 'none';
    }, 300);


    element.style.opacity = '1';
    element.style.filter = 'none';
    element.style.pointerEvents = 'auto';
    

    hideBtn.style.display = 'flex';
  };


  hideBtn.onclick = (e) => {
    e.stopPropagation();
    e.preventDefault();


    overlay.style.display = 'flex';

    requestAnimationFrame(() => {
        overlay.style.opacity = '1';
    });


    element.style.opacity = '0';
    element.style.pointerEvents = 'none';


    hideBtn.style.display = 'none';
  };


  showBtn.onmouseover = () => showBtn.style.transform = 'scale(1.05)';
  showBtn.onmouseout = () => showBtn.style.transform = 'scale(1)';


  parent.appendChild(overlay);
  parent.appendChild(hideBtn);
}

// Replace unbounded Map with size-limited cache
class LRUCache {
  constructor(maxSize = 500, ttl = 300000) { // 5min TTL
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }
  // ...implementation
}

let saveTimeout = null;
function debouncedSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    chrome.storage.local.set(stats);
  }, 5000);
}