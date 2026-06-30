document.addEventListener('DOMContentLoaded', () => {
  const promptEl = document.getElementById('prompt');
  const confidenceEl = document.getElementById('confidence');
  const sliderValEl = document.getElementById('slider-val');
  const statusEl = document.getElementById('status');
  const enableToggle = document.getElementById('enableToggle');

  // Load existing data from storage
  browser.storage.local.get(['targetPrompt', 'aiConfidence', 'isEnabled']).then((res) => {
    if (res.targetPrompt) promptEl.value = res.targetPrompt;
    if (res.aiConfidence) {
      confidenceEl.value = res.aiConfidence;
      sliderValEl.innerText = `${res.aiConfidence}%`;
    }
    if (res.isEnabled !== undefined) {
      enableToggle.checked = res.isEnabled;
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
    browser.storage.local.set({ targetPrompt: value, aiConfidence: conf, isEnabled: enableToggle.checked }).then(() => {
      
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
