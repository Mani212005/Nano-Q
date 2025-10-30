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
  
  // ===== Main Control Flow =====
  async function summarizeAndVisualize() {
    document.getElementById("log").textContent = "";
    const inputText = document.getElementById("input-text").value.trim();
  
    if (!inputText) {
      alert("Please paste some text first!");
      return;
    }
  
    log("🚀 Starting summarization...");
  
    const meta = await generateMetaPrompt(inputText);
    if (!meta) return;
  
    const chartData = await extractChartData(inputText, meta.optimized_prompt);
    if (!chartData) return;
  
    renderChart(meta.chart_type_suggestion, chartData);
    log("✅ Visualization complete!");
  }
  