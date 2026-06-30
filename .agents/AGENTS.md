# AI Context & Developer Notes for IQ-Fox (AI Content Sniper)

**Hello Future-Self!** 👋
If you are reading this, you have been tasked with maintaining or extending this Firefox Manifest V3 browser extension. Please read this file *carefully* before making architectural changes, as we have fought some brutal battles against Manifest V3 and Firefox security policies to get this working.

## 🏗️ Architecture Overview
*   **Background Script (`background.js`)**: Runs the `transformers.js` inference engine. It stays alive in the background and processes messages. Must be bundled with `esbuild`.
*   **Content Script (`content.js`)**: Parses the DOM (`p, a, h1, etc.`), sends text chunks to the background script, and injects yellow highlighters (`.ai-highlighted`) and a floating Jump Widget.
*   **Popup UI (`popup.html` / `popup.js`)**: The user control panel. Contains a GPU toggle, a Confidence slider, and a "Pin" (Popout) button.

## ⚠️ Critical Constraints & Lessons Learned

### 1. The Manifest V3 CSP & Transformers.js Nightmare
By default, `transformers.js` dynamically imports helper files (like `ort-wasm-simd-threaded.asyncify.mjs`) from a remote JSDelivr CDN. **Manifest V3's strict Content Security Policy instantly blocks all remote dynamic imports**, crashing the entire AI engine!
**The Solution:**
*   We have physically downloaded all ONNX `.wasm` and `.mjs` helper files into the local `wasm/` directory.
*   In `background.js`, you **MUST** set: `env.backends.onnx.wasm.wasmPaths = browser.runtime.getURL('wasm/');`
*   In `manifest.json`, you **MUST** expose this directory: `"web_accessible_resources": [{ "resources": ["wasm/*"], "matches": ["<all_urls>"] }]`
*   *Do not delete or overwrite these configurations!*

### 2. Hardware Acceleration (WebGPU vs CPU)
WebGPU is fast but extremely brittle on certain user graphics drivers (crashing during buffer allocation).
*   We implemented a **GPU/CPU Toggle** in the popup.
*   `background.js` attempts to initialize `{ device: 'webgpu' }`. If it crashes, it **auto-heals** by catching the error and falling back to `{ device: 'wasm' }` (CPU).
*   The actual hardware that successfully loads is saved to `browser.storage.local` (`activeDevice`), which the popup constantly watches via `browser.storage.onChanged` to update the UI status text.

### 3. The Firefox Popup Blocker & Pinned Windows
Users wanted the extension popup to stay open while they browse (Pinned). Since standard popups close when they lose focus, we added a 📌 button to spawn a dedicated mini-window.
**The Trap:**
*   If you use an asynchronous function (like `await browser.windows.getCurrent()`) inside the button's click handler before calling `browser.windows.create`, **Firefox's spam popup blocker will silently destroy the window** because it considers the "direct user action" context expired.
**The Solution:**
*   `popup.js` calculates its physical screen coordinates synchronously (`window.screenX`, `window.screenY`).
*   It immediately sends a message (`openPopout`) to `background.js`.
*   `background.js` executes `browser.windows.create`, safely bypassing the popup blocker.

### 4. Manifest Syntax Trap
*   Do **NOT** add `"windows"` to the `permissions` array in `manifest.json`. Firefox Manifest V3 throws a fatal syntax error if you do. `browser.windows` works perfectly fine without it.

### 5. Cross-Tab Auto-Scanning
When the popup is pinned into a persistent window, it stays alive forever.
*   We utilize this by having `popup.js` listen to `browser.tabs.onActivated` and `browser.tabs.onUpdated`.
*   When the user switches tabs, the persistent popup instantly sends a `triggerScan()` command to the new tab!

## 🛠️ Build Instructions
Whenever you modify `background.js`, you **MUST** rebuild it using esbuild before testing:
```bash
npx esbuild background.js --bundle --outfile=background.bundle.js --format=esm
```

Good luck, and don't break the WASM paths! 🦊
