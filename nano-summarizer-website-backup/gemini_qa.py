import os
import json
import sys
import argparse

def answer_question(input_data, question, is_csv=False):
    try:
        import google.generativeai as genai
        genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

        if not os.environ.get("GEMINI_API_KEY"):
            print(json.dumps({"error": "GEMINI_API_KEY environment variable not set."}), file=sys.stderr)
            sys.exit(1)

        model = genai.GenerativeModel('gemini-2.5-flash')

        context_prefix = "Text" if not is_csv else "CSV Data"
        qa_prompt = f"""
          You are a helpful assistant. Answer the user's question based ONLY on the provided {context_prefix}. If the answer is not in the {context_prefix}, state that you don't know.

          {context_prefix}: {input_data}
          Question: {question}
          Answer:
          """

        try:
            response = model.generate_content(qa_prompt)
            answer = response.text.strip()
            return {"answer": answer}
        except Exception as e:
            print(json.dumps({"error": str(e)}), file=sys.stderr)
            sys.exit(1)
    except ModuleNotFoundError:
        print(json.dumps({"error": "⚠️ Gemini module not found. Skipping AI generation."}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Answer questions based on text or CSV.")
    parser.add_argument("input_data", help="Text content or CSV content.")
    parser.add_argument("question", help="The question to answer.")
    parser.add_argument("--csv", action="store_true", help="Indicate if the input_data is CSV content.")
    args = parser.parse_args()

    result = answer_question(args.input_data, args.question, args.csv)
    print(json.dumps(result))
