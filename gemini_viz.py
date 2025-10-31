import os
import json
import sys
import re
import matplotlib.pyplot as plt
import seaborn as sns
import io
import base64
import pandas as pd
import argparse

def generate_visualization(input_data, is_csv=False):
    try:
        import google.generativeai as genai
        genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

        if not os.environ.get("GEMINI_API_KEY"):
            print(json.dumps({"error": "GEMINI_API_KEY environment variable not set."}, file=sys.stderr))
            sys.exit(1)

        model = genai.GenerativeModel('gemini-2.5-flash')

    except ModuleNotFoundError:
        print(json.dumps({"error": "⚠️ Gemini module not found. Skipping AI generation."}, file=sys.stderr))
        sys.exit(1)


    text_to_process = input_data
    df = None
    if is_csv:
        try:
            df = pd.read_csv(io.StringIO(input_data))
            # For CSV, we'll ask Gemini to describe the data and suggest a visualization
            text_to_process = f"CSV Data Description:\n{df.head().to_string()}... (truncated)\nColumns: {df.columns.tolist()}\n\nBased on this CSV data, what would be the best chart type (bar, pie, or line) to visualize key insights, and what would be a concise (<=50 words) optimized summarization prompt to extract data points for that chart?"
        except Exception as e:
            print(json.dumps({"error": f"Failed to read CSV data: {e}"}, file=sys.stderr))
            sys.exit(1)

    # Stage 1: Generate Meta-Prompt
    meta_prompt_system = """
      You are a meta-prompt generator.
      Your job is to analyze input text/data and decide:
      1. The best chart type to visualize it (bar, pie, or line).
      2. A concise (<=50 words) optimized summarization prompt.
      Respond in this JSON format:
      {
        "chart_type_suggestion": "<bar|pie|line>",
        "optimized_prompt": "<prompt text>"
      }
    """
    raw_meta_output = ""
    try:
        meta_response = model.generate_content(meta_prompt_system + "\nTEXT: " + text_to_process)
        raw_meta_output = meta_response.text.strip()
        # Remove ```json ... ``` wrappers if present
        clean_output = re.sub(r"^```json\s*|\s*```$", "", raw_meta_output.strip())
        meta_output = json.loads(clean_output)
        chart_type = meta_output["chart_type_suggestion"]
        optimized_prompt = meta_output["optimized_prompt"]
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Failed to parse meta-prompt JSON from Gemini: {e}", "raw_output": raw_meta_output}), file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": f"Failed to generate meta-prompt: {e}"}, file=sys.stderr))
        sys.exit(1)

    # Stage 2: Extract Structured Chart Data
    data_extraction_system = """
      You are a summarization model that outputs JSON for chart visualization.
      You will receive a user prompt (guiding instruction) and a long text/data.
      Return data in this exact structure:
      {
        "title": "<short summary title>",
        "data_points": [
          {"label": "<category/topic>", "value": <number>, "summary": "<one-line summary>"}
        ]
      }
    """
    raw_chart_data_output = ""
    try:
        data_response = model.generate_content(data_extraction_system + f"\nPROMPT: {optimized_prompt}\nTEXT/DATA: {input_data}")
        raw_chart_data_output = data_response.text.strip()
        # Remove ```json ... ``` wrappers if present
        clean_output = re.sub(r"^```json\s*|\s*```$", "", raw_chart_data_output.strip())
        chart_data = json.loads(clean_output)
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Failed to parse chart data JSON from Gemini: {e}", "raw_output": raw_chart_data_output}), file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": f"Failed to extract chart data: {e}"}, file=sys.stderr))
        sys.exit(1)

    # Stage 3: Render Chart using Matplotlib/Seaborn
    plt.figure(figsize=(10, 6))
    try:
        labels = [dp["label"] for dp in chart_data["data_points"]]
        values = [dp["value"] for dp in chart_data["data_points"]]
        title = chart_data["title"]

        if chart_type == "bar":
            sns.barplot(x=labels, y=values)
            plt.title(title)
            plt.xlabel("Category/Topic")
            plt.ylabel("Value")
        elif chart_type == "pie":
            plt.pie(values, labels=labels, autopct='%1.1f%%', startangle=90)
            plt.title(title)
            plt.axis('equal') # Equal aspect ratio ensures that pie is drawn as a circle.
        elif chart_type == "line":
            sns.lineplot(x=labels, y=values, marker='o')
            plt.title(title)
            plt.xlabel("Category/Topic")
            plt.ylabel("Value")
        else:
            print(json.dumps({"error": f"Unsupported chart type: {chart_type}"}, file=sys.stderr))
            sys.exit(1)

        # Save plot to a base64 string
        buf = io.BytesIO()
        plt.tight_layout()
        plt.savefig(buf, format='png')
        buf.seek(0)
        image_base64 = base64.b64encode(buf.read()).decode('utf-8')
        plt.close() # Close the plot to free memory

        return {"image": image_base64, "title": title}
    except Exception as e:
        plt.close() # Ensure plot is closed on error
        print(json.dumps({"error": f"Failed to render chart: {e}"}, file=sys.stderr))
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate visualization from text or CSV.")
    parser.add_argument("input_data", help="Text content or CSV content.")
    parser.add_argument("--csv", action="store_true", help="Indicate if the input_data is CSV content.")
    args = parser.parse_args()

    result = generate_visualization(args.input_data, args.csv)
    print(json.dumps(result))