// ===== Helper: Create model instance =====
async function getModel(systemPrompt) {
    try {
      const model = await ai.languageModel.create({ systemPrompt });
      return model;
    } catch (err) {
      log(`❌ Error initializing model: ${err.message}`);
      return null;
    }
  }
  
  // ===== Stage 1: Generate Meta-Prompt =====
  async function generateMetaPrompt(inputText) {
    const model = await getModel(`
      You are a meta-prompt generator.
      Your job is to analyze input text and decide:
      1. The best chart type to visualize it (bar, pie, or line).
      2. A concise (<=50 words) optimized summarization prompt.
      Respond in this JSON format:
      {
        "chart_type_suggestion": "<bar|pie|line>",
        "optimized_prompt": "<prompt text>"
      }
    `);
  
    if (!model) return null;
  
    const session = await model.startChat();
    const response = await session.sendMessage(inputText);
    const reply = await response.response.text();
  
    log("🧩 Meta-Prompt Output:\n" + reply);
  
    try {
      return JSON.parse(reply);
    } catch {
      log("⚠️ Model returned invalid JSON at Stage 1.");
      return null;
    }
  }
  
  // ===== Stage 2: Extract Structured Chart Data =====
  async function extractChartData(inputText, optimizedPrompt) {
    const model = await getModel(`
      You are a summarization model that outputs JSON for chart visualization.
      You will receive a user prompt (guiding instruction) and a long text.
      Return data in this exact structure:
      {
        "title": "<short summary title>",
        "data_points": [
          {"label": "<category/topic>", "value": <number>, "summary": "<one-line summary>"}
        ]
      }
    `);
  
    if (!model) return null;
  
    const session = await model.startChat();
    const response = await session.sendMessage(`
      PROMPT: ${optimizedPrompt}
      TEXT: ${inputText}
    `);
  
    const reply = await response.response.text();
  
    log("📊 Extracted Data:\n" + reply);
  
    try {
      return JSON.parse(reply);
    } catch {
      log("⚠️ Model returned invalid JSON at Stage 2.");
      return null;
    }
  }
  
  // ===== Stage 3: Render Chart =====
  function renderChart(chartType, chartData) {
    const ctx = document.getElementById("summary-chart").getContext("2d");
    if (window.chartInstance) window.chartInstance.destroy();
  
    const labels = chartData.data_points.map(d => d.label);
    const values = chartData.data_points.map(d => d.value);
  
    window.chartInstance = new Chart(ctx, {
      type: chartType,
      data: {
        labels,
        datasets: [{
          label: chartData.title,
          data: values,
          borderWidth: 2,
          backgroundColor: "rgba(37,99,235,0.4)",
          borderColor: "rgb(37,99,235)"
        }]
      },
      options: {
        responsive: true,
        plugins: {
          tooltip: {
            callbacks: {
              afterLabel: (ctx) => chartData.data_points[ctx.dataIndex].summary
            }
          },
          legend: { display: false },
          title: {
            display: true,
            text: chartData.title,
            font: { size: 18 }
          }
        }
      }
    });
  }
  
  // ===== Logging Helper =====
  function log(message) {
    const logDiv = document.getElementById("log");
    logDiv.textContent += message + "\n\n";
  }
  
  let currentCsvContent = null; // Global variable to store the current CSV content

  // ===== Helper: Handle CSV Upload =====
  function handleCsvUpload(event) {
    const file = event.target.files[0];
    if (!file) {
      currentCsvContent = null;
      document.getElementById("csv-file-name").textContent = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      alert("File size exceeds 5MB limit.");
      currentCsvContent = null;
      document.getElementById("csv-file-name").textContent = "";
      return;
    }

    document.getElementById("csv-file-name").textContent = `Selected file: ${file.name}`;

    const reader = new FileReader();
    reader.onload = (e) => {
      currentCsvContent = e.target.result;
      log(`CSV file loaded: ${file.name}`);
    };
    reader.onerror = (e) => {
      log(`❌ Error reading CSV file: ${e.target.error}`);
      currentCsvContent = null;
      document.getElementById("csv-file-name").textContent = "";
    };
    reader.readAsText(file);
  }

  // ===== Main Control Flow =====
  async function summarizeAndVisualize() {
    document.getElementById("log").textContent = "";
    
    if (!currentCsvContent) {
      alert("Please upload a CSV file first!");
      return;
    }

    log("🚀 Starting visualization...");

    const apiUrl = "http://localhost:9000/api/v1/visualize-csv";
    const requestBody = { csv_content: currentCsvContent };

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        log(`❌ Backend Error (${response.status}): ${errorText}`);
        console.error("Backend Error Response:", errorText);
        return;
      }

      const data = await response.json();

      if (data.error) {
        log(`❌ Error from backend: ${data.error}`);
        return;
      }

      const visualizationImage = document.getElementById("summary-visualization");
      visualizationImage.src = `data:image/png;base64,${data.image}`;
      visualizationImage.alt = data.title;
      log("✅ Visualization complete!");

    } catch (error) {
      log(`❌ Error generating visualization: ${error.message}`);
      console.error("Error generating visualization:", error);
    }
  }

  // ===== Question Answering Function =====
  async function askQuestionAboutText() {
    const questionInput = document.getElementById("question-input").value.trim();
    const answerDisplay = document.getElementById("answer-display");
    const qaModelStatus = document.getElementById("qa-model-status");

    answerDisplay.textContent = "";
    qaModelStatus.textContent = "";

    if (!currentCsvContent) {
      alert("Please upload and visualize a CSV file first before asking a question!");
      return;
    }

    if (!questionInput) {
      alert("Please enter a question!");
      return;
    }

    answerDisplay.textContent = "Asking question...";

    let answer = null;
    let usedModel = "Gemini Cloud";

    // 1️⃣ Try to use Gemini Nano (Prompt API)
    if (window.ai && window.ai.languageModel) {
      try {
        qaModelStatus.textContent = "Attempting to use Gemini Nano (on-device) for Q&A...";
        const session = await window.ai.languageModel.create({
          systemPrompt: "You are a helpful assistant. Answer the user's question based ONLY on the provided CSV data. If the answer is not in the data, state that you don't know."
        });

        const nanoResponse = await session.prompt(`CSV Data: ${currentCsvContent}\nQuestion: ${questionInput}`);
        console.log("Nano Q&A response:", nanoResponse);
        answer = nanoResponse;
        usedModel = "Gemini Nano";
      } catch (err) {
        console.warn("Nano Q&A failed, falling back to server:", err);
        qaModelStatus.textContent = "Gemini Nano not available or failed for Q&A. Falling back to Gemini Cloud...";
      }
    }

    // 2️⃣ Fallback: Call your Express backend (Gemini 1.5)
    if (!answer) {
      try {
        const response = await fetch("http://localhost:9000/api/v1/ask", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ csv_content: currentCsvContent, question: questionInput }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          qaModelStatus.textContent = `❌ Backend Error (${response.status}): ${errorText}`;
          console.error("Backend Error Response:", errorText);
          return;
        }

        const data = await response.json();
        answer = data.answer;
      } catch (error) {
        answerDisplay.textContent = "Error asking question to backend: " + error.message;
        console.error("Error asking question to backend:", error);
        qaModelStatus.textContent = "Error: Backend Q&A call failed.";
        return;
      }
    }

    answerDisplay.textContent = "Answer (via " + usedModel + "):\n" + answer;
    qaModelStatus.textContent = "Using: " + usedModel;
    console.log("Final Q&A Answer:", answer);
  }