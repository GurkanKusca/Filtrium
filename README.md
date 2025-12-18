# Filtrium: Local AI Content Filter

Filtrium is a privacy-focused browser extension designed to filter unwanted visual content on X (formerly Twitter) using local Artificial Intelligence models.

Unlike cloud-based solutions, Filtrium performs all image (CLIP) and video (X-CLIP) analysis directly on your local machine using a Python backend. This ensures that your browsing data never leaves your computer.

## Architecture & Features

* **Local Processing:** Powered by a local Flask server running PyTorch models.
* **Image Analysis:** Utilizes OpenAI's CLIP model for semantic image understanding.
* **Video Analysis:** Implements Microsoft's X-CLIP model for frame-by-frame video sampling.
* **Dynamic Sensitivity:** Users can adjust filtering strictness (Low, Normal, High) for each keyword individually.
* **Modern Interface:** A clean, native-feeling user interface designed to match the "Lights Out" dark mode of X.

## Prerequisites

Before installing, ensure you have the following installed on your system:

* **Python 3.8** or higher.
* **Google Chrome** (or any Chromium-based browser like Brave or Edge).

---

## Installation Guide

### 1. Setup the Backend Server

The backend handles the AI processing. We have provided automated scripts to set up the environment and install necessary dependencies (PyTorch, Transformers, Flask, etc.).

**For Windows Users:**
1.  Navigate to the project folder.
2.  Double-click the `start_backend.bat` file.
3.  Wait for the installation to complete. The first run may take some time as it downloads the AI models.
4.  Once the terminal displays **"Running on http://127.0.0.1:5000"**, the server is ready. Keep this window open.

**For Linux / macOS Users:**
1.  Open a terminal in the project directory.
2.  Grant execution permissions:
    ```bash
    chmod +x start_backend.sh
    ```
3.  Run the script:
    ```bash
    ./start_backend.sh
    ```

### 2. Install the Browser Extension

1.  Open your browser and navigate to `chrome://extensions`.
2.  Enable **Developer mode** using the toggle switch in the top-right corner.
3.  Click the **Load unpacked** button in the top-left corner.
4.  Select the project folder (the directory containing `manifest.json`).

---

## Usage

1.  Ensure the backend server is running (the terminal window from Step 1).
2.  Navigate to X (Twitter).
3.  Click the Filtrium extension icon in your browser toolbar.
4.  **Add a Filter:** Enter a keyword (e.g., `spiders`, `gore`, `violence`) and click **Add**.
5.  **Adjust Sensitivity:** Use the slider next to the keyword to define the threshold:
    * **Level 1 (Low):** Only blocks content with very high confidence (Strict precision).
    * **Level 2 (Normal):** Balanced filtering.
    * **Level 3 (High):** Blocks content with lower confidence threshold (Aggressive filtering).
6.  Click **Save & Apply**. The page will verify the connection and apply filters immediately.

## Troubleshooting

**Backend Connection Error:**
If the extension reports a connection error, ensure that the `start_backend.bat` (or `.sh`) script is running and the terminal window is open.

**Performance:**
Video analysis requires significant processing power. If filtering feels slow, ensure your system meets the requirements for running PyTorch models.

## License

This project is open-source and available for personal use.
