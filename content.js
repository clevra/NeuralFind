let targetPrompt = "";
let aiConfidence = 0.60;
let highlightedElements = [];
let currentHighlightIndex = -1;

async function scanAndHighlight() {
  const res = await browser.storage.local.get(['targetPrompt', 'aiConfidence', 'isEnabled']);
  if (res.isEnabled === false) return; // Abort if disabled!
  if (!res.targetPrompt) return;
  
  targetPrompt = res.targetPrompt;
  // Convert 0-100 slider value to 0.0-1.0 score requirement
  aiConfidence = (res.aiConfidence !== undefined) ? (res.aiConfidence / 100) : 0.60;
  highlightedElements = [];
  currentHighlightIndex = -1;

  // Scan block elements and links (removed 'span' to prevent highlighting random single words)
  const elements = document.querySelectorAll('p, a, li, h1, h2, h3, h4, h5, button');

  // Process elements with a strict concurrency limit to avoid crashing the browser!
  const concurrencyLimit = 1; // Safest possible setting for memory
  const activeRequests = new Set();

  for (const p of elements) {
    const text = p.innerText.trim();
    
    // Replace multiple spaces and newlines with a single space to clean up the text
    const cleanText = text.replace(/\s+/g, ' ');
    
    // Focus purely on Concepts and Context!
    // Skip anything that has fewer than 5 actual words.
    const wordCount = cleanText.split(' ').filter(w => w.length > 0).length;
    
    if (wordCount < 5 || cleanText.length > 1000 || p.classList.contains('ai-highlighted')) {
      continue;
    }
    
    // Skip if the text is purely a Date or Time (e.g., "June 30, 2026")
    if (cleanText.length < 30 && !isNaN(Date.parse(cleanText))) {
      continue;
    }

    // Skip elements that are part of the navigation, header, footer, or sidebars to save energy
    if (p.closest('nav, header, footer, aside, .menu, .sidebar, #sidebar, .widget')) {
      continue;
    }

    const requestPromise = (async () => {
      try {
        // Send the text and the prompt to our background script
        const response = await browser.runtime.sendMessage({
          action: 'analyzeText',
          text: cleanText,
          prompt: targetPrompt
        });
        
        if (response && response.success) {
          const score = response.data.scores[0]; 
          
          // Log exactly what happened directly to the user's web page console!
          console.log(`[AI Content Sniper] 🤖 Hardware: [${response.device.toUpperCase()}] | Time: ${response.timeMs}ms | Score: ${(score * 100).toFixed(1)}% | Text: "${cleanText.substring(0, 40)}..."`);

          // Check the score against the user's custom Confidence Slider setting!
          if (score > aiConfidence) {
            // Highlight the content with a simple background to prevent messy nested frames
            p.classList.add('ai-highlighted');
            
            // Apply a simple bright yellow highlight marker style
            p.style.setProperty('background-color', '#ffeb3b', 'important'); // Classic Yellow
            p.style.setProperty('color', '#000000', 'important');
            p.style.transition = 'background-color 0.3s ease';
            
            highlightedElements.push(p);
            
            // Instantly update the widget as soon as a match is found!
            // Sort them vertically so the jump buttons work logically even while scanning
            highlightedElements.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
            createOrUpdateWidget();
          }
        }
      } catch (err) {
        // Ignore errors for individual elements
      }
    })();

    // Add to pool and remove when done
    activeRequests.add(requestPromise);
    requestPromise.finally(() => activeRequests.delete(requestPromise));

    // Pause if we hit the limit
    if (activeRequests.size >= concurrencyLimit) {
      await Promise.race(activeRequests);
    }
  }
  
  // Wait for the remaining requests to finish
  await Promise.all(activeRequests);
  
  // Final sort just to be absolutely sure they are in perfect vertical order
  highlightedElements.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
  
  // Update the widget one last time in case no matches were found (to ensure it stays hidden)
  createOrUpdateWidget();
}

function createOrUpdateWidget() {
  let widget = document.getElementById('ai-sniper-widget');
  
  // If no matches, remove widget
  if (highlightedElements.length === 0) {
    if (widget) widget.remove();
    return;
  }
  
  if (!widget) {
    widget = document.createElement('div');
    widget.id = 'ai-sniper-widget';
    // Premium dark-mode floating widget
    widget.style.cssText = `
      position: fixed;
      bottom: 30px;
      right: 30px;
      background: #1a1a24;
      color: white;
      padding: 12px 16px;
      border-radius: 12px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.5);
      z-index: 2147483647;
      display: flex;
      align-items: center;
      gap: 15px;
      font-family: sans-serif;
      font-size: 14px;
      border: 1px solid #3f3f5a;
    `;
    
    const countText = document.createElement('span');
    countText.id = 'ai-sniper-count';
    countText.style.fontWeight = 'bold';
    
    const btnStyle = `
      background: linear-gradient(135deg, #60a5fa, #2563eb);
      color: white;
      border: none;
      border-radius: 6px;
      width: 32px;
      height: 32px;
      cursor: pointer;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
      font-size: 12px;
    `;
    
    const upBtn = document.createElement('button');
    upBtn.innerHTML = '▲';
    upBtn.style.cssText = btnStyle;
    upBtn.onclick = () => jumpToHighlight(-1);
    
    const downBtn = document.createElement('button');
    downBtn.innerHTML = '▼';
    downBtn.style.cssText = btnStyle;
    downBtn.onclick = () => jumpToHighlight(1);
    
    widget.appendChild(countText);
    widget.appendChild(upBtn);
    widget.appendChild(downBtn);
    document.body.appendChild(widget);
  }
  
  const countText = document.getElementById('ai-sniper-count');
  if (countText) {
    countText.innerText = `${highlightedElements.length} Match${highlightedElements.length !== 1 ? 'es' : ''} Found`;
  }
}

function jumpToHighlight(direction) {
  if (highlightedElements.length === 0) return;
  
  currentHighlightIndex += direction;
  
  if (currentHighlightIndex < 0) {
    currentHighlightIndex = highlightedElements.length - 1; // loop to bottom
  } else if (currentHighlightIndex >= highlightedElements.length) {
    currentHighlightIndex = 0; // loop to top
  }
  
  const el = highlightedElements[currentHighlightIndex];
  
  // Create a cool blue pulsing ring effect when jumping to it
  const originalOutline = el.style.outline;
  const originalOffset = el.style.outlineOffset;
  
  el.style.outline = "4px solid #3b82f6";
  el.style.outlineOffset = "4px";
  
  setTimeout(() => {
    el.style.outline = originalOutline;
    el.style.outlineOffset = originalOffset;
  }, 1200);

  // Smoothly scroll the page so the element is perfectly in the center of the screen
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function clearHighlightsAndWidget() {
  const highlighted = document.querySelectorAll('.ai-highlighted');
  for (const p of highlighted) {
    p.classList.remove('ai-highlighted');
    p.style.removeProperty('background-color');
    p.style.removeProperty('color');
  }
  
  const widget = document.getElementById('ai-sniper-widget');
  if (widget) widget.remove();
  
  highlightedElements = [];
  currentHighlightIndex = -1;
}

// Listen for the "rescan" or "toggle" message from the popup
browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'rescan') {
    clearHighlightsAndWidget();
    scanAndHighlight();
    sendResponse({ success: true });
  } else if (msg.action === 'toggle') {
    if (msg.state === false) {
      clearHighlightsAndWidget();
    } else {
      scanAndHighlight();
    }
    sendResponse({ success: true });
  }
  return true; // Keep channel open
});

// Run the scan when the page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', scanAndHighlight);
} else {
  scanAndHighlight();
}
