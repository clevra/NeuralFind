document.addEventListener('DOMContentLoaded', () => {
  const promptEl = document.getElementById('prompt');
  const confidenceEl = document.getElementById('confidence');
  const sliderValEl = document.getElementById('slider-val');
  const statusEl = document.getElementById('status');
  const enableToggle = document.getElementById('enableToggle');
  const gpuToggle = document.getElementById('gpuToggle');
  const popoutBtn = document.getElementById('popoutBtn');

  // Hide the popout button if we are already in the popped-out window
  if (window.location.search.includes('popped=1')) {
    popoutBtn.style.display = 'none';
  }

  // Listen for storage changes (e.g. if the background script falls back to CPU)
  browser.storage.onChanged.addListener((changes) => {
    if (changes.useGPU) {
      gpuToggle.checked = changes.useGPU.newValue;
    }
    if (changes.activeDevice) {
      statusEl.innerText = `Active: ${changes.activeDevice.newValue === 'webgpu' ? 'GPU Acceleration' : 'CPU Mode'}`;
    }
  });

  // Handle Popout (Pin)
  popoutBtn.addEventListener('click', () => {
    // We can perfectly calculate the screen coordinates right here in the popup
    const width = 340;
    const height = 480;
    const left = Math.max(0, window.screenX - width - 10);
    const top = window.screenY + 30;

    // Tell the background script to open the persistent window
    browser.runtime.sendMessage({ 
      action: "openPopout", 
      left: Math.round(left), 
      top: Math.round(top) 
    }).then(() => {
      window.close(); // Close the original dropdown popup
    });
  });

  // Load existing data from storage
  browser.storage.local.get(['targetPrompt', 'aiConfidence', 'isEnabled', 'useGPU', 'activeDevice']).then((res) => {
    if (res.targetPrompt) promptEl.value = res.targetPrompt;
    if (res.aiConfidence) {
      confidenceEl.value = res.aiConfidence;
      sliderValEl.innerText = `${res.aiConfidence}%`;
    }
    if (res.isEnabled !== undefined) {
      enableToggle.checked = res.isEnabled;
    }
    if (res.useGPU !== undefined) {
      gpuToggle.checked = res.useGPU;
    }
    if (res.activeDevice) {
      statusEl.innerText = `Active: ${res.activeDevice === 'webgpu' ? 'GPU Acceleration' : 'CPU Mode'}`;
    }
  });

  function triggerScan(forceEnable = false) {
    const value = promptEl.value.trim();
    const conf = parseInt(confidenceEl.value, 10);
    
    if (forceEnable) {
      enableToggle.checked = true;
    }
    
    if (!value) {
      statusEl.innerText = "Waiting for prompt...";
      return;
    }

    statusEl.innerText = "🔍 Scanning page...";
    
    // Save to storage
    browser.storage.local.set({ 
      targetPrompt: value, 
      aiConfidence: conf, 
      isEnabled: enableToggle.checked,
      useGPU: gpuToggle.checked
    }).then(() => {
      browser.tabs.query({active: true, currentWindow: true}).then(tabs => {
        if (!tabs[0]) return;
        
        // Attempt to message the content script
        browser.tabs.sendMessage(tabs[0].id, { action: "rescan" }).then(() => {
           statusEl.innerText = "✅ Scan triggered!";
        }).catch(e => {
           // If the content script is missing (page hasn't been reloaded), inject it dynamically!
           browser.scripting.executeScript({
             target: { tabId: tabs[0].id },
             files: ['content.js']
           }).then(() => {
             // Now that it's injected, send the message again
             return browser.tabs.sendMessage(tabs[0].id, { action: "rescan" });
           }).then(() => {
             statusEl.innerText = "✅ Scan triggered!";
           }).catch(err => {
             statusEl.innerText = "⚠️ Cannot scan this restricted page.";
           });
        });
      });
    });
  }

  // Handle Enable/Disable toggle
  enableToggle.addEventListener('change', () => {
    const isEnabled = enableToggle.checked;
    browser.storage.local.set({ isEnabled }).then(() => {
      browser.tabs.query({active: true, currentWindow: true}).then(tabs => {
        if(tabs[0]) {
          browser.tabs.sendMessage(tabs[0].id, { action: "toggle", state: isEnabled }).catch(()=>{});
        }
      });
    });
  });

  // Handle GPU Toggle
  gpuToggle.addEventListener('change', () => {
    statusEl.innerText = "Rebooting AI Core...";
    browser.storage.local.set({ useGPU: gpuToggle.checked }).then(() => {
      // Send a message to the background script to destroy the pipeline
      browser.runtime.sendMessage({ action: "resetPipeline" }).then(() => {
        triggerScan(true);
      });
    });
  });

  // Automatically scan new tabs when you switch to them (crucial for the pinned popout window!)
  browser.tabs.onActivated.addListener(() => {
    setTimeout(() => {
      triggerScan();
    }, 200); // Slight delay to ensure the new tab is ready
  });

  // Automatically scan the page when it finishes loading or refreshing
  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.active) {
      triggerScan();
    }
  });

  // Auto-scan on Slider change
  confidenceEl.addEventListener('input', () => {
    sliderValEl.innerText = `${confidenceEl.value}%`;
  });
  
  confidenceEl.addEventListener('change', () => {
    triggerScan(true);
  });

  // Auto-scan on Textarea typing (Debounced)
  let typingTimer;
  promptEl.addEventListener('input', () => {
    clearTimeout(typingTimer);
    statusEl.innerText = "Typing...";
    typingTimer = setTimeout(() => {
      triggerScan(true);
    }, 800); // Wait 800ms after they stop typing
  });
});
