import os
import google.generativeai as genai
import json
import sys

def answer_question(text, question):
    genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

    if not os.environ.get("GEMINI_API_KEY"):
        print(json.dumps({"error": "GEMINI_API_KEY environment variable not set."}), file=sys.stderr)
        sys.exit(1)

    model = genai.GenerativeModel('gemini-1.5-flash')

    qa_prompt = """
      You are a helpful assistant. Answer the user's question based ONLY on the provided text. If the answer is not in the text, state that you don't know.

      Text: {text}
      Question: {question}
      Answer:
      """

    try:
        response = model.generate_content(qa_prompt.format(text=text, question=question))
        answer = response.text.strip()
        return {"answer": answer}
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Text and question not provided for Q&A."}), file=sys.stderr)
        sys.exit(1)
    
    input_text = sys.argv[1]
    input_question = sys.argv[2]
    result = answer_question(input_text, input_question)
    print(json.dumps(result))
