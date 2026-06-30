async function scanAndHighlight() {
  const paragraphs = document.querySelectorAll('p');

  for (const p of paragraphs) {
    const text = p.innerText.trim();
    
    // Skip empty or very short paragraphs
    if (text.length < 15) continue;

    try {
      console.log(`[AI Sniper] Sending text to background: "${text.substring(0, 50)}..."`);
      // Send the text to our background script
      const response = await browser.runtime.sendMessage({
        action: 'analyzeText',
        text: text
      });
      
      console.log(`[AI Sniper] Received response:`, response);

      if (response && response.success) {
        // 'Xenova/distilbert-base-uncased-finetuned-sst-2-english' returns e.g. [{ label: 'POSITIVE', score: 0.99 }]
        const results = response.data;
        const isMatch = results.some(r => r.label === 'POSITIVE' && r.score > 0.80);

        if (isMatch) {
          console.log("[AI Sniper] Highlighting paragraph!");
          // Highlight the content
          p.style.setProperty('background-color', '#ccffcc', 'important');
          p.style.setProperty('border-left', '4px solid #00ff00', 'important');
          p.style.setProperty('padding-left', '8px', 'important');
          p.style.transition = 'background-color 0.3s ease';
        }
      } else if (response && !response.success) {
        console.error("[AI Sniper] Background script returned error:", response.error);
      }
    } catch (err) {
      console.error("[AI Sniper] Error analyzing text:", err);
    }
  }
}

// Run the scan when the page loads
scanAndHighlight();
