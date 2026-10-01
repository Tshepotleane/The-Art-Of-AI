import os
import time

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

    print("WARNING: GEMINI_API_KEY is missing from .env")


# ============================================================
# GEMINI CONFIGURATION
# ============================================================

generation_config = types.GenerateContentConfig(
    automatic_function_calling=types.AutomaticFunctionCallingConfig(
        disable=True
    )
)
def generate_text_with_retry(prompt):
    max_attempts = 4

    for attempt in range(max_attempts):

        try:

            response = client.models.generate_content(
                model=TEXT_MODEL,
                contents=prompt,
                config=generation_config
            )

            return response

        except Exception as e:

            error_message = str(e)

            if "503" in error_message or "UNAVAILABLE" in error_message:

                if attempt < max_attempts - 1:

                    wait_time = 2 ** attempt

                    print(
                        f"Gemini temporarily unavailable. "
                        f"Retrying in {wait_time} seconds..."
                    )

                    time.sleep(wait_time)

                else:

                    raise

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
        # CHECK GEMINI CLIENT
        # ----------------------------------------------------

        if client is None:

            return jsonify({
                "success": False,
                "error": "Gemini API key is missing. Check your .env file."
            }), 500


        # ----------------------------------------------------
        # GET DATA FROM FRONTEND
        # ----------------------------------------------------

        data = request.get_json()

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
        # CHECK PROMPT
        # ----------------------------------------------------

        if not prompt:

            return jsonify({
                "success": False,
                "error": "Please enter a prompt."
            }), 400


        print()
        print("========================================")
        print("NEW GENERATION REQUEST")
        print("Content type:", content_type)
        print("Prompt:", prompt)
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

            response = generate_text_with_retry(prompt)


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

                # ------------------------------------------------
                # CHECK RESPONSE PARTS
                # ------------------------------------------------

                for part in response.parts:

                    if part.inline_data is not None:

                        image = part.as_image()

                        # ----------------------------------------
                        # CREATE IMAGE FOLDER
                        # ----------------------------------------

                        generated_folder = os.path.join(
                            app.static_folder,
                            "generated"
                        )

                        os.makedirs(
                            generated_folder,
                            exist_ok=True
                        )

                        # ----------------------------------------
                        # SAVE IMAGE
                        # ----------------------------------------

                        image_path = os.path.join(
                            generated_folder,
                            "generated_image.png"
                        )

                        image.save(image_path)

                        image_url = (
                            "/static/generated/generated_image.png"
                        )

                        image_saved = True

                        break

                # ------------------------------------------------
                # CHECK IF IMAGE WAS CREATED
                # ------------------------------------------------

                if not image_saved:

                    return jsonify({
                        "success": False,
                        "error": (
                            "Image generation is currently unavailable. "
                            "Please try again later. "
                            "Text and code generation are still available."
                        )
                    }), 503

                return jsonify({
                    "success": True,
                    "type": "image",
                    "result": image_url
                })

            except Exception as image_error:

                error_text = str(image_error)

                print("IMAGE GENERATION ERROR:")
                print(error_text)

                # ------------------------------------------------
                # HANDLE IMAGE QUOTA
                # ------------------------------------------------

                if (
                    "429" in error_text
                    or "RESOURCE_EXHAUSTED" in error_text
                    or "quota" in error_text.lower()
                ):

                    return jsonify({
                        "success": False,
                        "error": (
                            "AI Artwork is temporarily unavailable "
                            "because the image-generation quota has "
                            "been reached. Text and code generation "
                            "are still available."
                        )
                    }), 429

                # ------------------------------------------------
                # HANDLE OTHER IMAGE ERRORS
                # ------------------------------------------------

                return jsonify({
                    "success": False,
                    "error": (
                        "AI Artwork could not be generated right now. "
                        "Please try again later."
                    )
                }), 500


            # ------------------------------------------------
            # CHECK RESPONSE PARTS
            # ------------------------------------------------

            for part in response.parts:

                if part.inline_data is not None:

                    image = part.as_image()


                    # ----------------------------------------
                    # CREATE IMAGE FOLDER
                    # ----------------------------------------

                    generated_folder = os.path.join(
                        app.static_folder,
                        "generated"
                    )

                    os.makedirs(
                        generated_folder,
                        exist_ok=True
                    )


                    # ----------------------------------------
                    # SAVE IMAGE
                    # ----------------------------------------

                    image_path = os.path.join(
                        generated_folder,
                        "generated_image.png"
                    )

                    image.save(image_path)


                    image_url = (
                        "/static/generated/generated_image.png"
                    )

                    image_saved = True

                    break


            # ------------------------------------------------
            # CHECK IMAGE
            # ------------------------------------------------

            if not image_saved:

                return jsonify({
                    "success": False,
                    "error": "Gemini did not return an image."
                }), 500


            return jsonify({
                "success": True,
                "type": "image",
                "result": image_url
            })


        # ====================================================
        # UNKNOWN CONTENT TYPE
        # ====================================================

        else:

            response = client.models.generate_content(
                model=TEXT_MODEL,
                contents=prompt,
                config=generation_config
            )

            result = response.text


            return jsonify({
                "success": True,
                "type": "text",
                "result": result
            })


    # ========================================================
    # ERROR HANDLING
    # ========================================================

    except Exception as e:

        print()
        print("========================================")
        print("GENERATION ERROR")
        print(type(e).__name__)
        print(str(e))
        print("========================================")


        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# ============================================================
# RUN APPLICATION
# ============================================================

if __name__ == "__main__":

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )