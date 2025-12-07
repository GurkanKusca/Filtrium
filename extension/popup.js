const input = document.getElementById("filterInput");
const addBtn = document.getElementById("addBtn");
const saveBtn = document.getElementById("saveBtn");
const list = document.getElementById("filterList");
const filterCountDiv = document.getElementById("filterCount");
const imagesBlockedDiv = document.getElementById("imagesBlocked");
const videosBlockedDiv = document.getElementById("videosBlocked");
const totalCheckedDiv = document.getElementById("totalChecked");


const backendStatusDiv = document.getElementById("backendStatus");
const statusText = document.getElementById("statusText");
const statusDot = backendStatusDiv.querySelector('.dot');

let filters = []; 

function applyTheme() {
  chrome.storage.local.get('themeData', (result) => {
    if (result.themeData) {
      const { bg, accent } = result.themeData;
      const root = document.documentElement;
      
      if (bg) root.style.setProperty('--bg-color', bg);
      if (accent) root.style.setProperty('--primary', accent);
      
      const rgb = bg.match(/\d+/g);
      if (rgb) {
         const brightness = (parseInt(rgb[0])*299 + parseInt(rgb[1])*587 + parseInt(rgb[2])*114)/1000;
         if (brightness > 130) { 

            root.style.setProperty('--text-main', '#0F1419');
            root.style.setProperty('--text-sub', '#536471');
            root.style.setProperty('--card-bg', 'rgba(0, 0, 0, 0.03)');
            root.style.setProperty('--border', 'rgba(0, 0, 0, 0.1)');
            root.style.setProperty('--input-bg', 'rgba(0, 0, 0, 0.05)');
            document.getElementById('addBtn').style.backgroundColor = '#0F1419';
            document.getElementById('addBtn').style.color = '#FFFFFF';
         } else {

            root.style.setProperty('--text-main', '#F7F9F9');
            root.style.setProperty('--text-sub', '#8B98A5');
            root.style.setProperty('--card-bg', 'rgba(255, 255, 255, 0.05)');
            root.style.setProperty('--border', 'rgba(255, 255, 255, 0.1)');
            root.style.setProperty('--input-bg', 'rgba(255, 255, 255, 0.1)');
            document.getElementById('addBtn').style.backgroundColor = '#EFF3F4';
            document.getElementById('addBtn').style.color = '#0F1419';
         }
      }
    }
  });
}
applyTheme();

async function checkBackend() {
  try {
    const response = await fetch('http://localhost:5000/health', { method: 'GET' });
    if (response.ok) {
      statusText.textContent = "AI Online";
      statusDot.className = "dot online";
    } else { throw new Error('Backend error'); }
  } catch (error) {
    statusText.textContent = "AI Offline";
    statusDot.className = "dot offline";
  }
}
checkBackend();



chrome.storage.local.get(['userFilters', 'imagesBlocked', 'videosBlocked', 'totalChecked'], (result) => {
  if (result.userFilters) {

    if (result.userFilters.length > 0 && typeof result.userFilters[0] === 'string') {
        console.log("Eski veri formatı tespit edildi, dönüştürülüyor...");
        filters = result.userFilters.map(term => ({ term: term, level: 'normal' }));
    } else {
        filters = result.userFilters || [];
    }
    renderFilters();
  }
  

  imagesBlockedDiv.textContent = formatNumber(result.imagesBlocked || 0);
  videosBlockedDiv.textContent = formatNumber(result.videosBlocked || 0);
  totalCheckedDiv.textContent = formatNumber(result.totalChecked || 0);
});

function formatNumber(num) {
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num;
}


addBtn.addEventListener("click", addFilter);
input.addEventListener("keypress", (e) => { if (e.key === "Enter") addFilter(); });

function addFilter() {
  const value = input.value.trim().toLowerCase();

  const exists = filters.some(f => f.term === value);
  
  if (value && !exists) {

    filters.push({ term: value, level: 'normal' });
    renderFilters();
    input.value = "";
  }
}

function renderFilters() {
  list.innerHTML = "";
  filterCountDiv.textContent = filters.length;
  
  if (filters.length === 0) {
    const emptyState = document.createElement("li");
    emptyState.style.color = "var(--text-sub)";
    emptyState.style.justifyContent = "center";
    emptyState.style.border = "none";
    emptyState.textContent = "No active filters";
    list.appendChild(emptyState);
    return;
  }

  filters.forEach((f, i) => {
    const li = document.createElement("li");
    

    const infoDiv = document.createElement("div");
    infoDiv.className = "filter-info";
    
    const nameSpan = document.createElement("span");
    nameSpan.className = "filter-name";
    nameSpan.textContent = f.term;
    infoDiv.appendChild(nameSpan);
    

    const controlsDiv = document.createElement("div");
    controlsDiv.className = "controls";
    

    const sliderContainer = document.createElement("div");
    sliderContainer.className = "slider-container";
    

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "1";
    slider.max = "3";
    slider.step = "1";
    

    if (f.level === 'low') slider.value = 1;
    else if (f.level === 'high') slider.value = 3;
    else slider.value = 2; 

    const label = document.createElement("div");
    label.className = "level-label";
    label.textContent = f.level;
    updateLabelStyle(label, f.level); 


    slider.oninput = (e) => {
        const val = parseInt(e.target.value);
        if (val === 1) f.level = 'low';
        else if (val === 3) f.level = 'high';
        else f.level = 'normal';
        
        label.textContent = f.level;
        updateLabelStyle(label, f.level);
    };

    sliderContainer.appendChild(slider);
    sliderContainer.appendChild(label);


    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-btn";
    removeBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
    `;
    removeBtn.onclick = () => {
      filters.splice(i, 1);
      renderFilters();
    };

    controlsDiv.appendChild(sliderContainer);
    controlsDiv.appendChild(removeBtn);
    
    li.appendChild(infoDiv);
    li.appendChild(controlsDiv);
    list.appendChild(li);
  });
}


function updateLabelStyle(element, level) {
    if (level === 'high') {
        element.style.color = '#F4212E'; 
    } else if (level === 'low') {
        element.style.color = '#00BA7C'; 
    } else {
        element.style.color = '#1D9BF0'; 
    }
}


saveBtn.addEventListener("click", async () => {
  const originalText = saveBtn.textContent;
  
  saveBtn.textContent = "Saving...";
  saveBtn.disabled = true;


  await chrome.storage.local.set({ userFilters: filters });
  

  chrome.runtime.sendMessage({ action: "clearCache" });
  

  chrome.tabs.query({url: ["*://twitter.com/*", "*://x.com/*"]}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { action: "filtersUpdated" }).catch(() => {});
    });
  });


  setTimeout(() => {
    saveBtn.textContent = "Saved";
    saveBtn.style.backgroundColor = "#00BA7C"; 
    
    setTimeout(() => {
      saveBtn.textContent = originalText;
      saveBtn.style.backgroundColor = ""; 
      saveBtn.disabled = false;
    }, 1500);
  }, 600);
});