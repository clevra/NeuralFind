import { pipeline, env } from '@huggingface/transformers';

// Tell Transformers.js to load WASM files from our local extension directory
// instead of dynamically fetching them from JSDelivr!
env.backends.onnx.wasm.wasmPaths = browser.runtime.getURL('wasm/');
if (typeof globalThis.SharedArrayBuffer !== 'undefined') {
  globalThis.SharedArrayBuffer = undefined;
}

// Prevent library from looking for local model files
env.allowLocalModels = false;

// Disable multi-threading to prevent ONNX from injecting remote Web Worker scripts
// This is strictly required to comply with Firefox Extension Manifest V3 CSP rules.
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.proxy = false; // Disable web workers completely
env.backends.onnx.wasm.simd = false; // Disable SIMD just in case it triggers the threaded asyncify path

let classifierPipeline = null;

// Lazy load the model only when it's first needed
async function getPipeline() {
  if (!classifierPipeline) {
    console.log("[AI Background] Initializing AI model...");
    
    // Read the user's preference from storage
    const storage = await browser.storage.local.get('useGPU');
    const useGPU = storage.useGPU === true;
    
    try {
      console.log(`[AI Background] Loading model on ${useGPU ? 'WebGPU' : 'WebAssembly (CPU)'}...`);
      
      const config = useGPU ? { device: 'webgpu' } : { device: 'wasm' };
      classifierPipeline = await pipeline(
        'zero-shot-classification', 
        'Xenova/mobilebert-uncased-mnli',
        config
      );
      
      console.log(`[AI Background] AI model loaded successfully on ${useGPU ? 'WebGPU' : 'WASM'}!`);
      // Update storage so the UI knows what actually loaded
      await browser.storage.local.set({ activeDevice: useGPU ? 'webgpu' : 'wasm' });
    } catch (err) {
      console.error("[AI Background] Model loading failed! Falling back to safe CPU mode...", err);
      // Auto-fallback if WebGPU fails initialization
      classifierPipeline = await pipeline(
        'zero-shot-classification', 
        'Xenova/mobilebert-uncased-mnli',
        { device: 'wasm' }
      );
      // Update storage so the UI knows we fell back to WASM
      await browser.storage.local.set({ activeDevice: 'wasm', useGPU: false });
    }
  }
  return classifierPipeline;
}

// Listen for messages from our content script and popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openPopout') {
    (async () => {
      try {
        const width = 340;
        const height = 480;

        await browser.windows.create({
          url: browser.runtime.getURL("popup.html?popped=1"),
          type: "popup",
          width: width,
          height: height,
          left: message.left,
          top: message.top
        });
        sendResponse({ success: true });
      } catch (err) {
        console.error("Failed to open popout:", err);
        sendResponse({ success: false });
      }
    })();
    return true; // async response
  }
  
  if (message.action === 'resetPipeline') {
    console.log("[AI Background] Resetting AI Pipeline to switch hardware backends...");
    // Destroy the old pipeline and force a clean re-initialization
    if (classifierPipeline) {
      classifierPipeline.dispose?.();
    }
    classifierPipeline = null;
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'analyzeText') {
    // Run the model asynchronously and return the result
    (async () => {
      try {
        const startTime = performance.now();
        const classifier = await getPipeline();
        
        // Pass the prompt dynamically as the "label" we are looking for
        const output = await classifier(message.text, [message.prompt]);
        
        const endTime = performance.now();
        
        // Check which device is actually active right now
        const storage = await browser.storage.local.get('activeDevice');
        const currentDevice = storage.activeDevice || 'unknown';
        
        sendResponse({ 
          success: true, 
          data: output, 
          device: currentDevice,
          timeMs: Math.round(endTime - startTime)
        });
      } catch (error) {
        console.error("[AI Background] Error during analysis:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    
    // Return true to indicate we will send the response asynchronously
    return true; 
  }
});