// Check for the mandatory Chrome Built-in AI API
const AI_API_AVAILABLE = ('LanguageModel' in window);

// --- SCHEMAS (Defined as the Blueprint for Gemini Nano) ---

// Stage 1 Schema: Output for the Meta-Prompt (The instruction generator)
const META_PROMPT_SCHEMA = {
    type: "object",
    properties: {
        chart_type_suggestion: {
            type: "string",
            description: "Based on the text, suggest the best chart type: 'bar' for comparisons, 'pie' for proportions, or 'line' for trends.",
            enum: ["bar", "pie", "line"],
        },
        optimized_prompt: {
            type: "string",
            description: "A single, highly optimized instruction for the next stage of the model to extract data points for a chart summary. This prompt must not exceed 50 words and must include the chosen chart type.",
        },
    },
    required: ["chart_type_suggestion", "optimized_prompt"],
};

// Stage 2 Schema: Output for the final Chart Data (The data extractor)
const CHART_DATA_SCHEMA = {
    type: "object",
    properties: {
        title: {
            type: "string",
            description: "A concise title summarizing the main topic of the text.",
        },
        data_points: {
            type: "array",
            description: "The top 3-5 most important topics or entities from the text.",
            items: {
                type: "object",
                properties: {
                    label: {
                        type: "string",
                        description: "The key concept or entity name (e.g., 'Blockchain', 'Revenue', 'The Main Character').",
                    },
                    value: {
                        type: "integer",
                        description: "A score from 1 to 100 representing the importance or frequency of this concept in the text.",
                        minimum: 1,
                        maximum: 100,
                    },
                    summary: {
                        type: "string",
                        description: "A single, short sentence explaining this concept's role in the text.",
                    },
                },
                required: ["label", "value", "summary"],
            },
            minItems: 3,
            maxItems: 5,
        },
    },
    required: ["title", "data_points"],
    propertyOrdering: ["title", "data_points"],
};

// Global Chart instance and debug logger
let chartInstance = null;
let debugLog = [];

// --- UTILITY FUNCTIONS ---

/** Updates the status message and debug log visibility. */
function updateStatus(message, isError = false) {
    const statusArea = document.getElementById('statusArea');
    const statusMessage = document.getElementById('statusMessage');
    
    statusArea.classList.remove('hidden');
    statusMessage.textContent = message;
    statusMessage.classList.toggle('text-red-500', isError);
    statusMessage.classList.toggle('text-gray-600', !isError);
}

/** Logs messages to the UI debug window. */
function logDebug(message) {
    const debugOutput = document.getElementById('debugOutput');
    const timestamp = new Date().toLocaleTimeString();
    debugLog.push(`[${timestamp}] ${message}`);
    debugOutput.innerHTML = debugLog.join('<br>');
    debugOutput.scrollTop = debugOutput.scrollHeight;
}

/**
 * The core wrapper for the Prompt API call with JSON constraint.
 * @param {string} promptText The prompt to send to Gemini Nano.
 * @param {object} schema The JSON schema constraint.
 * @returns {object|null} The parsed JSON object or null on error.
 */
async function runNanoPrompt(promptText, schema) {
    let session = null;
    let retryCount = 0;
    const maxRetries = 3;

    try {
        // Check if the LanguageModel API is available
        if (typeof LanguageModel === 'undefined') {
            throw new Error('LanguageModel API is not available');
        }

        // Check model availability with retry logic
        let availability;
        while (retryCount < maxRetries) {
            try {
                availability = await LanguageModel.availability();
                logDebug(`Model availability check (attempt ${retryCount + 1}/${maxRetries}): ${availability}`);
                
                if (availability === 'available') {
                    break;
                }
                
                if (retryCount < maxRetries - 1) {
                    logDebug(`Model not ready, waiting before retry...`);
                    await new Promise(resolve => setTimeout(resolve, 2000)); // Increased delay
                }
                retryCount++;
            } catch (e) {
                logDebug(`Availability check failed: ${e.message}`);
                if (retryCount >= maxRetries - 1) {
                    throw new Error(`Failed to check model availability: ${e.message}`);
                }
                await new Promise(resolve => setTimeout(resolve, 2000));
                retryCount++;
            }
        }

        if (availability !== 'available') {
            throw new Error(`Model is not available after ${maxRetries} attempts. Status: ${availability}`);
        }

        logDebug(`Model is available. Creating AI session...`);
        
        // Create a new session with retry logic
        retryCount = 0;
        while (retryCount < maxRetries) {
            try {
                session = await LanguageModel.create();
                logDebug("AI Session created successfully.");
                break;
            } catch (e) {
                logDebug(`Session creation failed: ${e.message}`);
                if (retryCount >= maxRetries - 1) {
                    throw new Error(`Failed to create AI session: ${e.message}`);
                }
                await new Promise(resolve => setTimeout(resolve, 2000));
                retryCount++;
            }
        }

        if (!session) {
            throw new Error('Failed to create AI session after multiple attempts');
        }

        // Attempt to get a response with retry logic
        let result;
        retryCount = 0;
        while (retryCount < maxRetries) {
            try {
                logDebug(`Sending prompt to model (attempt ${retryCount + 1}/${maxRetries})...`);
                result = await session.prompt(promptText, {
                    responseConstraint: schema,
                });
                
                if (result) {
                    logDebug(`Received response from model`);
                    break;
                }
                
                logDebug(`Empty response received, retrying...`);
                if (retryCount < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                retryCount++;
            } catch (e) {
                logDebug(`Prompt failed: ${e.message}`);
                if (retryCount >= maxRetries - 1) {
                    throw new Error(`Failed to get model response: ${e.message}`);
                }
                await new Promise(resolve => setTimeout(resolve, 2000));
                retryCount++;
            }
        }

        if (!result) {
            throw new Error('No response received from model after multiple attempts');
        }

        logDebug(`Processing model response...`);
        let parsed = null;
        
        try {
            if (typeof result === 'string') {
                logDebug('Parsing string response...');
                parsed = JSON.parse(result);
            } else if (result && result.text) {
                logDebug('Parsing response.text property...');
                parsed = JSON.parse(result.text);
            } else if (result && typeof result === 'object') {
                logDebug('Using response object directly...');
                parsed = result;
            } else {
                throw new Error('Invalid response format from model');
            }

            logDebug(`Parsed result: ${JSON.stringify(parsed, null, 2)}`);
        } catch (parseError) {
            logDebug(`Failed to parse model response: ${parseError.message}`);
            throw new Error('Failed to parse model response');
        }

        // If result or result.text is missing, retry once after a short delay
        if (!result || !result.text) {
            logDebug('Warning: Empty/invalid model response. Retrying once in 1s...');
            await new Promise(r => setTimeout(r, 1000));
            try {
                const retryResult = await session.prompt(promptText, {
                    responseConstraint: schema,
                });
                if (retryResult && retryResult.text) {
                    result = retryResult;
                }
                logDebug('Retry attempt completed.');
                try { console.debug('Retry model result object:', result); } catch (e) {}
            } catch (retryError) {
                logDebug(`Retry failed: ${retryError.message}`);
            }
        }

        // Flexible response handling: the API may return a string, an object with `.text`,
        // an array of outputs, or already-parsed JSON. Try all reasonable extraction paths.
        function tryExtractJsonString(obj) {
            if (!obj) return null;
            // Direct string
            if (typeof obj === 'string') return obj;
            // Common field: text
            if (typeof obj.text === 'string') return obj.text;
            // Some implementations put outputs in an array
            if (Array.isArray(obj.output) && obj.output.length > 0) {
                const first = obj.output[0];
                if (typeof first === 'string') return first;
                if (typeof first.text === 'string') return first.text;
            }
            // Some variants include an 'outputs' field
            if (Array.isArray(obj.outputs) && obj.outputs.length > 0) {
                const first = obj.outputs[0];
                if (typeof first === 'string') return first;
                if (typeof first.text === 'string') return first.text;
            }
            // Fallback: no obvious string found
            return null;
        }

        // If the result is already an object matching the schema, accept it directly.
        const looksLikeMeta = result && typeof result === 'object' && (result.chart_type_suggestion || result.optimized_prompt);
        const looksLikeChart = result && typeof result === 'object' && (result.title && result.data_points);
        if (looksLikeMeta || looksLikeChart) {
            logDebug('Model returned an already-parsed object that matches the expected schema. Using it directly.');
            return result;
        }

        // Try extracting a JSON string from common locations
        let rawText = tryExtractJsonString(result);

        // If nothing found, attempt to inspect object properties and stringify as a last resort
        if (!rawText && typeof result === 'object') {
            try {
                // stringify and see if it's JSON-like
                const s = JSON.stringify(result);
                if (s && s.length > 0) rawText = s;
            } catch (e) {
                // ignore
            }
        }

        if (!rawText) {
            logDebug('No textual payload found in model result object. Dumping object for inspection.');
            try { console.debug('Unhandled model result shape:', result); } catch (e) {}
            throw new Error('Invalid or empty response from the model');
        }

        // Clean common wrappers (code fences, markdown) before parsing
        function cleanWrappedJson(text) {
            // Remove triple backticks and optional language hint
            text = text.replace(/```[\s\S]*?```/g, (m) => m.replace(/(^```\w*|```$)/g, ''));
            // Trim leading/trailing whitespace and possible single backticks
            text = text.trim().replace(/^`|`$/g, '');
            return text;
        }

        rawText = cleanWrappedJson(rawText);

        // Attempt to locate JSON object within the text (first '{' to last '}')
        function extractJsonSubstring(text) {
            const first = text.indexOf('{');
            const last = text.lastIndexOf('}');
            if (first !== -1 && last !== -1 && last > first) {
                return text.substring(first, last + 1);
            }
            return text;
        }

        const candidate = extractJsonSubstring(rawText);
        logDebug(`Raw response text received (Length: ${candidate.length}): ${candidate.substring(0, 200)}...`);

        try {
            const parsed = JSON.parse(candidate);
            return parsed;
        } catch (parseError) {
            logDebug(`Failed to parse candidate JSON. Candidate: ${candidate}`);
            throw new Error('Failed to parse model response as JSON');
        }

    } catch (error) {
        // IMPORTANT: Log the error, but use console.error for visibility during development
        console.error("Nano Prompt failed:", error); 
        
        let userMessage = "AI Processing Failed. Please check the following:";

        if (error.message.includes('Permissions Policy')) {
            userMessage = "CRITICAL FAILURE: Permission/Access Denied. Ensure Chrome flags are enabled and the extension is correctly loaded.";
        } else if (error.message.includes('The model is not available')) {
            userMessage += " **Model Unavailable.** Check `chrome://on-device-internals` status.";
        } else {
            userMessage += " Unspecified error. See console.";
        }

        logDebug(`ERROR: Gemini Nano failed. Details: ${error.message}`);
        updateStatus(userMessage, true);
        return null;
    } finally {
        try {
            if (session && typeof session.terminate === 'function') {
                session.terminate();
                logDebug("AI Session terminated.");
            }
        } catch (e) {
            logDebug("Note: Session cleanup failed (ignorable): " + e.message);
        }
    }
}

// --- STAGE 1 & 2 PIPELINE ---

async function executeTwoStageSummary(textInput) {
    updateStatus("Starting Stage 1: Meta-Prompt Generation...", false);
    logDebug("Starting Stage 1: Asking Nano to generate the optimized prompt.");

    try {
        // --- STAGE 1: GENERATE OPTIMIZED PROMPT ---
        const metaPrompt = `
            Analyze the following document's content, theme, and structure. 
            Generate an ideal, short prompt (max 50 words) and a chart type suggestion
            that will instruct the next stage of the LLM to extract the core data for a visual summary.
            Document content: ${textInput}
            ---
            Generate a JSON object strictly following the provided schema.
        `;
        
        const metaData = await runNanoPrompt(metaPrompt, META_PROMPT_SCHEMA);
        if (!metaData) {
            throw new Error('Failed to generate meta-prompt data');
        }

        try {
            logDebug(`Stage 1 parsed metaData: ${JSON.stringify(metaData)}`);
        } catch (e) {
            logDebug('Stage 1 completed but could not stringify result');
        }

        logDebug(`[Stage 1 Success] Suggested Chart: ${metaData.chart_type_suggestion}. Optimized Prompt: ${metaData.optimized_prompt}`);

        // --- STAGE 2: EXECUTE OPTIMIZED PROMPT FOR DATA EXTRACTION ---
        updateStatus("Starting Stage 2: Executing Optimized Prompt for Data Extraction...", false);
        logDebug("Starting Stage 2: Asking Nano to extract structured chart data.");

        const stage2Prompt = `
            ${metaData.optimized_prompt} The analysis should be based ONLY on this text: ${textInput}
            Generate a JSON object strictly following the CHART_DATA_SCHEMA.
        `;

        logDebug(`Stage 2 prompt prepared, length: ${stage2Prompt.length}`);

        const chartData = await runNanoPrompt(stage2Prompt, CHART_DATA_SCHEMA);
        if (!chartData) {
            throw new Error('Failed to generate chart data');
        }

        logDebug("[Stage 2 Success] Received structured data.");

        // Final step: Override the visualization type with Nano's Stage 1 suggestion
        chartData.visualization_type = metaData.chart_type_suggestion; 

        updateStatus("Summary generation complete. Rendering Chart...", false);
        renderChart(chartData);
    } catch (error) {
        logDebug(`Error in executeTwoStageSummary: ${error.message}`);
        updateStatus(`Failed to generate summary: ${error.message}`, true);
        throw error; // Re-throw for the click handler to catch
    }
}

function renderChart(structuredData) {
    logDebug('Starting chart rendering...');
    console.log('Chart data:', structuredData);
    
    try {
        const chartContainer = document.getElementById('chartContainer');
        if (!chartContainer) {
            throw new Error('Chart container not found');
        }
        chartContainer.classList.remove('hidden');

        const chartTitle = document.getElementById('chartTitle');
        if (chartTitle) {
            chartTitle.textContent = structuredData.title || 'Analysis Results';
        }

        // Ensure we have valid data
        if (!structuredData.data_points || !Array.isArray(structuredData.data_points)) {
            throw new Error('Invalid data points structure');
        }

        const labels = structuredData.data_points.map(p => p.label);
        const dataValues = structuredData.data_points.map(p => p.value);
        const chartType = structuredData.visualization_type || 'bar';

        // Destroy previous chart instance if it exists
        if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
        }

        const canvas = document.getElementById('summaryChart');
        if (!canvas) {
            throw new Error('Canvas element not found');
        }

        const renderingContext = canvas.getContext('2d');
        if (!renderingContext) {
            throw new Error('Could not get canvas context');
        }

        // Define colors for the chart
        const backgroundColors = [
            'rgba(255, 99, 132, 0.7)',  // Red
            'rgba(54, 162, 235, 0.7)',  // Blue
            'rgba(255, 206, 86, 0.7)',  // Yellow
            'rgba(75, 192, 192, 0.7)',  // Green
            'rgba(153, 102, 255, 0.7)'  // Purple
        ];

        // Create new chart
        chartInstance = new Chart(renderingContext, {
            type: chartType === 'pie' ? 'doughnut' : 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Importance Score (1-100)',
                    data: dataValues,
                    backgroundColor: backgroundColors.slice(0, dataValues.length),
                    borderColor: '#4f46e5',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: structuredData.title,
                        font: { size: 18, weight: 'bold' }
                    },
                    legend: {
                        position: chartType === 'pie' ? 'right' : 'top',
                        labels: {
                            font: { size: 12 }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleFont: { weight: 'bold' },
                        bodyFont: { size: 14 },
                        callbacks: {
                            footer: (tooltipItems) => {
                                const itemIndex = tooltipItems[0].dataIndex;
                                return structuredData.data_points[itemIndex].summary;
                            }
                        }
                    }
                },
                scales: chartType !== 'pie' ? {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Importance / Weight (%)'
                        }
                    }
                } : {}
            }
        });

        updateStatus("Visual Summary Complete!", false);
        const summarizeButton = document.getElementById('summarizeButton');
        if (summarizeButton) {
            summarizeButton.disabled = false;
            summarizeButton.textContent = "Generate Visual Summary (2 Stages)";
        }
    } catch (error) {
        console.error('Chart rendering error:', error);
        updateStatus(`Failed to render chart: ${error.message}`, true);
        throw error;
    }
}

    // --- EVENT LISTENER ---

function initializeApp() {
    const summarizeButton = document.getElementById('summarizeButton');
    const textInput = document.getElementById('textInput');
    const chartContainer = document.getElementById('chartContainer');
    const statusArea = document.getElementById('statusArea');

    if (!summarizeButton || !textInput || !chartContainer || !statusArea) {
        updateStatus("Error: Required UI elements not found. Please check the HTML.", true);
        return;
    }

    if (!AI_API_AVAILABLE) {
        updateStatus("Chrome's AI API is not available. Please check:\n1. You're using Chrome version 122 or later\n2. The chrome://flags/#enable-experimental-web-platform-features flag is enabled", true);
        summarizeButton.disabled = true;
        summarizeButton.textContent = "API NOT AVAILABLE";
        return;
    }

    // Pre-fill text area for testing (optional)
    if (textInput.value.trim() === "") {
        textInput.value = "The Artemis program represents NASA's ambitious plan to return humans to the Moon, establishing a sustainable presence that paves the way for missions to Mars. Phase 1, which included the uncrewed Artemis I mission, successfully tested the massive Space Launch System (SLS) rocket and the Orion crew capsule in late 2022, proving key technologies. The primary goal is Artemis III, scheduled for 2026, which aims to land the first woman and the next man on the Moon's South Pole, a region rich in water ice. However, the program faces significant budget constraints and scheduling delays, pushing the initial 2025 landing target back. Funding levels have been inconsistent, creating challenges for the development of the Human Landing System (HLS), which is contracted to SpaceX's Starship. Despite the technical hurdles, the long-term vision focuses heavily on international collaboration, with agencies like ESA and JAXA contributing critical components like the European Service Module (ESM). Success relies on sustained political and financial backing, as costs are projected to exceed $90 billion by 2028.";
    }

    summarizeButton.addEventListener('click', async () => {
        const textInputValue = textInput.value.trim();
        if (textInputValue.length < 50) {
            updateStatus("Please enter a longer piece of text (min 50 chars) for analysis.", true);
            return;
        }

        // Reset UI and state
        summarizeButton.disabled = true;
        summarizeButton.textContent = "Processing... (Stage 1 of 2)";
        chartContainer.classList.add('hidden');
        debugLog = [];
        
        try {
            await executeTwoStageSummary(textInputValue);
        } catch (error) {
            console.error('Error during summarization:', error);
            logDebug(`Summarization failed: ${error.message}`);
            updateStatus("Summarization failed. Please try again or check Chrome's AI flags.", true);
        } finally {
            summarizeButton.disabled = false;
            summarizeButton.textContent = "Generate Visual Summary (2 Stages)";
        }
    });
}

// Initialize the application when the DOM is loaded
window.addEventListener('DOMContentLoaded', function() {
    try {
        initializeApp();
    } catch (error) {
        console.error('Error during app initialization:', error);
        updateStatus("Failed to initialize the application. Please reload the extension.", true);
    }
});