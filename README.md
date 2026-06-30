<div align="center">
  <h1>🦊 Neural Find</h1>
  <p><strong>A Next-Generation, 100% Offline AI Search Extension for Firefox</strong></p>

  <p>
    <img src="https://img.shields.io/badge/Firefox-FF7139?style=for-the-badge&logo=Firefox-Browser&logoColor=white" alt="Firefox" />
    <img src="https://img.shields.io/badge/WebAssembly-654FF0?style=for-the-badge&logo=WebAssembly&logoColor=white" alt="WebAssembly" />
    <img src="https://img.shields.io/badge/WebGPU-00599C?style=for-the-badge&logo=webgl&logoColor=white" alt="WebGPU" />
    <img src="https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge" alt="License" />
  </p>
</div>

<br />

## 🚀 What is Neural Find?
**Neural Find** (formerly *AI Content Sniper*) is a revolutionary Firefox Manifest V3 browser extension that brings the power of Hugging Face transformer models directly into your browser. Instead of using standard `CTRL+F` keyword matching, Neural Find uses **Zero-Shot AI Classification** to read, understand, and highlight paragraphs on any webpage based on *semantic meaning*.

Best of all? **It runs 100% locally on your machine.** No API keys. No cloud servers. Complete privacy.

---

## ✨ Key Features
- **🧠 Semantic AI Search**: Search by context and meaning, not just exact keywords.
- **⚡ Hardware Acceleration (WebGPU)**: Offloads intense AI mathematical computations directly to your graphics card.
- **🛡️ Auto-Healing Fallback**: If your GPU driver crashes, the AI instantly heals itself and falls back to CPU (WASM) mode without interrupting your workflow.
- **📌 Persistent Popout UI**: Pin the control panel to your screen. As you switch between browser tabs, the AI instantly and seamlessly scans the new page automatically!
- **🔒 Zero Data Collection**: We do not send a single byte of your data to the cloud. The AI model lives entirely inside the extension package.

---

## 🛠️ Technology Stack
*   **Engine:** [@huggingface/transformers.js](https://huggingface.co/docs/transformers.js/index)
*   **Model:** `Xenova/mobilebert-uncased-mnli` (Optimized for speed and accuracy)
*   **Execution:** ONNX Runtime Web (`onnxruntime-web`)
*   **Build Tool:** `esbuild` for extreme minification

---

## 📦 How to Install (Developer Mode)

1. Clone this repository:
   ```bash
   git clone https://github.com/clevra/NeuralFind.git
   cd NeuralFind
   ```
2. Open Firefox and navigate to `about:debugging`.
3. Click on **This Firefox** in the sidebar.
4. Click **Load Temporary Add-on...**
5. Select the `manifest.json` file inside the `NeuralFind` folder.
6. Click the 🦊 icon in your toolbar to start searching!

---

## 🏗️ Building for Production
If you wish to compile and package the extension for the Mozilla Add-on Store:
```bash
# This script bundles all assets and generates the iq-fox-addon.zip file
./package.sh
```
*Note: Due to strict Mozilla Content Security Policies (CSP), the `package.sh` script actively bundles all `wasm/` binaries locally. Dynamic remote CDNs are strictly prohibited by Firefox.*

---

## 📝 License
This project itself is licensed under the **MIT License**.

**Third-Party Licenses:**
- `Transformers.js` is licensed under Apache 2.0.
- `ONNX Runtime Web` is licensed under MIT.
- `MobileBERT MNLI` model weights are licensed under Apache 2.0.
*(See `THIRD-PARTY-LICENSES.txt` for the full text).*

<div align="center">
  <i>Built with ❤️ for privacy-conscious power users.</i>
</div>
