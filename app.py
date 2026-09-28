import os
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

app = Flask(__name__)

api_key = os.getenv("OPENAI_API_KEY")

if not api_key:
    print("WARNING: OPENAI_API_KEY is not set in the .env file.")

client = OpenAI(api_key=api_key) if api_key else None


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/generate", methods=["POST"])
def generate():
    try:
        data = request.get_json()

        prompt = data.get("prompt", "").strip()
        content_type = data.get("content_type", "text")

        if not prompt:
            return jsonify({
                "success": False,
                "error": "Please enter a prompt."
            }), 400

        if not client:
            return jsonify({
                "success": False,
                "error": "API key is missing. Please check your .env file."
            }), 500

        # IMAGE GENERATION
        if content_type == "image":
            response = client.images.generate(
                model="gpt-image-1",
                prompt=prompt,
                size="1024x1024"
            )

            image_data = response.data[0]

            if hasattr(image_data, "url") and image_data.url:
                return jsonify({
                    "success": True,
                    "type": "image",
                    "result": image_data.url
                })

            if hasattr(image_data, "b64_json") and image_data.b64_json:
                return jsonify({
                    "success": True,
                    "type": "image_base64",
                    "result": image_data.b64_json
                })

            return jsonify({
                "success": False,
                "error": "The image was generated, but no image data was returned."
            }), 500

        # TEXT / CODE GENERATION
        system_message = """
You are The Art Of AI, an AI content creation assistant.

Help users create useful, accurate and high-quality content.

If the user asks for code:
- Provide clean and readable code.
- Explain the important parts.
- Follow the programming language requested.

If the user asks for normal content:
- Make it clear, useful and well structured.
- Match the user's requested tone and purpose.
"""

        if content_type == "code":
            system_message += """
The user specifically wants code.
Return the solution with a short explanation.
Use markdown code blocks where appropriate.
"""

        response = client.responses.create(
            model="gpt-5-mini",
            instructions=system_message,
            input=prompt
        )

        result = response.output_text

        return jsonify({
            "success": True,
            "type": content_type,
            "result": result
        })

    except Exception as error:
        print("ERROR:", error)

        return jsonify({
            "success": False,
            "error": str(error)
        }), 500


@app.route("/health")
def health():
    return jsonify({
        "status": "The Art Of AI is running"
    })


if __name__ == "__main__":
    app.run(debug=True)