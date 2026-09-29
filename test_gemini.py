import os
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

print("API key loaded:", bool(api_key))

if not api_key:
    print("ERROR: GEMINI_API_KEY was not found.")
    exit()

try:
    client = genai.Client(api_key=api_key)

    print("Connecting to Gemini...")

    response = client.models.generate_content(
        model="gemini-3.8-flash",
        contents="Say hello in one short sentence.",
        config=types.GenerateContentConfig(
            automatic_function_calling=types.AutomaticFunctionCallingConfig(
                disable=True
            )
        )
    )

    print("SUCCESS!")
    print("Gemini response:")
    print(response.text)

except Exception as e:
    print("GEMINI ERROR:")
    print(type(e).__name__)
    print(e)