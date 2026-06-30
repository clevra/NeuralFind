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
    console.log("[AI Background] Initializing AI model (this may take a moment on first run)...");
    
    // We MUST force WASM (CPU) immediately.
    // Attempting to use WebGPU in a Manifest V3 extension triggers ONNX Runtime 
    // to dynamically import the 'asyncify.mjs' module from jsdelivr. 
    // Firefox's strict Content Security Policy (CSP) instantly blocks dynamic 
    // cross-origin imports, which completely crashes the backend!
    classifierPipeline = await pipeline(
      'zero-shot-classification', 
      'Xenova/mobilebert-uncased-mnli'
    );
    console.log("[AI Background] AI model loaded successfully on WebAssembly (CPU)!");
  }
  return classifierPipeline;
}

// Listen for messages from our content script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'analyzeText') {
    // Run the model asynchronously and return the result
    (async () => {
      try {
        const classifier = await getPipeline();
        
        // Pass the prompt dynamically as the "label" we are looking for
        const output = await classifier(message.text, [message.prompt]);
        
        sendResponse({ success: true, data: output });
      } catch (error) {
        console.error("[AI Background] Error during analysis:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    
    // Return true to indicate we will send the response asynchronously
    return true; 
  }
});