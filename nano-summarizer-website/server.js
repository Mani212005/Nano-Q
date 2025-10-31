// ===== server.js =====
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 9000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); // Serve static files from the current directory

// API Endpoints
app.post("/api/v1/visualize", (req, res) => {
  console.log("Received visualization request:", req.body);
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: "'text' field is required in the request body." });
  }

  // Call the Python script
  const pythonProcess = spawn('python3', ['gemini_viz.py', text]);

  let pythonOutput = '';
  let pythonError = '';

  pythonProcess.stdout.on('data', (data) => {
    pythonOutput += data.toString();
  });

  pythonProcess.stderr.on('data', (data) => {
    pythonError += data.toString();
  });

  pythonProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(`Python script exited with code ${code}: ${pythonError}`);
      return res.status(500).json({ error: 'Failed to generate visualization.', details: pythonError });
    }

    try {
      const parsedData = JSON.parse(pythonOutput);
      console.log("Visualization data from Python:", parsedData.title);
      res.status(200).json(parsedData);
    } catch (e) {
      console.error("Failed to parse JSON from Python script:", e, "Output:", pythonOutput);
      res.status(500).json({ error: 'Invalid JSON response from Python script.', details: pythonOutput });
    }
  });
});

app.post("/api/v1/visualize-csv", (req, res) => {
  console.log("Received CSV visualization request:", req.body);
  const { csv_content } = req.body;

  if (!csv_content) {
    return res.status(400).json({ error: "'csv_content' field is required in the request body." });
  }

  // Call the Python script with CSV content
  const pythonProcess = spawn('python3', ['gemini_viz.py', "--csv", csv_content]);

  let pythonOutput = '';
  let pythonError = '';

  pythonProcess.stdout.on('data', (data) => {
    pythonOutput += data.toString();
  });

  pythonProcess.stderr.on('data', (data) => {
    pythonError += data.toString();
  });

  pythonProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(`Python script exited with code ${code}: ${pythonError}`);
      return res.status(500).json({ error: 'Failed to generate CSV visualization.', details: pythonError });
    }

    try {
      const parsedData = JSON.parse(pythonOutput);
      console.log("CSV Visualization data from Python:", parsedData.title);
      res.status(200).json(parsedData);
    } catch (e) {
      console.error("Failed to parse JSON from Python script:", e, "Output:", pythonOutput);
      res.status(500).json({ error: 'Invalid JSON response from Python script.', details: pythonOutput });
    }
  });
});

app.post("/api/v1/ask", (req, res) => {
  console.log("Received Q&A request:", req.body);
  const { text, question } = req.body;

  if (!text || !question) {
    return res.status(400).json({ error: "'text' and 'question' fields are required in the request body." });
  }

  // Call the Python script
  const pythonProcess = spawn('python3', ['gemini_qa.py', text, question]);

  let pythonOutput = '';
  let pythonError = '';

  pythonProcess.stdout.on('data', (data) => {
    pythonOutput += data.toString();
  });

  pythonProcess.stderr.on('data', (data) => {
    pythonError += data.toString();
  });

  pythonProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(`Python script exited with code ${code}: ${pythonError}`);
      return res.status(500).json({ error: 'Failed to get answer from Gemini.', details: pythonError });
    }

    try {
      const parsedData = JSON.parse(pythonOutput);
      console.log("Answer from Gemini:", parsedData);
      res.status(200).json(parsedData);
    } catch (e) {
      console.error("Failed to parse JSON from Python script:", e, "Output:", pythonOutput);
      res.status(500).json({ error: 'Invalid JSON response from Gemini.', details: pythonOutput });
    }
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});