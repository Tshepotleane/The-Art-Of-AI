import os
import time
import uuid

from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
from google import genai
from google.genai import types


# ============================================================
# LOAD ENVIRONMENT VARIABLES
# ============================================================

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

TEXT_MODEL = os.getenv(
    "GEMINI_TEXT_MODEL",
    "gemini-3.8-flash"
)

IMAGE_MODEL = os.getenv(
    "GEMINI_IMAGE_MODEL",
    "gemini-3.1-flash-image"
)


# ============================================================
# FLASK APPLICATION
# ============================================================

app = Flask(__name__)


# ============================================================
# GEMINI CLIENT
# ============================================================

client = None

if GEMINI_API_KEY:

    client = genai.Client(
        api_key=GEMINI_API_KEY
    )

    print("Gemini API configuration loaded.")

else:

    print("WARNING: GEMINI_API_KEY is missing.")


# ============================================================
# GENERATION CONFIGURATION
# ============================================================

generation_config = types.GenerateContentConfig(
    automatic_function_calling=types.AutomaticFunctionCallingConfig(
        disable=True
    )
)


# ============================================================
# GEMINI TEXT GENERATION WITH RETRIES
# ============================================================

def generate_text_with_retry(prompt):

    if client is None:
        raise RuntimeError("Gemini API key is not configured.")

    max_attempts = 3

    for attempt in range(max_attempts):

        try:

            response = client.models.generate_content(
                model=TEXT_MODEL,
                contents=prompt,
                config=generation_config
            )

            return response

        except Exception as error:

            error_message = str(error).lower()

            temporary_error = (
                "503" in error_message
                or "unavailable" in error_message
                or "429" in error_message
                or "resource_exhausted" in error_message
            )

            if temporary_error and attempt < max_attempts - 1:

                wait_time = 2 ** attempt

                print(
                    f"Gemini temporarily unavailable. "
                    f"Retrying in {wait_time} seconds..."
                )

                time.sleep(wait_time)

            else:

                raise


# ============================================================
# HOME PAGE
# ============================================================

@app.route("/")
def home():

    return render_template("index.html")


# ============================================================
# GENERATE CONTENT
# ============================================================

@app.route("/generate", methods=["POST"])
def generate():

    try:

        # ----------------------------------------------------
        # CHECK API CLIENT
        # ----------------------------------------------------

        if client is None:

            return jsonify({
                "success": False,
                "error": (
                    "Gemini API key is missing. "
                    "Please configure GEMINI_API_KEY in Render."
                )
            }), 500


        # ----------------------------------------------------
        # GET FRONTEND DATA
        # ----------------------------------------------------

        data = request.get_json(silent=True)

        if not data:

            return jsonify({
                "success": False,
                "error": "No data was received."
            }), 400


        prompt = data.get("prompt", "").strip()

        content_type = data.get(
            "content_type",
            "text"
        ).lower()


        # ----------------------------------------------------
        # VALIDATE PROMPT
        # ----------------------------------------------------

        if not prompt:

            return jsonify({
                "success": False,
                "error": "Please enter a prompt."
            }), 400


        print("========================================")
        print("NEW GENERATION REQUEST")
        print("Content type:", content_type)
        print("Model:", TEXT_MODEL)
        print("========================================")


        # ====================================================
        # TEXT GENERATION
        # ====================================================

        if content_type in [
            "text",
            "linkedin",
            "article",
            "motivation"
        ]:

            response = generate_text_with_retry(prompt)

            result = response.text

            if not result:

                return jsonify({
                    "success": False,
                    "error": "Gemini returned an empty response."
                }), 500


            return jsonify({
                "success": True,
                "type": "text",
                "result": result
            })


        # ====================================================
        # CODE GENERATION
        # ====================================================

        elif content_type == "code":

            code_prompt = f"""
You are an expert software developer.

The user wants:

{prompt}

Generate clean, functional and beginner-friendly code.

Requirements:

- Use the programming language requested by the user.
- Make the code easy to understand.
- Include useful comments where appropriate.
- Make sure the code is syntactically correct.
- Do not use unnecessary libraries.
- Return the actual code.
"""

            response = generate_text_with_retry(code_prompt)

            result = response.text

            if not result:

                return jsonify({
                    "success": False,
                    "error": "Gemini returned an empty code response."
                }), 500


            return jsonify({
                "success": True,
                "type": "code",
                "result": result
            })


        # ====================================================
        # IMAGE GENERATION
        # ====================================================

        elif content_type == "image":

            print("Generating image...")

            try:

                response = client.models.generate_content(
                    model=IMAGE_MODEL,
                    contents=prompt
                )

                image_saved = False
                image_url = None

                # ----------------------------------------------
                # CHECK RESPONSE PARTS
                # ----------------------------------------------

                for part in response.parts:

                    if part.inline_data is not None:

                        image = part.as_image()

                        # --------------------------------------
                        # CREATE IMAGE FOLDER
                        # --------------------------------------

                        generated_folder = os.path.join(
                            app.static_folder,
                            "generated"
                        )

                        os.makedirs(
                            generated_folder,
                            exist_ok=True
                        )

                        # --------------------------------------
                        # UNIQUE IMAGE NAME
                        # --------------------------------------

                        image_filename = (
                            f"generated_{uuid.uuid4().hex}.png"
                        )

                        image_path = os.path.join(
                            generated_folder,
                            image_filename
                        )

                        # --------------------------------------
                        # SAVE IMAGE
                        # --------------------------------------

                        image.save(image_path)

                        image_url = (
                            f"/static/generated/{image_filename}"
                        )

                        image_saved = True

                        break


                # ----------------------------------------------
                # CHECK IMAGE
                # ----------------------------------------------

                if not image_saved:

                    return jsonify({
                        "success": False,
                        "error": (
                            "Gemini did not return an image. "
                            "Please try a different prompt."
                        )
                    }), 500


                return jsonify({
                    "success": True,
                    "type": "image",
                    "result": image_url
                })


            except Exception as image_error:

                print("IMAGE GENERATION ERROR:")
                print(str(image_error))

                error_text = str(image_error).lower()

                if (
                    "429" in error_text
                    or "resource_exhausted" in error_text
                    or "quota" in error_text
                ):

                    return jsonify({
                        "success": False,
                        "error": (
                            "Image generation has reached its API quota. "
                            "Please try again later."
                        )
                    }), 429


                if (
                    "503" in error_text
                    or "unavailable" in error_text
                ):

                    return jsonify({
                        "success": False,
                        "error": (
                            "Gemini image generation is temporarily "
                            "unavailable. Please try again later."
                        )
                    }), 503


                return jsonify({
                    "success": False,
                    "error": (
                        "Image generation failed. "
                        "Please check your API configuration."
                    )
                }), 500


        # ====================================================
        # UNKNOWN CONTENT TYPE
        # ====================================================

        else:

            return jsonify({
                "success": False,
                "error": (
                    f"Unsupported content type: {content_type}"
                )
            }), 400


    # ========================================================
    # GENERAL ERROR HANDLING
    # ========================================================

    except Exception as error:

        print("========================================")
        print("GENERATION ERROR")
        print(type(error).__name__)
        print(str(error))
        print("========================================")

        error_text = str(error).lower()

        if (
            "404" in error_text
            or "not_found" in error_text
        ):

            message = (
                "The selected Gemini model is unavailable. "
                "Please check GEMINI_TEXT_MODEL in Render."
            )

            return jsonify({
                "success": False,
                "error": message
            }), 503


        if (
            "429" in error_text
            or "resource_exhausted" in error_text
            or "quota" in error_text
        ):

            return jsonify({
                "success": False,
                "error": (
                    "Gemini API quota exceeded. "
                    "Please check your API usage and try again later."
                )
            }), 429


        if (
            "503" in error_text
            or "unavailable" in error_text
        ):

            return jsonify({
                "success": False,
                "error": (
                    "Gemini is temporarily unavailable. "
                    "Please try again shortly."
                )
            }), 503


        return jsonify({
            "success": False,
            "error": (
                "Content generation failed. "
                "Please check the server logs."
            )
        }), 500


# ============================================================
# RUN APPLICATION
# ============================================================

if __name__ == "__main__":

    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5000)),
        debug=False
    )