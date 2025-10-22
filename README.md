Nano Visual Summarizer: Two-Stage Meta-Prompting

A demonstration project for the Google Chrome Built-in AI Challenge.

This application showcases an innovative, two-stage Meta-Prompting Pipeline powered entirely by Gemini Nano via the Chrome Prompt API. The core function is to transform a large block of text into a structured, visual chart (Bar, Pie, or Line chart) for quick, on-device data insight.

The key innovation is using Gemini Nano not just to summarize, but to first analyze the input text and generate an optimized prompt (Stage 1), and then execute that optimized prompt for highly reliable structured data extraction (Stage 2).

💡 Core Innovation: Two-Stage Meta-Prompting

The solution minimizes the risk of receiving unreliable, unstructured text by splitting the task into two highly controlled steps:

Stage 1 (Analysis): Gemini Nano analyzes the raw text, determines the best chart type (bar, pie, or line), and writes a perfectly optimized instruction prompt for the next step.

Stage 2 (Extraction): The system submits the Nano-generated prompt along with a strict JSON Schema constraint. This guarantees a clean, machine-readable JSON object suitable for charting.

This entire process occurs on-device within the browser, ensuring maximum privacy, low latency, and network resiliency.

📁 Project Structure

This repository contains two working versions of the summarizer:

/nano-summarizer-website: A single-file HTML application (main.html) served over a local HTTP server. This is the simplest way to run the code.

/nano-summarizer-extension: A full Chrome Extension implementation that loads the summarizer in a toolbar pop-up window. This demonstrates maximum platform integration.

🛠️ Prerequisites (Crucial for Testing)

To run EITHER version, the testing browser (Google Chrome) must be configured to enable the experimental on-device AI features:

Enable Flags (MANDATORY): Navigate to chrome://flags and search for keywords like "Gemini," "Nano," and "built-in." Set all relevant flags (especially the Prompt API flag) to Enabled. Then, relaunch the browser.

Minimum Required Flag: chrome://flags/#prompt-api-for-gemini-nano-multimodal-input

Check Model Status (Optional but Recommended): You can check the status of the downloaded models here:

chrome://on-device-internals

🚀 Running the Web Application (Easiest)

The standalone version is the quickest way to test the core logic.

Navigate: Go to the /nano-summarizer-website directory.

Serve Locally (MANDATORY): Due to Chrome's security model, the model-execution feature only works over HTTP (not a file:// path).

The quickest way to start a server: Open a terminal in the /nano-summarizer-website directory and run: python3 -m http.server

Access: Open your browser to http://localhost:8000/main.html.

Test: Paste text and click "Generate Visual Summary (2 Stages)."

⚙️ Running the Chrome Extension

This method showcases deeper integration with the Chrome platform.

Get Files: Clone the repository and navigate to the /nano-summarizer-extension folder.

Note: The extension is designed to run without needing separate icon files.

Load Extension:

Open Chrome and go to chrome://extensions.

Enable Developer mode (top right corner).

Click the "Load unpacked" button.

Select the entire /nano-summarizer-extension folder.

Test: An extension icon will appear in your toolbar. Click it, paste the text, and generate the chart. The necessary model-execution permission is handled directly in the manifest.json.
